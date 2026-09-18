/**
 * Mock API server — faithfully mirrors the NestJS blog backend contract.
 *
 * Why: the sandbox has no PostgreSQL / Redis / Cloudinary, so the real backend
 * cannot boot here. This server implements the *exact* same routes, payload
 * shapes, response envelope and error format (including the backend's quirks),
 * so the frontend is developed and demoed against a realistic API.
 *
 * Switch to the real backend with:  API_ORIGIN=http://localhost:3000 npm run dev
 *
 * Quirks deliberately reproduced (see /home/user/API_MAP.md):
 *   • success envelope  { message: { en, fa }, data }
 *   • paginated lists   { data: [...], meta: {...} }   ← NO envelope
 *   • GET /users        → raw array                    ← NO envelope
 *   • GET /categories   → data: { categories: [...] }  ← extra nesting
 *   • validation errors → message is a string[] (class-validator)
 *   • other errors      → { statusCode, message, timestamp }
 *   • /post (singular) vs /posts/:postId/comments (plural)
 *   • comments come back flat — the tree is built client-side from parentId
 */

import express from 'express';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT ?? 3000);
const JWT_SECRET = process.env.JWT_SECRET ?? 'mock-access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'mock-refresh-secret';
const ACCESS_TTL = Number(process.env.JWT_ACCESS_EXPIRES_IN ?? 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_EXPIRES_IN ?? 604800);
/** Set MOCK_THROTTLE=1 to reproduce the backend's very strict 10 req/min limit. */
const THROTTLE = process.env.MOCK_THROTTLE === '1';

/* ─────────────────────────── tiny JWT (HS256) ─────────────────────────── */
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64url(JSON.stringify(body))}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verifyJwt(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  if (expected !== parts[2]) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  } catch {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { expired: true };
  return payload;
}

/* ─────────────────────────── helpers ─────────────────────────── */
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** Identical to src/common/utilities/slug.util.ts (keeps the Arabic/Persian range). */
function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/** Bilingual success envelope — mirrors ResponseDetail. */
const ok = (en, fa, data) => ({ message: { en, fa }, ...(data === undefined ? {} : { data }) });

/** Mirrors HttpExceptionFilter output. */
function httpError(res, statusCode, en, fa) {
  return res.status(statusCode).json({
    statusCode,
    message: en && fa ? { en, fa } : en,
    timestamp: now(),
  });
}

/** Mirrors NestJS ValidationPipe output — message is a string[]. */
function validationError(res, messages) {
  return res.status(400).json({ statusCode: 400, message: messages, timestamp: now() });
}

/** Strip password, exactly like @Exclude() + ClassSerializerInterceptor. */
const publicUser = (u) => {
  if (!u) return u;
  const { password, confirmPassword, ...rest } = u;
  return rest;
};

/* ─────────────────────────── in-memory DB ─────────────────────────── */
const db = { users: [], categories: [], posts: [], comments: [], sessions: new Map() };

/** Deterministic SVG images so the offline preview still shows artwork. */
const mediaUrl = (kind, seed) => `/api/img/${kind}/${encodeURIComponent(seed)}.svg`;

