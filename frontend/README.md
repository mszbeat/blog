# 📝 Blog Frontend

فرانت‌اند دوزبانه (فارسی/انگلیسی) و راست‌چین برای بک‌اند NestJS پروژه‌ی [`mszbeat/blog`](https://github.com/mszbeat/blog).

**استک:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · next-intl · TanStack Query · React Hook Form + Zod · lucide-react

---

## 🚀 اجرا

فرانت مستقیماً به **بک‌اند واقعی NestJS** وصل می‌شه. Mock API که قبلاً برای توسعه‌ی بدون دیتابیس همراه پروژه بود، حذف شده — یک منبع حقیقت بیشتر وجود نداره.

```bash
# ۱. بک‌اند (Postgres + Redis + Cloudinary لازم داره)
cd ../backend && npm run start:dev      # → http://localhost:3000

# ۲. فرانت
cd ../frontend && npm run dev           # → http://localhost:3001
```

`API_ORIGIN` به‌صورت پیش‌فرض روی `http://127.0.0.1:3000` تنظیم شده، پس معمولاً هیچ متغیری لازم نیست. اگه بک‌اند جای دیگه‌ای اجرا می‌شه:

```bash
API_ORIGIN=http://192.168.1.20:3000 npm run dev
```

> **حساب ادمین:** از طریق `POST /users` با `role: "admin"` در Swagger (`http://localhost:3000/api/docs`) بساز، یا مستقیم در دیتابیس. فرانت هیچ اعتبارنامه‌ی hardcoded نداره.

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

### سیستم طراحی — «Editorial Social» (نسخهٔ ۳)

همه‌ی توکن‌ها در `src/app/globals.css` تعریف شدن؛ هیچ صفحه‌ای رنگ هاردکد نداره.

**پالت سه‌رنگی (تریادیک):** به‌جای یک آبی معمولی، سه فام که همدیگه رو کامل می‌کنن:

| نقش | فام | نمونه | کجا استفاده می‌شه |
|---|---|---|---|
| **اصلی** | iris | `#6d5ae6` → `#5a45d4` | دکمه‌ها، لینک‌ها، چیپ فعال، نوتیف `follow` |
| **گرم** | apricot | `#f7b955` → `#e79a2b` | هایلایت‌ها، نوتیف `comment`، تب پیش‌نویس |
| **سوم** | plum | `#e879b9` → `#d94f9d` | **لایک/قلب**، بج اعلان، نوتیف `like` |

> چرا تریادیک؟ یک accent سرد-گرم کنار iris باعث می‌شه UI بدون اینکه دوباره
> به آبی تکیه کنه، فام دوم داشته باشه — و plum فاصلهٔ بین iris و رُز رو پر
> می‌کنه، پس حالت «پسندیدم» از برند اصلی قابل تشخیصه.

| توکن / کلاس | کاربرد |
|---|---|
| `--elev-1/2/3` + `--elev-brand` / `--elev-plum` | سطوح سایه + سایهٔ رنگی برای CTA و بج |
| `.card` / `.card-hover` | سطح اصلی محتوا + لیفت ملایم هنگام hover |
| `.chip` / `.chip-active` | برچسب دسته‌بندی و فیلترها (قابل اسکرول افقی در موبایل) |
| `.feed-action` | دکمه‌های نوار اکشن فید (لایک / کامنت / اشتراک / ادامه) |
| `.avatar-ring` | حلقهٔ گرادیانی آواتار به سبک استوری اینستاگرام |
| `.glass` | پنل شیشه‌ای روی بنر (backdrop-blur) |
| `.bg-grid` / **`.bg-mesh`** | بافت شبکه‌ای / سه استخر رنگی نرم پشت hero |
| **`.text-gradient`** | تیترهای گرادیانی iris → plum → apricot |
| **`.notif` / `.notif-icon[data-type]`** | ردیف اعلان + چیپ آیکون رنگی per-type |
| **`.like-btn` / `.like-burst`** | دکمهٔ لایک + انفجار شعاعی هنگام فعال شدن |
| `.clamp-fade` | محو شدن تدریجی انتهای متن بریده‌شده |
| `.num-en` | ارقام و متن‌های LTR (ایمیل، آمار) داخل چیدمان RTL |

**حالت تاریک:** پایهٔ **navy-plum** (`#0b0a11` صفحه / `#15131e` کارت) — صفحه
تیره‌تر از کارت‌هاست تا سلسله‌مراتب سطح‌ها حفظ بشه، و جابه‌جایی فام باعث می‌شه
خاکستری تخت به نظر نرسه. خنثی‌های حالت روشن هم ته‌رنگ بنفش دارن تا صفحه و
رنگ اصلی یک سیستم به نظر بیان، نه «خاکستری + یک accent نقاشی‌شده».

**انیمیشن‌ها:** `fade-up` (کارت فید)، `pop` (قلب لایک)، `burst` (هالهٔ لایک)،
`bell` (تکان زنگوله هنگام اعلان تازه)، `toast-in/out` (مودال اعلان زنده)،
`slide-down` (پنل کشویی)، `shimmer` (اسکلتون) — همه با
`prefers-reduced-motion` غیرفعال می‌شن.

---

### 🤝 شبکهٔ اجتماعی و اعلان‌ها (ماژول‌های جدید بک‌اند)

برای این پروژه دو ماژول به بک‌اند **اضافه** شد — `social/` (Follow + Like) و
`notification/` — به‌همراه `OptionalJwtAuthGuard` و endpoint تجمیعی
`GET /users/:id/public`. جزئیات کامل قرارداد در `../API_MAP.md`.

| نیاز | راه‌حل |
|---|---|
| پروفایل عمومی بدون لاگین | `GET /users/:id/public` — کاربر + آمار واقعی + وضعیت فالو در **یک** درخواست |
| شمارندهٔ لایک/کامنت در فید | `likeCount` / `commentCount` به‌صورت denormalized روی خود پست |
| وضعیت «من پسندیده‌ام» | `likedByMe` با گارد اختیاری روی `GET /post` می‌شینه |
| لایک بدون درخواست اضافه | `POST /posts/:id/like` یک **toggle** است → `{liked, likeCount}` |
| اعلان با کاور پست | سریال‌سازی، `actor` کامل + `post` حداقلی رو hydrate می‌کنه |
| poll بدون خوردن rate limit | `GET /notifications/unread` با `@SkipThrottle()` معاف است |

**به‌روزرسانی خوش‌بینانه (optimistic):** لایک و فالو **قبل از** پاسخ سرور رنگ
عوض می‌کنن و بعد با مقدار قطعی سرور آشتی می‌شن؛ در صورت خطا به حالت قبل
برمی‌گردن. چون صفحهٔ جزئیات پست SSR است و پستش در کش کوئری نیست، دکمهٔ لایک
یک آینهٔ محلی هم نگه می‌داره تا در هر دو زمینه درست کار کنه.

**اعلان زنده:** بک‌اند websocket gateway نداره، پس `LiveNotificationToast`
هر ۲۰ ثانیه `unread` رو poll می‌کنه و جدیدترین id رو با چیزی که قبلاً
نمایش داده diff می‌کنه. سه نکتهٔ مهم:

1. **baseline** روی اولین poll تنظیم می‌شه → با لاگین کردن، کوهی از اعلان‌های
   قدیمی شلیک نمی‌شه.
2. فقط وقتی `document.visibilityState === 'visible'` است نشون می‌ده → تب
   پس‌زمینه صف اعلان جمع نمی‌کنه.
3. اگه چندتا در یک poll برسه، **یک** کارت با خط خلاصه («و ۲ مورد دیگر») رندر می‌شه.

---

### ✅ دو محدودیتی که قبلاً workaround داشتن و الان حل شدن

**پروفایل عمومی از دل پست‌ها ساخته می‌شد.** چون `GET /users/:id` پشت
`JwtAuthGuard` بود، فرانت مجبور بود ۱۰۰ پست بگیره و نویسنده رو از دل
اون‌ها بازسازی کنه — کاربری که هیچ پست منتشرشده‌ای نداشت اصلاً دیده نمی‌شد
و هیچ شمارندهٔ فالوئی وجود نداشت. الان با `/users/:id/public` حل شده.

**تعداد کامنت در کارت فید نبود.** بک‌اند `ThrottlerGuard` سراسری
**۱۰ درخواست در دقیقه** داشت و endpoint دسته‌جمعی کامنت وجود نداشت، پس
گرفتن کامنت برای هر کارت = `429` فوری. الان با `commentCount` روی خود پست
و افزایش limit به **۱۲۰** حل شده.

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
| `/[locale]/users/[id]` | **پروفایل عمومی به سبک اینستاگرام** — بنر mesh، آواتار حلقه‌دار، **۵ شمارندهٔ واقعی** (نوشته/بازدید/پسند/دنبال‌کننده/دنبال‌شونده)، دکمهٔ فالو، و **۶ تب**: گرید / فید / پسندیده‌ها / دنبال‌کنندگان / دنبال‌شوندگان / درباره |
| `/[locale]/categories` | فهرست دسته‌بندی‌ها |
| `/[locale]/categories/[slug]` | صفحه‌ی دسته + نوشته‌هاش |

### احراز هویت
| مسیر | توضیح |
|---|---|
| `/[locale]/notifications` | **اعلان‌ها** — فیلتر بر اساس نوع (فالو/لایک/دیدگاه/پاسخ) + خوانده‌نشده، صفحه‌بندی سمت سرور، «خواندن همه»، حذف تکی |
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
├── next.config.ts               # پروکسی /api/* → بک‌اند (پورت ۳۰۰۰) + پلاگین next-intl
└── src/
    ├── i18n/{routing,navigation,request}.ts
    ├── middleware.ts            # next-intl locale routing
    ├── lib/
    │   ├── api.ts               # کلاینت + ApiError + single-flight refresh + optionalAuth
    │   ├── server-api.ts        # fetch سمت سرور برای SSR/SEO (+ getPublicProfile)
    │   ├── queries.ts           # هوک‌های TanStack Query (+ لایک/فالو/اعلان optimistic)
    │   ├── notifications.ts     # متادیتای اعلان: ایموجی، لحن، مقصد دیپ‌لینک
    │   ├── auth-context.tsx     # AuthProvider
    │   ├── theme-context.tsx    # ThemeProvider
    │   ├── types.ts             # تایپ‌های منطبق بر entity/DTO بک‌اند
    │   └── utils.ts             # تاریخ، اعداد، Markdown، درخت کامنت، RTL
    ├── components/
    │   ├── ui/                  # Button, Input, Card, Badge, Avatar (حلقهٔ گرادیانی),
    │   │                        # Pagination, ConfirmDialog, Skeleton…
    │   ├── social/              # ✨ LikeButton (انیمیشن pop + burst), FollowButton
    │   │                        #    (hover → «لغو دنبال»)
    │   ├── notifications/       # ✨ NotificationBell (بج + پنل کشویی), NotificationRow,
    │   │                        #    LiveNotificationToast (مودال زندهٔ بالای صفحه),
    │   │                        #    NotificationsView (صفحهٔ کامل + فیلترها)
    │   ├── feed/                # FeedItem (کارت فید) + FeedSidebar (ریل کناری sticky)
    │   ├── profile/             # ProfileHeader (۵ شمارنده), ProfileTabs (۶ تب),
    │   │                        # PostsGrid, UserRow, ProfilePageClient
    │   ├── post/                # ✨ PostActionBar — لایک + **ویرایش درجا** + اشتراک
    │   ├── layout/              # SiteHeader (با زنگولهٔ اعلان), SiteFooter
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

**۱. ~~Rate limit سراسری خیلی سخت‌گیرانه~~ — ✅ حل شد**
```ts
ThrottlerModule.forRoot([{ ttl: 60, limit: 120 }])  // قبلاً 10 بود
```
`limit` از `10` به **`120`** در دقیقه افزایش یافت و endpoint های poll‌شونده
(`/notifications/unread`) با `@SkipThrottle()` معاف شدن.

**۲. CORS فعال نیست** — `app.enableCors()` در `main.ts` غایبه.
→ فعلاً با پروکسی حل شده، ولی برای دیپلوی جدا لازمه.

**۳. `GET /post/:id` وجود نداره** — `PostService.findOneById()` نوشته شده ولی هیچ روتی بهش وصل نیست.
→ نتیجه: صفحه‌ی ویرایش مجبوره پست رو از `GET /post/my` پیدا کنه، پس **ادمین نمی‌تونه نوشته‌ی دیگران رو ویرایش کنه** (درحالی‌که `PATCH /post/:id` به ادمین اجازه می‌ده).
→ *یادداشت:* دکمهٔ «ویرایش درجا» که کنار پست اضافه شد برای **ادمین** هم رندر می‌شه
(چون `checkOwnership` بک‌اند owner-or-admin است)، ولی چون این endpoint غایبه،
ادمین روی نوشتهٔ دیگران به صفحهٔ ویرایش خالی می‌رسه. افزودن
`@Get(':id')` + `RolesGuard` این آخرین شکاف رو می‌بنده.

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
npm run build      # type-check + lint + بیلد پروداکشن — اصلی‌ترین گیت
```

`next build` هم TypeScript رو کامل چک می‌کنه و هم ESLint؛ چون در این ریپو کانفیگ جداگانه‌ی lint وجود نداره، همین دستور نقش «تست» رو داره و باید با exit code صفر تموم بشه.

تست سمت بک‌اند (`npm run test` در `../backend`) و بررسی دستی قرارداد API در Swagger انجام می‌شه. نکات قراردادی که فرانت بهشون تکیه می‌کنه در بخش «⚠️ نکات مهم درباره‌ی بک‌اند» مستند شده.

---

## 🔧 اسکریپت‌ها

| دستور | توضیح |
|---|---|
| `npm run dev` | سرور توسعه (Turbopack) روی پورت ۳۰۰۱ |
| `npm run build` | بیلد پروداکشن (type-check + lint) |
| `npm run start` | اجرای بیلد پروداکشن |
| `npm run lint` | ESLint |

---

## 🌍 متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `API_ORIGIN` | `http://127.0.0.1:3000` | مقصد پروکسی `/api/*` — آدرس بک‌اند NestJS |
| `NEXT_PUBLIC_API_BASE` | `/api` | مسیر پایه در مرورگر |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3001` | برای `metadataBase` و Open Graph |
