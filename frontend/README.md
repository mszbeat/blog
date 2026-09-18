# 📝 Blog Frontend

فرانت‌اند دوزبانه (فارسی/انگلیسی) و راست‌چین برای بک‌اند NestJS پروژه‌ی [`mszbeat/blog`](https://github.com/mszbeat/blog).

**استک:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · next-intl · TanStack Query · React Hook Form + Zod · lucide-react

---

## 🚀 اجرا

### حالت ۱ — با Mock API (بدون نیاز به دیتابیس)

ورک‌اسپیس Postgres/Redis نداره، پس یک Mock API Server همراه پروژه هست که **دقیقاً** قرارداد بک‌اند واقعی رو بازتولید می‌کنه:

```bash
# ترمینال ۱
npm run mock:api        # → http://127.0.0.1:3000

# ترمینال ۲
npm run dev             # → http://localhost:3001
```

یا هر دو با هم:

```bash
npm run dev:all
```

**حساب‌های نمونه:**

| ایمیل | رمز | نقش |
|---|---|---|
| `admin@blog.dev` | `admin123` | admin |
| `sara@blog.dev` | `sara1234` | user |
| `ali@blog.dev` | `ali12345` | user |

> دیتای Mock در حافظه است؛ با `POST /__mock/reset` به حالت اولیه برمی‌گرده.

### حالت ۲ — با بک‌اند واقعی NestJS

```bash
# ۱. بک‌اند رو بالا بیار (Postgres + Redis + Cloudinary لازم داره)
cd ../backend && npm run start:dev      # → http://localhost:3000

# ۲. فرانت رو بهش وصل کن
API_ORIGIN=http://localhost:3000 npm run dev
```

فقط همین یک متغیر. هیچ تغییری در کد لازم نیست.

---

## 🔌 چرا پروکسی؟ (مسئله‌ی CORS)

`src/main.ts` بک‌اند **`app.enableCors()` نداره**. به‌جای دست‌کاری بک‌اند، همه‌ی درخواست‌های مرورگر به `/api/*` می‌رن و Next.js اون‌ها رو proxy می‌کنه:

```
مرورگر  →  /api/post  →  next.config.ts rewrites  →  API_ORIGIN/post
```

نتیجه: **صفر مشکل CORS** در توسعه. برای پروداکشن یا `enableCors()` رو اضافه کن یا یک reverse proxy (nginx) بذار.

---

## 🏗️ معماری

### دو مسیر داده‌ی متفاوت (عمدی)

| نوع صفحه | روش | دلیل |
|---|---|---|
| **عمومی** (خانه، لیست پست، جزئیات پست، دسته‌بندی) | **Server Component** + `src/lib/server-api.ts` | HTML سمت سرور رندر می‌شه → SEO واقعی برای یک بلاگ |
| **محافظت‌شده** (داشبورد، ادمین، ورود، پروفایل) | **Client Component** + TanStack Query | توکن‌ها در localStorage هستن (Bearer، نه کوکی) |

صفحات عمومی مستقیم به `API_ORIGIN` وصل می‌شن (server-to-server، پس CORS مطرح نیست). صفحه‌ی جزئیات پست `generateMetadata` داره → `<title>`، `og:title`، `og:image` و `article:published_time` همه SSR می‌شن.

### لایه‌ی API — `src/lib/api.ts`

سه چیز رو هندل می‌کنه که این بک‌اند رو خاص می‌کنه:

**۱. دو شکل متفاوت پاسخ موفق**
```ts
// اکثر روت‌ها — envelope دوزبانه
{ message: { en, fa }, data: {...} }

// روت‌های صفحه‌بندی‌شده — بدون envelope!
{ data: [...], meta: { total, page, limit, totalPages } }

// GET /users — آرایه‌ی خام!
[ {...}, {...} ]
```

**۲. دو شکل متفاوت خطا**
```ts
{ statusCode, message: { en, fa }, timestamp }   // خطاهای شناخته‌شده
{ statusCode, message: ["...","..."], timestamp } // ValidationPipe → آرایه!
```
`ApiError.messageFor(locale)` هر دو رو هندل می‌کنه و پیام درست رو بر اساس زبان فعال نشون می‌ده. **چون خود بک‌اند پیام دوزبانه می‌ده، فرانت نیازی به ترجمه‌ی پیام‌های سرور نداره.**

**۳. چرخش توکن (Token Rotation)** — مهم‌ترین نکته

`AuthService.refreshToken()` سشن **قدیمی رو از Redis حذف می‌کنه** و بعد توکن جدید می‌سازه. یعنی بلافاصله بعد از refresh، اکسس توکن قبلی می‌میره. اگه سه درخواست موازی 401 بگیرن و هر سه جدا refresh بزنن، دوتاشون شکست می‌خورن.

راه‌حل: **single-flight refresh queue**

```ts
let refreshInFlight: Promise<boolean> | null = null;
async function refreshTokens() {
  if (refreshInFlight) return refreshInFlight;   // همه‌ی 401ها به یک refresh می‌پیوندن
  refreshInFlight = (async () => { ... })();
}
```

### i18n و RTL

- `next-intl` با `localePrefix: 'always'` → `/fa/...` و `/en/...`
- `<html lang dir>` به‌صورت پویا تنظیم می‌شه
- **فونت‌ها:** `Vazirmatn` برای فارسی، `Inter` برای انگلیسی — هر دو با `next/font` **self-host** می‌شن (پس حتی در پیش‌نمایش آفلاین هم کار می‌کنن)
- **Tailwind v4:** فقط از propertyهای منطقی استفاده شده (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) + واریانت‌های `rtl:`/`ltr:` → یک کد برای هر دو جهت
- اعداد با `Intl.NumberFormat('fa-IR')` فارسی می‌شن (۱۲۳) و تاریخ با تقویم شمسی
- سوییچر زبان در هدر و فوتر، مسیر فعلی رو حفظ می‌کنه

### سیستم طراحی — «Editorial Social» (نسخهٔ ۲)

همه‌ی توکن‌ها در `src/app/globals.css` تعریف شدن؛ هیچ صفحه‌ای رنگ هاردکد نداره.

| توکن / کلاس | کاربرد |
|---|---|
| `--elev-1/2/3` | سه سطح سایه (کارت، منوی بازشو، مودال) — به‌جای `shadow-lg` پراکنده |
| `.card` / `.card-hover` | سطح اصلی محتوا + لیفت ملایم هنگام hover |
| `.chip` / `.chip-active` | برچسب دسته‌بندی و فیلترها (قابل اسکرول افقی در موبایل) |
| `.feed-action` | دکمه‌های نوار اکشن فید (کامنت / اشتراک / ادامه) |
| `.avatar-ring` | حلقهٔ گرادیانی آواتار به سبک استوری اینستاگرام |
| `.glass` | پنل شیشه‌ای روی بنر (backdrop-blur) |
| `.bg-grid` | بافت نقطه‌ای پس‌زمینهٔ hero |
| `.clamp-fade` | محو شدن تدریجی انتهای متن بریده‌شده |
| `.num-en` | ارقام و متن‌های LTR (ایمیل، آمار) داخل چیدمان RTL |

**حالت تاریک:** پس‌زمینهٔ صفحه تیره‌تر از کارت‌هاست تا سلسله‌مراتب سطح‌ها حفظ بشه
(برخلاف تم‌های رایج که همه‌چیز یک خاکستری می‌شه).

**انیمیشن‌ها:** `fade-up` برای کارت‌های فید، `pop` برای تیک کپی‌شدن لینک،
`shimmer` برای اسکلتون‌ها — همه با `prefers-reduced-motion` غیرفعال می‌شن.

---

### 🔒 چرا پروفایل عمومی از پست‌ها ساخته می‌شه؟

`GET /users/:id` در بک‌اند پشت `JwtAuthGuard` است، یعنی کاربر ناشناس **نمی‌تونه**
پروفایل کسی رو بخونه. ولی `GET /post` عمومیه و `author` رو left-join می‌کنه.

پس `getAuthorProfile()` در `src/lib/server-api.ts` یک صفحه از پست‌های عمومی رو
می‌گیره و نویسنده رو از دل همون پست‌ها بازسازی می‌کنه. نتیجه:

- ✅ صفحهٔ `/users/[id]` کاملاً **SSR و crawlable** است (SEO کار می‌کنه)
- ✅ بدون نیاز به هیچ تغییری در بک‌اند
- ⚠️ کاربری که **هیچ پست منتشرشده‌ای نداره** از مسیر عمومی قابل دیدن نیست —
  در این حالت `ProfileAuthFallback` سمت کلاینت با توکن بازدیدکننده تلاش می‌کنه
  و اگر لاگین بود (مخصوصاً خودش یا ادمین) نمای خصوصی رو نشون می‌ده،
  وگرنه یک حالت خالی دوستانه نمایش داده می‌شه (نه ۴۰۴ سخت).

اگر خواستی پروفایل همه‌ی کاربران عمومی بشه، کافیه در بک‌اند
`@Public()` روی `GET /users/:id` بزنی یا یک endpoint سبک مثل
`GET /users/:id/public` اضافه کنی؛ فرانت بدون تغییر کار می‌کنه.

---

### 📊 چرا تعداد کامنت در کارت فید نیست؟

بک‌اند `ThrottlerGuard` سراسری **۱۰ درخواست در دقیقه** داره و endpoint دسته‌جمعی
برای کامنت‌ها وجود نداره. گرفتن کامنت برای هر کارت فید = ۱۲ درخواست فوری = `429`.
به‌جاش نوار اکشن به `#comments` صفحهٔ پست لینک می‌ده و شمارندهٔ واقعی
فقط در صفحهٔ جزئیات (یک درخواست) نشون داده می‌شه.

---

### Dark mode

کلاس‌محور با `@custom-variant dark` در Tailwind v4. یک اسکریپت inline در `<head>` قبل از اولین paint تم رو اعمال می‌کنه → **بدون فلاش سفید**.

---

## 📄 صفحات

### عمومی
| مسیر | توضیح |
|---|---|
| `/[locale]` | خانه — hero + **فید عمودی به سبک لینکدین/اینستاگرام** + ریل کناری (دسته‌ها، پرخواننده‌ها، نویسندگان فعال) |
| `/[locale]/posts` | همان فید + چیپ‌های فیلتر دسته + صفحه‌بندی (`?page=`، `?category=`، `?limit=`) |
| `/[locale]/posts/[slug]` | جزئیات پست — SSR کامل، متادیتای SEO، درخت کامنت‌ها، اشتراک‌گذاری |
| `/[locale]/users/[id]` | **پروفایل عمومی به سبک اینستاگرام** — بنر گرادیانی، آواتار حلقه‌دار، شمارنده‌ها، تب‌ها (گرید / فید / درباره)، گرید ۳ستونی |
| `/[locale]/categories` | فهرست دسته‌بندی‌ها |
| `/[locale]/categories/[slug]` | صفحه‌ی دسته + نوشته‌هاش |

### احراز هویت
| مسیر | توضیح |
|---|---|
| `/[locale]/login` | ورود + هندل خطای دوزبانه + دکمه‌های پرکردن حساب نمونه |
| `/[locale]/register` | ثبت‌نام + نشانگر قدرت رمز + اعتبارسنجی `@Match` سمت کلاینت |

### داشبورد (محافظت‌شده)
| مسیر | توضیح |
|---|---|
| `/[locale]/dashboard` | نمای کلی — آمار، دسترسی سریع، آخرین نوشته‌ها |
| `/[locale]/dashboard/posts` | نوشته‌های من — جستجو، صفحه‌بندی، حذف |
| `/[locale]/dashboard/posts/new` | نوشتن نوشته‌ی جدید |
| `/[locale]/dashboard/posts/[id]/edit` | ویرایش نوشته |
| `/[locale]/dashboard/profile` | پروفایل با **۴ تب**: مشاهده / ویرایش / امنیت / نوشته‌های من (گرید اینستاگرامی) + آپلود آواتار drag&nbsp;&amp;&nbsp;drop |

### ادمین (فقط نقش `admin`)
| مسیر | توضیح |
|---|---|
| `/[locale]/admin` | overview مدیریتی |
| `/[locale]/admin/users` | مدیریت کاربران — جستجو، فیلتر نقش، ایجاد، حذف |
| `/[locale]/admin/categories` | CRUD کامل دسته‌بندی‌ها |

---

## 🧩 ساختار

```
frontend/
├── messages/{fa,en}.json        # کاتالوگ ترجمه (~۲۵۰ کلید هر زبان)
├── mock-api/
│   ├── server.mjs               # Mock API — آینه‌ی دقیق قرارداد NestJS
│   └── smoke-test.sh            # ۵۴ تست انطباق قرارداد
├── next.config.ts               # پروکسی /api/* + پلاگین next-intl
└── src/
    ├── i18n/{routing,navigation,request}.ts
    ├── middleware.ts            # next-intl locale routing
    ├── lib/
    │   ├── api.ts               # کلاینت + ApiError + single-flight refresh
    │   ├── server-api.ts        # fetch سمت سرور برای SSR/SEO
    │   ├── queries.ts           # هوک‌های TanStack Query
    │   ├── auth-context.tsx     # AuthProvider
    │   ├── theme-context.tsx    # ThemeProvider
    │   ├── types.ts             # تایپ‌های منطبق بر entity/DTO بک‌اند
    │   └── utils.ts             # تاریخ، اعداد، Markdown، درخت کامنت، RTL
    ├── components/
    │   ├── ui/                  # Button, Input, Card, Badge, Avatar (حلقهٔ گرادیانی),
    │   │                        # Pagination, ConfirmDialog, Skeleton…
    │   ├── feed/                # FeedItem (کارت فید) + FeedSidebar (ریل کناری)
    │   ├── profile/             # ProfileHeader, ProfileTabs, PostsGrid (گرید ۳ستونی),
    │   │                        # ProfileAuthFallback
    │   ├── layout/              # SiteHeader, SiteFooter
    │   ├── share-button.tsx     # Web Share API → clipboard → execCommand
    │   └── …                    # PostEditor, CommentsSection…
    └── app/
        ├── layout.tsx           # ریشه
        ├── not-found.tsx        # 404 مستقل دوزبانه
        └── [locale]/            # همه‌ی صفحات
```

---

## ⚠️ نکات مهم درباره‌ی بک‌اند

این‌ها موقع تحلیل سورس پیدا شدن. فرانت تا جایی که ممکن بود **بدون تغییر بک‌اند** باهاشون کنار اومد، ولی دونستنشون واجبه:

### 🔴 باید درست بشه

**۱. Rate limit سراسری خیلی سخت‌گیرانه**
```ts
ThrottlerModule.forRoot([{ ttl: 60, limit: 10 }])   // ۱۰ درخواست در دقیقه!
```
یک صفحه‌ی بلاگ که همزمان پست‌ها + دسته‌بندی‌ها + کامنت‌ها رو می‌گیره فوراً `429` می‌خوره.
→ `limit` رو به ۱۰۰+ ببر، یا `@SkipThrottle()` روی `GET` های عمومی بذار.

**۲. CORS فعال نیست** — `app.enableCors()` در `main.ts` غایبه.
→ فعلاً با پروکسی حل شده، ولی برای دیپلوی جدا لازمه.

**۳. `GET /post/:id` وجود نداره** — `PostService.findOneById()` نوشته شده ولی هیچ روتی بهش وصل نیست.
→ نتیجه: صفحه‌ی ویرایش مجبوره پست رو از `GET /post/my` پیدا کنه، پس **ادمین نمی‌تونه نوشته‌ی دیگران رو ویرایش کنه** (درحالی‌که `PATCH /post/:id` به ادمین اجازه می‌ده).

**۴. `GET /post/my` نویسنده و دسته‌ها رو لود نمی‌کنه**
`findMyPosts` از `findAndCount` ساده استفاده می‌کنه بدون `relations` — برخلاف `findAll` که `leftJoinAndSelect` داره.

### 🟡 توجه

**۵. `slugify()` نیم‌فاصله رو حذف می‌کنه**
```
"برنامه‌نویسی"  →  "برنامهنویسی"
```
regex فقط `\u0600-\u06FF` رو نگه می‌داره و ZWNJ (`U+200C`) بیرون این بازه است. اسلاگ‌های فارسی خراب می‌شن (نه از نظر عملکرد، از نظر خوانایی/SEO).
→ `\u200c` رو به character class اضافه کن یا به `-` نگاشت کن.

**۶. `GET /users` آرایه‌ی خام برمی‌گردونه** نه envelope — ناسازگار بقیه‌ی API.

**۷. `GET /categories` یک لایه تودرتوی اضافه داره** — `data: { categories: [...] }` درحالی‌که بقیه `data` مستقیم هستن.

**۸. کامنت‌ها flat برمی‌گردن** — `findAll` هیچ relation ای جز `author` (eager) لود نمی‌کنه، پس `replies` همیشه خالیه. فرانت درخت رو از `parentId` می‌سازه.

**۹. `JWT_ACCESS_EXPIRES_IN=900`** — ۱۵ دقیقه. فرانت auto-refresh داره، پس مشکلی نیست، ولی بدونش که هر ۱۵ دقیقه یک refresh اجباری هست.

**۱۰. بی‌نظمی نام مسیرها** — `/post` (مفرد)، `/posts/:postId/comments` (جمع)، `/categories` (جمع). فرانت عیناً همینه‌ها رو صدا می‌زنه.

**۱۱. `ValidationPipe({ forbidNonWhitelisted: true })`** — اگه حتی یک فیلد اضافه بفرستی، `400` می‌گیری. فرانت payload رو دقیقاً مطابق DTO می‌سازه (هرگز `id`/`slug`/`author` نمی‌فرسته).

**۱۲. `PATCH /users/:id` اجازه‌ی تغییر `role` رو به هر کاربر لاگین‌شده می‌ده** — هیچ `RolesGuard` ای نداره. یعنی یک کاربر عادی می‌تونه `role` خودش رو به `admin` تغییر بده. 🔴 **این یک حفره‌ی امنیتی واقعیه.**
```ts
@Patch(':id')
@UseGuards(JwtAuthGuard)      // ← RolesGuard نداره
async update(@Param('id') id, @Body() dto: UpdateUserDto)
```
→ یا `@Roles(UserRole.ADMIN)` اضافه کن، یا `role` رو از `UpdateUserDto` حذف کن.
*(فرانت عمداً این کار رو نمی‌کنه — فقط فیلدهای `name` و `bio` رو می‌فرسته.)*

---

## 🧪 تست

```bash
npm run mock:api &
bash mock-api/smoke-test.sh
```

۵۴ تست که انطباق Mock با قرارداد واقعی بک‌اند رو بررسی می‌کنه:
envelope دوزبانه، آرایه‌ی validation، pagination بدون envelope، آرایه‌ی خام `/users`، تودرتویی `/categories`، `@Exclude` روی password، نقش‌ها و `403`، مالکیت پست، چرخش توکن، باطل‌شدن سشن بعد از logout، آپلود multipart و `forbidNonWhitelisted`.

---

## 🔧 اسکریپت‌ها

| دستور | توضیح |
|---|---|
| `npm run dev` | سرور توسعه (Turbopack) روی پورت ۳۰۰۱ |
| `npm run mock:api` | Mock API روی پورت ۴۰۰۰ |
| `npm run dev:all` | هر دو با هم |
| `npm run build` | بیلد پروداکشن |
| `npm run start` | اجرای بیلد پروداکشن |
| `npm run lint` | ESLint |

---

## 🌍 متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `API_ORIGIN` | `http://127.0.0.1:3000` | مقصد پروکسی — بک‌اند واقعی یا Mock |
| `NEXT_PUBLIC_API_BASE` | `/api` | مسیر پایه در مرورگر |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3001` | برای `metadataBase` و Open Graph |
| `MOCK_PORT` | `3000` | پورت Mock |
| `MOCK_THROTTLE` | — | `=1` → محدودیت ۱۰ درخواست/دقیقه‌ی بک‌اند واقعی رو شبیه‌سازی می‌کنه (برای تست UI خطای ۴۲۹) |