function seed() {
  const mkUser = (name, email, password, role, bio, avatarSeed) => ({
    id: uuid(), name, email, password, role, bio,
    avatar: mediaUrl('avatar', avatarSeed),
    createdAt: new Date(Date.now() - 90 * 864e5).toISOString(),
    updatedAt: now(),
  });

  const admin = mkUser('مریم صفری', 'admin@blog.dev', 'admin123', 'admin',
    'توسعه‌دهندهٔ بک‌اند و نویسندهٔ این بلاگ. عاشق NestJS و معماری نرم‌افزار.', 'maryam');
  const sara = mkUser('سارا احمدی', 'sara@blog.dev', 'sara1234', 'user',
    'طراح رابط کاربری و نویسندهٔ حوزهٔ تجربهٔ کاربری.', 'sara');
  const ali = mkUser('Ali Rezaei', 'ali@blog.dev', 'ali12345', 'user',
    'Frontend engineer writing about React, TypeScript and web performance.', 'ali');
  db.users.push(admin, sara, ali);

  const mkCat = (name, description) => ({
    id: uuid(), name, slug: slugify(name), description, posts: [],
  });
  const cats = [
    mkCat('برنامه‌نویسی', 'مطالب دربارهٔ زبان‌ها، فریم‌ورک‌ها و مهندسی نرم‌افزار'),
    mkCat('طراحی', 'رابط کاربری، تجربهٔ کاربری و طراحی بصری'),
    mkCat('هوش مصنوعی', 'یادگیری ماشین، مدل‌های زبانی و کاربردهای عملی'),
    mkCat('سبک زندگی', 'روزمرگی، بهره‌وری و سلامتی'),
    mkCat('Database', 'PostgreSQL, Redis, data modelling and query tuning'),
  ];
  db.categories.push(...cats);

  const mkPost = (title, content, excerpt, catIdx, author, published, views, daysAgo, cover) => {
    const created = new Date(Date.now() - daysAgo * 864e5).toISOString();
    return {
      id: uuid(), title, slug: slugify(title), content, excerpt,
      coverImage: cover ? mediaUrl('cover', cover) : null,
      published, authorId: author.id, viewCount: views,
      createdAt: created, updatedAt: created,
      _cats: catIdx.map((i) => cats[i].id),
    };
  };

  const p = (t, c, e, ci, a, pub, v, d, cov) => mkPost(t, c, e, ci, a, pub, v, d, cov);

  db.posts.push(
    p('چطور یک API امن با NestJS بسازیم',
`امنیت API یکی از مهم‌ترین دغدغه‌های هر توسعه‌دهندهٔ بک‌اند است. در این نوشته یک معماری کامل احراز هویت را قدم‌به‌قدم پیاده‌سازی می‌کنیم.

## چرا JWT؟

توکن‌های JWT به ما امکان می‌دهند状态less باشیم؛ یعنی سرور نیازی ندارد هر بار به دیتابیس نگاه کند. اما همین ویژگی، مسئولیت بزرگی هم ایجاد می‌کند: **اگر توکن لو برود، تا زمان انقضا معتبر است.**

## راه‌حل: سشن در Redis

ما هر بار که توکن رفرش صادر می‌کنیم، یک \`sessionId\` هم می‌سازیم و آن را در Redis ذخیره می‌کنیم. با این کار:

1. می‌توانیم یک دستگاه خاص را لاگ‌اوت کنیم
2. می‌توانیم همهٔ دستگاه‌ها را یک‌جا لاگ‌اوت کنیم
3. انقضای توکن اکسس را کوتاه نگه می‌داریم (۱۵ دقیقه) بدون اینکه کاربر اذیت شود

## جمع‌بندی

ترکیب اکسس توکن کوتاه‌مدت + رفرش توکن بلندمدت + سشن در Redis، یکی از متداول‌ترین و مطمئن‌ترین الگوهاست.`,
      'ترکیب اکسس توکن کوتاه‌مدت، رفرش توکن و سشن‌های Redis برای ساختن یک احراز هویت امن.',
      [0, 4], admin, true, 1284, 2, 'security'),

    p('راهنمای کامل Tailwind CSS نسخهٔ ۴',
`Tailwind CSS نسخهٔ ۴ یک بازنویسی کامل موتور است. سرعت بیلد تا چند برابر بهتر شده و پیکربندی حالا مستقیم در CSS انجام می‌شود.

## چه چیزی عوض شد؟

- فایل \`tailwind.config.js\` دیگر اجباری نیست
- تم‌ها با \`@theme\` در CSS تعریف می‌شوند
- پشتیبانی بومی از RTL با واریانت‌های \`rtl:\` و \`ltr:\`
- استفاده از ویژگی‌های مدرن CSS مثل \`oklch\` و container queries

## RTL دیگر کابوس نیست

با propertyهای منطقی (\`ms-\`, \`me-\`, \`ps-\`, \`pe-\`, \`start-\`, \`end-\`) یک کد برای هر دو جهت کار می‌کند. فقط کافی است \`dir="rtl"\` را روی \`<html>\` بگذارید.`,
      'موتور جدید، پیکربندی درون CSS و پشتیبانی بومی از RTL — همه‌چیز دربارهٔ Tailwind 4.',
      [0, 1], sara, true, 892, 5, 'tailwind'),

    p('پستگرس یا MySQL؟ یک مقایسهٔ عملی',
`انتخاب دیتابیس رابطه‌ای همیشه به زمینهٔ پروژه بستگی دارد. بیایید بدون تعصب مقایسه کنیم.

## JSON

پستگرس با \`jsonb\` و ایندکس GIN عملاً یک دیتابیس نیمه‌ساختاریافته هم هست. اگر بخشی از داده‌هایتان ساختار ثابتی ندارد، این یک برتری بزرگ است.

## ایندکس‌ها

پستگرس انواع ایندکس بیشتری دارد: BRIN، GiST، GIN و partial index. برای جداول بزرگ و دادهٔ زمانی، BRIN معجزه می‌کند.`,
      'JSONB، انواع ایندکس و عملکرد — کدام دیتابیس برای پروژهٔ شما مناسب‌تر است؟',
      [4], admin, true, 2103, 9, 'postgres'),

    p('طراحی فرم‌های دوزبانه: چالش‌های RTL',
`وقتی یک رابط باید هم فارسی باشد هم انگلیسی، فقط ترجمهٔ متن‌ها کافی نیست. کل چیدمان باید آینه شود.

## اشتباهات رایج

- استفاده از \`left\` و \`right\` به‌جای \`start\` و \`end\`
- فراموش کردن جهت آیکون‌ها (فلش «بعدی» در RTL باید برعکس شود)
- فونت نامناسب برای فارسی — Vazirmatn انتخاب خوبی است
- اعداد: تصمیم بگیرید فارسی یا لاتین، و **یکدست** باشید

## راه‌حل ما

در این پروژه از \`next-intl\` استفاده کردیم و \`dir\` را روی تگ \`<html>\` به‌صورت پویا تنظیم می‌کنیم. Tailwind هم بقیهٔ کار را با propertyهای منطقی انجام می‌دهد.`,
      'از فونت و آیکون تا چیدمان آینه‌ای — هر آنچه برای یک رابط دوزبانه لازم دارید.',
      [1], sara, true, 654, 12, 'rtl-design'),

    p('Understanding React Server Components',
`Server Components are the biggest shift in React's mental model since hooks. They are not "just SSR".

## The key insight

A Server Component never ships its JavaScript to the browser. It renders on the server, and only the resulting *serialised UI* is sent over the wire.

## When to use which

| Need | Use |
|---|---|
| Fetch data close to the source | Server Component |
| Respond to user input | Client Component |
| Access browser APIs | Client Component |
| Keep bundle small | Server Component |

## The gotcha

You cannot pass a function as a prop from a Server Component to a Client Component — it is not serialisable. This single rule shapes most of your architecture.`,
      'Server Components are not just SSR. Here is the mental model that actually clicks.',
      [0], ali, true, 1876, 3, 'rsc'),

    p('Redis as a cache: invalidation strategies',
`There are only two hard problems in computer science, and cache invalidation is one of them.

## The three common strategies

**1. TTL-only** — simple, but stale data is guaranteed for the whole window.

**2. Write-through** — update the cache whenever you write to the database. Accurate, but couples your write path to Redis.

**3. Invalidate-on-write** — delete the affected keys after a mutation. This is what most production apps do.

## List caches are the tricky part

A single post can appear in dozens of paginated list caches. The pragmatic answer is a *namespace version*: bump one counter and every list key derived from it misses.`,
      'TTL, write-through or invalidate-on-write? A practical guide to keeping your cache honest.',
      [4, 0], ali, true, 1432, 7, 'redis'),

    p('یادگیری ماشین برای توسعه‌دهندهٔ وب',
`لازم نیست ریاضیدان باشید تا از هوش مصنوعی در محصولتان استفاده کنید. بیشترِ کار، مهندسی است نه آکادمیک.

## از کجا شروع کنیم؟

1. با یک API آماده شروع کنید، نه با آموزش مدل
2. مشکل را کوچک تعریف کنید
3. دادهٔ تمیز جمع کنید — این ۸۰٪ کار است
4. یک baseline ساده بسازید و بعد بهبودش دهید

## هشدار

هیچ‌وقت مدل را بدون ارزیابی وارد پروداکشن نکنید. یک مجموعهٔ تست کوچک اما واقعی، از هر ادعایی معتبرتر است.`,
      'مسیر عملی ورود به ML برای کسی که وب توسعه می‌دهد، نه برای پژوهشگر.',
      [2], admin, true, 987, 14, 'ml'),

    p('بهره‌وری: چرا فهرست کارهایتان کار نمی‌کند',
`فهرست کارها معمولاً به یک لیست بی‌پایان از آرزوها تبدیل می‌شود. مشکل از ابزار نیست، از روش است.

## سه قانون ساده

**قانون اول:** هر کاری که زیر دو دقیقه است، همان لحظه انجامش بده.

**قانون دوم:** هر روز فقط سه کار مهم انتخاب کن. نه ده تا.

**قانون سوم:** لیست را هفته‌ای یک‌بار بازبینی کن و هرچه کهنه شده را حذف کن.`,
      'سه قانون ساده که فهرست کارهایتان را از یک بارِ روانی به یک ابزار واقعی تبدیل می‌کند.',
      [3], sara, true, 543, 18, 'productivity'),

    p('TypeScript tips that changed how I code',
`A handful of TypeScript features disproportionately improve the quality of a codebase.

## Discriminated unions

Model state as a union, not as a bag of optional booleans. \`{ status: 'loading' } | { status: 'error', error: Error } | { status: 'ok', data: T }\` makes illegal states unrepresentable.

## const assertions

\`as const\` gives you literal types where you need them, without writing them twice.

## satisfies

The operator everyone overlooked. It checks a value against a type *without widening it* — you keep the narrow literal types and still get validation.`,
      'Discriminated unions, const assertions and the satisfies operator — three features worth mastering.',
      [0], ali, true, 1650, 21, 'typescript'),

    p('معماری شش‌ضلعی در عمل',
`معماری شش‌ضلعی (Hexagonal) ایدهٔ ساده‌ای دارد: منطق کسب‌وکار نباید بداند دیتابیس چیست.

*(این نوشته هنوز پیش‌نویس است و منتشر نشده.)*`,
      'چطور دامنهٔ برنامه را از جزئیات زیرساخت جدا کنیم.',
      [0], admin, false, 0, 1, 'hexagonal'),

    p('Designing for dark mode from day one',
`Dark mode is not "invert the colours". It is a second design system.

*(Draft — work in progress.)*`,
      'A practical checklist for shipping a dark theme that does not look like an afterthought.',
      [1], sara, false, 0, 4, 'darkmode'),
  );

  // Comments — note the real backend returns these FLAT (only `author` is eager-loaded),
  // so the frontend must build the reply tree from parentId itself.
  const mkComment = (postIdx, author, content, parentIdx = null, hoursAgo = 10) => {
    const created = new Date(Date.now() - hoursAgo * 36e5).toISOString();
    return {
      id: uuid(), content, authorId: author.id, author: publicUser(author),
      postId: db.posts[postIdx].id, parentId: parentIdx === null ? null : null,
      createdAt: created, updatedAt: created,
      _parentRef: parentIdx,
    };
  };

  const c0 = mkComment(0, sara, 'خیلی عالی بود! مخصوصاً بخش سشن در Redis. یه سوال: اگه Redis دان بشه چه اتفاقی می‌افته؟', null, 40);
  const c1 = mkComment(0, admin, 'ممنون سارا جان. در اون حالت همهٔ درخواست‌های محافظت‌شده ۴۰۱ می‌گیرن. برای همین بهتره Redis رو با Sentinel یا کلاستر بالا بیاری.', null, 38);
  const c2 = mkComment(0, ali, 'Great write-up. We use the exact same pattern in production and it has held up well.', null, 30);
  db.comments.push(c0, c1, c2);
  c1.parentId = c0.id;
  db.comments.push(mkComment(4, sara, 'The "no functions across the boundary" rule took me a while to internalise. Thanks for spelling it out.', null, 20));
  db.comments.push(mkComment(4, ali, 'Same here. Once it clicks, your component tree gets dramatically simpler.', null, 18));
  db.comments.push(mkComment(1, ali, 'منتظر قسمت دومش هستم. مخصوصاً بخش container queries.', null, 60));
  db.comments.push(mkComment(2, sara, 'مقایسهٔ JSONB واقعاً منصفانه بود. 👌', null, 100));

  // Fix the reply relationship set up above
  db.comments.forEach((c) => { delete c._parentRef; });
  db.posts.forEach((post) => { delete post._cats; });

  // Attach categories to posts (ManyToMany)
  const catIds = [
    [0, 4], [0, 1], [4], [1], [0], [4, 0], [2], [3], [0], [0], [1],
  ];
  db.posts.forEach((post, i) => {
    post.categories = (catIds[i] ?? []).map((ci) => db.categories[ci]).filter(Boolean);
  });
}
seed();

/* ─────────────────────────── app ─────────────────────────── */
const app = express();
app.disable('x-powered-by');

// Body parsing. Uploads are buffered raw so we don't need multer.
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/')) {
    express.raw({ type: () => true, limit: '10mb' })(req, res, next);
  } else {
    express.json({ limit: '2mb' })(req, res, next);
  }
});

/* Optional strict throttling — reproduces the backend's global 10 req/60s guard. */
if (THROTTLE) {
  const hits = new Map();
  app.use((req, res, next) => {
    const key = req.ip;
    const t = Date.now();
    const list = (hits.get(key) ?? []).filter((x) => t - x < 60_000);
    list.push(t);
    hits.set(key, list);
    if (list.length > 10) {
      return res.status(429).json({
        statusCode: 429,
        message: { en: 'Too many requests', fa: 'درخواست‌های بیش از حد' },
        timestamp: now(),
      });
    }
    next();
  });
}

/* ── auth guards ── */
function bearer(req) {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Mirrors JwtAuthGuard + JwtStrategy.validate (checks the Redis session too). */
function requireAuth(req, res, next) {
  const payload = verifyJwt(bearer(req), JWT_SECRET);
  if (!payload) {
    if (payload && payload.expired) {
      return httpError(res, 401, 'jwt expired', null);
    }
    return httpError(res, 401, 'Unauthorized', 'لطفاً وارد شوید');
  }
  if (!db.sessions.has(`${payload.id}:${payload.sessionId}`)) {
    return httpError(res, 401, 'Invalid session or refresh token', 'جلسه یا توکن تازه‌سازی نامعتبر است');
  }
  const user = db.users.find((u) => u.id === payload.id);
  if (!user) return httpError(res, 404, 'User not found', 'کاربر یافت نشد');
  req.user = { ...user, sessionId: payload.sessionId };
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return httpError(res, 403, 'Access denied', 'دسترسی مجاز نیست');
    }
    next();
  };
}

/** Mirrors JwtRefreshAuthGuard. */
function requireRefresh(req, res, next) {
  const token = bearer(req);
  const payload = verifyJwt(token, JWT_REFRESH_SECRET);
  if (!payload) return httpError(res, 401, 'Invalid session or refresh token', 'جلسه یا توکن تازه‌سازی نامعتبر است');
  req.user = { ...payload, refreshToken: token };
  next();
}

/* ── token generation (mirrors AuthService.generateToken) ── */
function generateTokens(user, meta = {}) {
  const sessionId = uuid();
  const payload = { id: user.id, email: user.email, sessionId };
  const accessToken = signJwt(payload, JWT_SECRET, ACCESS_TTL);
  const refreshToken = signJwt(payload, JWT_REFRESH_SECRET, REFRESH_TTL);
  db.sessions.set(`${user.id}:${sessionId}`, {
    userId: user.id, refreshToken, createdAt: now(),
    ip: meta.ip, userAgent: meta.userAgent,
  });
  return { accessToken, refreshToken };
}

/* ── tiny validators (mirror class-validator + forbidNonWhitelisted) ── */
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isUUID = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Rejects unknown keys exactly like ValidationPipe({ whitelist, forbidNonWhitelisted }).
 * This matters: the real backend answers 400 if the frontend sends an extra field.
 */
function forbidUnknown(body, allowed) {
  return Object.keys(body ?? {}).filter((k) => !allowed.includes(k));
}

/* ══════════════════════════ ROUTES ══════════════════════════ */

app.get('/', (_req, res) => res.type('text/plain').send('Hello World!'));

/* ── generated artwork so the offline preview shows images ── */
const PALETTES = [
  ['#6366f1', '#a855f7'], ['#0ea5e9', '#22d3ee'], ['#f59e0b', '#ef4444'],
  ['#10b981', '#0ea5e9'], ['#8b5cf6', '#ec4899'], ['#14b8a6', '#84cc16'],
  ['#f43f5e', '#fb923c'], ['#3b82f6', '#8b5cf6'],
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

app.get('/img/cover/:seed.svg', (req, res) => {
  const seed = decodeURIComponent(req.params.seed);
  const [c1, c2] = PALETTES[hashStr(seed) % PALETTES.length];
  const id = `g${hashStr(seed) % 9999}`;
  res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#${id})"/>
<g fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2">
${Array.from({ length: 9 }, (_, i) => `<circle cx="${120 + i * 120}" cy="${100 + ((hashStr(seed) >> i) % 400)}" r="${30 + ((hashStr(seed) >> i) % 90)}"/>`).join('')}
</g>
<text x="60" y="560" font-family="ui-sans-serif,system-ui,sans-serif" font-size="42" font-weight="700" fill="rgba(255,255,255,.92)">${seed.replace(/[<>&]/g, '')}</text>
</svg>`);
});

app.get('/img/avatar/:seed.svg', (req, res) => {
  const seed = decodeURIComponent(req.params.seed);
  const [c1, c2] = PALETTES[hashStr(seed) % PALETTES.length];
  const initials = seed.slice(0, 2).toUpperCase();
  res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
<circle cx="60" cy="60" r="60" fill="url(#a)"/>
<text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-family="ui-sans-serif,system-ui,sans-serif" font-size="46" font-weight="700" fill="#fff">${initials}</text>
</svg>`);
});

/* ══════════════ AUTH ══════════════ */
app.post('/auth/register', (req, res) => {
  const allowed = ['name', 'email', 'password', 'confirmPassword'];
  const unknown = forbidUnknown(req.body, allowed);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const errs = [];
  const { name, email, password, confirmPassword } = req.body ?? {};
  if (!name || typeof name !== 'string') errs.push('name should not be empty', 'name must be a string');
  if (!email || !isEmail(email)) errs.push('email must be an email', 'email should not be empty');
  if (!password || password.length < 6) errs.push('password must be longer than or equal to 6 characters');
  if (!confirmPassword) errs.push('confirmPassword should not be empty');
  else if (confirmPassword !== password) errs.push('Confirm password must match password');
  if (errs.length) return validationError(res, errs);
  if (db.users.some((u) => u.email === email)) {
    return httpError(res, 409, 'Email already exists', 'ایمیل قبلاً استفاده شده است');
  }

  const user = {
    id: uuid(), name, email, password, role: 'user', bio: null, avatar: mediaUrl('avatar', name.slice(0, 8)),
    createdAt: now(), updatedAt: now(),
  };
  db.users.push(user);
  const tokens = generateTokens(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
  return res.json(ok('User created successfully', 'کاربر با موفقیت ایجاد شد', { user: publicUser(user), ...tokens }));
});

app.post('/auth/login', (req, res) => {
  const unknown = forbidUnknown(req.body, ['email', 'password']);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const { email, password } = req.body ?? {};
  const errs = [];
  if (!email || !isEmail(email)) errs.push('email must be an email');
  if (!password || String(password).length < 6) errs.push('password must be longer than or equal to 6 characters');
  if (errs.length) return validationError(res, errs);

  const user = db.users.find((u) => u.email === email);
  if (!user || user.password !== password) {
    return httpError(res, 400, 'Invalid credentials', 'اطلاعات ورود نامعتبر است');
  }
  const tokens = generateTokens(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
  return res.json(ok('Login successful', 'با موفقیت وارد شدید', { user: publicUser(user), ...tokens }));
});

app.get('/auth/me', requireAuth, (req, res) =>
  res.json(ok('Profile retrieved successfully', 'پروفایل با موفقیت بازیابی شد', publicUser(req.user))),
);

app.post('/auth/refresh', requireRefresh, (req, res) => {
  const { id, sessionId, refreshToken } = req.user;
  const stored = db.sessions.get(`${id}:${sessionId}`);
  if (!stored || stored.refreshToken !== refreshToken) {
    return httpError(res, 401, 'Invalid session or refresh token', 'جلسه یا توکن تازه‌سازی نامعتبر است');
  }
  const user = db.users.find((u) => u.id === id);
  if (!user) return httpError(res, 404, 'User not found', 'کاربر یافت نشد');
  db.sessions.delete(`${id}:${sessionId}`); // rotation, exactly like the real service
  const tokens = generateTokens(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
  return res.json(ok('Token refreshed successfully', 'توکن جدبد با موفقیت ساخته شد', tokens));
});

app.post('/auth/logout', requireAuth, (req, res) => {
  db.sessions.delete(`${req.user.id}:${req.user.sessionId}`);
  return res.json(ok('Logged out successfully', 'با موفقیت خارج شد'));
});

/* ══════════════ POSTS ══════════════ */
const attach = (post) => ({
  ...post,
  author: publicUser(db.users.find((u) => u.id === post.authorId)) ?? null,
  categories: post.categories ?? [],
});

app.post('/post', requireAuth, (req, res) => {
  const allowed = ['title', 'content', 'excerpt', 'coverImage', 'published', 'categories'];
  const unknown = forbidUnknown(req.body, allowed);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const { title, content, excerpt, coverImage, published, categories } = req.body ?? {};
  const errs = [];
  if (!title) errs.push('title should not be empty');
  else if (String(title).length > 200) errs.push('title must be shorter than or equal to 200 characters');
  if (!content) errs.push('content should not be empty');
  if (excerpt && String(excerpt).length > 300) errs.push('excerpt must be shorter than or equal to 300 characters');
  if (published !== undefined && typeof published !== 'boolean') errs.push('published must be a boolean');
  if (categories && (!Array.isArray(categories) || categories.some((c) => !isUUID(c)))) {
    errs.push('each value in categories must be a UUID');
  }
  if (errs.length) return validationError(res, errs);

  const chosen = categories?.length
    ? db.categories.filter((c) => categories.includes(c.id))
    : [];
  if (categories?.length && chosen.length !== categories.length) {
    return httpError(res, 404, 'One or more categories not found', 'یک یا چند دسته‌بندی یافت نشد');
  }

  const base = slugify(title);
  let slug = base, n = 1;
  while (db.posts.some((p) => p.slug === slug)) slug = `${base}-${++n}`;

  const post = {
    id: uuid(), title, slug, content, excerpt: excerpt ?? null,
    coverImage: coverImage ?? null, published: published ?? false,
    authorId: req.user.id, categories: chosen, viewCount: 0,
    createdAt: now(), updatedAt: now(),
  };
  db.posts.unshift(post);
  return res.json(ok('New post created successfully', 'پست جدید با موفقیت ایجاد شد', attach(post)));
});

/** GET /post — note: NO envelope, and published defaults to true. */
app.get('/post', (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.max(1, Number(req.query.limit ?? 10) || 10);
  const publishedRaw = req.query.published;
  const published = publishedRaw === undefined ? true : !(publishedRaw === 'false' || publishedRaw === false);
  const category = req.query.category;

  let rows = db.posts.filter((p) => p.published === published);
  if (category) rows = rows.filter((p) => (p.categories ?? []).some((c) => c.slug === category));
  rows = rows.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = rows.length;
  const data = rows.slice((page - 1) * limit, page * limit).map(attach);
  res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } });
});

/** GET /post/my — the real backend does NOT eager-load author/categories here. */
app.get('/post/my', requireAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.max(1, Number(req.query.limit ?? 10) || 10);
  const rows = db.posts
    .filter((p) => p.authorId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = rows.length;
  const data = rows.slice((page - 1) * limit, page * limit).map((p) => ({ ...p, categories: p.categories ?? [] }));
  res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } });
});

app.get('/post/:slug', (req, res) => {
  const post = db.posts.find((p) => p.slug === req.params.slug);
  if (!post) return httpError(res, 404, 'Post not found', null);
  post.viewCount += 1; // the real service increments on read
  return res.json(ok('Post retrieved successfully', 'پست با موفقیت بازیابی شد', attach(post)));
});

app.patch('/post/:id', requireAuth, (req, res) => {
  const allowed = ['title', 'content', 'excerpt', 'coverImage', 'published', 'categories'];
  const unknown = forbidUnknown(req.body, allowed);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const post = db.posts.find((p) => p.id === req.params.id);
  if (!post) return httpError(res, 404, 'Post not found', null);
  if (post.authorId !== req.user.id && req.user.role !== 'admin') {
    return httpError(res, 403, 'You are not allowed to modify this post', null);
  }

  const { title, content, excerpt, coverImage, published, categories } = req.body ?? {};
  if (excerpt !== undefined && excerpt !== null && String(excerpt).length > 300) {
    return validationError(res, ['excerpt must be shorter than or equal to 300 characters']);
  }
  if (categories && (!Array.isArray(categories) || categories.some((c) => !isUUID(c)))) {
    return validationError(res, ['each value in categories must be a UUID']);
  }

  if (title && title !== post.title) {
    const base = slugify(title);
    let slug = base, n = 1;
    while (db.posts.some((p) => p.slug === slug && p.id !== post.id)) slug = `${base}-${++n}`;
    post.slug = slug;
    post.title = title;
  }
  if (content !== undefined) post.content = content;
  if (excerpt !== undefined) post.excerpt = excerpt;
  if (coverImage !== undefined) post.coverImage = coverImage;
  if (published !== undefined) post.published = published;
  if (categories) {
    const chosen = db.categories.filter((c) => categories.includes(c.id));
    if (chosen.length !== categories.length) {
      return httpError(res, 404, 'One or more categories not found', 'یک یا چند دسته‌بندی یافت نشد');
    }
    post.categories = chosen;
  }
  post.updatedAt = now();
  return res.json(ok('Post updated successfully', 'پست با موفقیت به‌روزرسانی شد', attach(post)));
});

app.delete('/post/:id', requireAuth, (req, res) => {
  const idx = db.posts.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return httpError(res, 404, 'Post not found', null);
  const post = db.posts[idx];
  if (post.authorId !== req.user.id && req.user.role !== 'admin') {
    return httpError(res, 403, 'You are not allowed to modify this post', null);
  }
  db.posts.splice(idx, 1);
  db.comments = db.comments.filter((c) => c.postId !== post.id); // onDelete: CASCADE
  return res.json(ok('Post deleted successfully', 'پست با موفقیت حذف شد'));
});

/* ══════════════ CATEGORIES ══════════════ */
app.post('/categories', requireAuth, requireRoles('admin'), (req, res) => {
  const unknown = forbidUnknown(req.body, ['name', 'description']);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const { name, description } = req.body ?? {};
  const errs = [];
  if (!name) errs.push('name should not be empty');
  else if (String(name).length > 50) errs.push('name must be shorter than or equal to 50 characters');
  if (description && String(description).length > 200) errs.push('description must be shorter than or equal to 200 characters');
  if (errs.length) return validationError(res, errs);
  if (db.categories.some((c) => c.name === name)) {
    return httpError(res, 409, 'Category already exists', 'دسته‌بندی قبلاً ایجاد شده است');
  }

  const base = slugify(name);
  let slug = base, n = 1;
  while (db.categories.some((c) => c.slug === slug)) slug = `${base}-${++n}`;

  const category = { id: uuid(), name, slug, description: description ?? null, posts: [] };
  db.categories.push(category);
  return res.json(ok('Category created successfully', 'دسته‌بندی با موفقیت ایجاد شد', category));
});

/** GET /categories — note the extra `data.categories` nesting. */
app.get('/categories', (_req, res) =>
  res.json(ok('Categories retrieved successfully', 'دسته‌بندی‌ها با موفقیت بازیابی شدند', { categories: db.categories })),
);

app.get('/categories/:slug', (req, res) => {
  const category = db.categories.find((c) => c.slug === req.params.slug);
  if (!category) return httpError(res, 404, 'Category not found', 'دسته‌بندی یافت نشد');
  const posts = db.posts.filter((p) => (p.categories ?? []).some((c) => c.id === category.id));
  return res.json(ok('Category retrieved successfully', 'دسته‌بندی با موفقیت بازیابی شد', { ...category, posts }));
});

app.patch('/categories/:id', requireAuth, requireRoles('admin'), (req, res) => {
  const unknown = forbidUnknown(req.body, ['name', 'description']);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const category = db.categories.find((c) => c.id === req.params.id);
  if (!category) return httpError(res, 404, 'Category not found', 'دسته‌بندی یافت نشد');
  const { name, description } = req.body ?? {};
  if (name && name !== category.name) {
    const base = slugify(name);
    let slug = base, n = 1;
    while (db.categories.some((c) => c.slug === slug && c.id !== category.id)) slug = `${base}-${++n}`;
    category.slug = slug;
    category.name = name;
  }
  if (description !== undefined) category.description = description;
  return res.json(ok('Category updated successfully', 'دسته‌بندی با موفقیت به‌روزرسانی شد', category));
});

app.delete('/categories/:id', requireAuth, requireRoles('admin'), (req, res) => {
  const idx = db.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return httpError(res, 404, 'Category not found', 'دسته‌بندی یافت نشد');
  const [removed] = db.categories.splice(idx, 1);
  db.posts.forEach((p) => { p.categories = (p.categories ?? []).filter((c) => c.id !== removed.id); });
  return res.json(ok('Category deleted successfully', 'دسته‌بندی با موفقیت حذف شد'));
});

/* ══════════════ COMMENTS ══════════════ */
app.post('/posts/:postId/comments', requireAuth, (req, res) => {
  const unknown = forbidUnknown(req.body, ['content', 'parentId']);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const post = db.posts.find((p) => p.id === req.params.postId);
  if (!post) return httpError(res, 404, 'Post not found', null);

  const { content, parentId } = req.body ?? {};
  const errs = [];
  if (!content) errs.push('content should not be empty');
  else if (String(content).length > 1000) errs.push('content must be shorter than or equal to 1000 characters');
  if (errs.length) return validationError(res, errs);
  if (parentId && !db.comments.some((c) => c.id === parentId)) {
    return httpError(res, 404, 'Comment not found', 'کامنت یافت نشد');
  }

  const comment = {
    id: uuid(), content, authorId: req.user.id, author: publicUser(req.user),
    postId: post.id, parentId: parentId ?? null, createdAt: now(), updatedAt: now(),
  };
  db.comments.unshift(comment);
  return res.json(ok('comment created successfuly', 'کامنت با موفقیت ساخته شد.', comment));
});

/** Returns a FLAT list — the reply tree is built on the frontend from parentId. */
app.get('/posts/:postId/comments', (req, res) => {
  const post = db.posts.find((p) => p.id === req.params.postId);
  if (!post) return httpError(res, 404, 'Post not found', null);
  const rows = db.comments
    .filter((c) => c.postId === post.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json(ok('comments retrieved successfully', 'کامت ها با موفقیت بازیابی شد.', rows));
});

app.patch('/comments/:id', requireAuth, (req, res) => {
  const unknown = forbidUnknown(req.body, ['content']);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const comment = db.comments.find((c) => c.id === req.params.id);
  if (!comment) return httpError(res, 404, 'Comment not found', 'کامنت یافت نشد');
  if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
    return httpError(res, 403, 'Access denied', 'دسترسی مجاز نیست');
  }
  const { content } = req.body ?? {};
  if (!content) return validationError(res, ['content should not be empty']);
  if (String(content).length > 1000) {
    return validationError(res, ['content must be shorter than or equal to 1000 characters']);
  }
  comment.content = content;
  comment.updatedAt = now();
  return res.json(ok('comment updated successfuly.', 'کامنت با موفقیت آپدیت شد.', comment));
});

app.delete('/comments/:id', requireAuth, (req, res) => {
  const comment = db.comments.find((c) => c.id === req.params.id);
  if (!comment) return httpError(res, 404, 'Comment not found', 'کامنت یافت نشد');
  if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
    return httpError(res, 403, 'Access denied', 'دسترسی مجاز نیست');
  }
  const kill = new Set([comment.id]);
  let grew = true;
  while (grew) {
    grew = false;
    db.comments.forEach((c) => {
      if (c.parentId && kill.has(c.parentId) && !kill.has(c.id)) { kill.add(c.id); grew = true; }
    });
  }
  db.comments = db.comments.filter((c) => !kill.has(c.id)); // onDelete: CASCADE
  return res.json(ok('comment removed successfully', 'کامنت با موفقیت حذف شد.'));
});

/* ══════════════ USERS ══════════════ */
app.post('/users', requireAuth, requireRoles('admin'), (req, res) => {
  const allowed = ['name', 'email', 'password', 'confirmPassword', 'role', 'bio'];
  const unknown = forbidUnknown(req.body, allowed);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const { name, email, password, confirmPassword, role, bio } = req.body ?? {};
  const errs = [];
  if (!name) errs.push('name should not be empty');
  if (!email || !isEmail(email)) errs.push('email must be an email');
  if (!password || String(password).length < 6) errs.push('password must be longer than or equal to 6 characters');
  if (confirmPassword !== password) errs.push('Confirm password must match password');
  if (role && !['admin', 'user', 'guest'].includes(role)) errs.push('Role must be either admin, user, or guest');
  if (errs.length) return validationError(res, errs);
  if (db.users.some((u) => u.email === email)) {
    return httpError(res, 409, 'Email already exists', 'ایمیل قبلاً استفاده شده است');
  }

  const user = {
    id: uuid(), name, email, password, role: role ?? 'user', bio: bio ?? null,
    avatar: mediaUrl('avatar', name.slice(0, 8)), createdAt: now(), updatedAt: now(),
  };
  db.users.push(user);
  return res.json(ok('User created successfully', 'کاربر با موفقیت ایجاد شد', publicUser(user)));
});

/** GET /users — the real backend returns a RAW array here, no envelope. */
app.get('/users', requireAuth, requireRoles('admin'), (_req, res) =>
  res.json(db.users.map(publicUser)),
);

// Declared before /users/:id so "me" is never parsed as an id.
app.patch('/users/me/password', requireAuth, (req, res) => {
  const unknown = forbidUnknown(req.body, ['currentPassword', 'newPassword', 'confirmNewPassword']);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};
  const errs = [];
  if (!currentPassword || String(currentPassword).length < 6) errs.push('currentPassword must be longer than or equal to 6 characters');
  if (!newPassword || String(newPassword).length < 6) errs.push('newPassword must be longer than or equal to 6 characters');
  if (confirmNewPassword !== newPassword) errs.push('Confirm new password must match new password');
  if (errs.length) return validationError(res, errs);

  const user = db.users.find((u) => u.id === req.user.id);
  if (user.password !== currentPassword) {
    return httpError(res, 400, 'password is incorrect', 'رمز عبور نادرست است');
  }
  if (currentPassword === newPassword) {
    return httpError(res, 409, 'New password cannot be the same as the current password', 'رمز عبور جدید نمی‌تواند با رمز عبور فعلی یکسان باشد');
  }
  user.password = newPassword;
  user.updatedAt = now();
  return res.json(ok('Password updated successfully', 'رمز عبور با موفقیت به‌روزرسانی شد'));
});

app.get('/users/:id', requireAuth, (req, res) => {
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return httpError(res, 404, 'User not found', 'کاربر یافت نشد');
  return res.json(ok('User retrieved successfully', 'کاربر با موفقیت بازیابی شد', publicUser(user)));
});

app.patch('/users/:id', requireAuth, (req, res) => {
  // UpdateUserDto = Partial(Omit(CreateUserDto, email|password|confirmPassword))
  const allowed = ['name', 'role', 'bio', 'avatar'];
  const unknown = forbidUnknown(req.body, allowed);
  if (unknown.length) return validationError(res, [`property ${unknown.join(', ')} should not exist`]);

  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return httpError(res, 404, 'User not found', 'کاربر یافت نشد');
  if (req.body.role && !['admin', 'user', 'guest'].includes(req.body.role)) {
    return validationError(res, ['Role must be either admin, user, or guest']);
  }
  if (req.body.role && req.user.role !== 'admin' && req.body.role !== user.role) {
    return httpError(res, 403, 'Access denied', 'دسترسی مجاز نیست');
  }
  Object.assign(user, req.body, { updatedAt: now() });
  return res.json(ok('User updated successfully', 'کاربر با موفقیت به‌روزرسانی شد', publicUser(user)));
});

app.delete('/users/:id', requireAuth, requireRoles('admin'), (req, res) => {
  const idx = db.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return httpError(res, 404, 'User not found', 'کاربر یافت نشد');
  db.users.splice(idx, 1);
  return res.json(ok('User deleted successfully', 'کاربر با موفقیت حذف شد'));
});

/* ══════════════ UPLOADS ══════════════ */
const MAX_FILE = 5 * 1024 * 1024;

function handleUpload(kind) {
  return (req, res) => {
    if (!req.body || req.body.length === 0) {
      return validationError(res, ['file should not be empty']);
    }
    if (req.body.length > MAX_FILE) {
      return httpError(res, 400, 'File too large (max 5MB)', 'حجم فایل بیش از حد مجاز است');
    }
    const seed = `${kind}-${Date.now().toString(36)}`;
    const url = mediaUrl(kind === 'avatar' ? 'avatar' : 'cover', seed);
    if (kind === 'avatar') {
      const user = db.users.find((u) => u.id === req.user.id);
      if (user) user.avatar = url;
    }
    const msg = kind === 'avatar'
      ? ['Avatar uploaded successfully', 'عکس پروفایل با موفقیت آپلود شد']
      : ['Cover image uploaded successfully', 'تصویر کاور با موفقیت آپلود شد'];
    return res.json(ok(msg[0], msg[1], { url }));
  };
}

app.post('/uploads/avatar', requireAuth, handleUpload('avatar'));
app.post('/uploads/cover', requireAuth, handleUpload('cover'));

/* ── diagnostics (mock only — not part of the real API) ── */
app.get('/__mock/health', (_req, res) =>
  res.json({
    ok: true, mock: true,
    counts: { users: db.users.length, posts: db.posts.length, categories: db.categories.length, comments: db.comments.length },
    sessions: db.sessions.size,
  }),
);
app.post('/__mock/reset', (_req, res) => {
  db.users = []; db.categories = []; db.posts = []; db.comments = []; db.sessions.clear();
  seed();
  res.json({ ok: true, reset: true });
});

/* ── 404 fallback ── */
app.use((req, res) =>
  httpError(res, 404, `Cannot ${req.method} ${req.path}`, null),
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Mock blog API listening on http://127.0.0.1:${PORT}`);
  console.log(`  Seeded: ${db.users.length} users, ${db.posts.length} posts, ${db.categories.length} categories, ${db.comments.length} comments`);
  console.log(`\n  Demo accounts:`);
  console.log(`    admin@blog.dev / admin123   (role: admin)`);
  console.log(`    sara@blog.dev  / sara1234   (role: user)`);
  console.log(`    ali@blog.dev   / ali12345   (role: user)\n`);
});
