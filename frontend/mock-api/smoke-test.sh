#!/usr/bin/env bash
# Smoke test: verifies the mock server matches the real NestJS contract.
set -u
B=http://127.0.0.1:3000
pass=0; fail=0
chk() { # chk <name> <expected-substring> <actual>
  if echo "$3" | grep -q "$2"; then echo "  ✅ $1"; pass=$((pass+1));
  else echo "  ❌ $1"; echo "     expected to contain: $2"; echo "     got: $(echo "$3" | head -c 300)"; fail=$((fail+1)); fi
}

echo "── 1. Meta ──"
chk "GET / -> Hello World" "Hello World" "$(curl -s $B/)"

echo "── 2. Auth ──"
LOGIN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@blog.dev","password":"admin123"}')
chk "login envelope message.fa" "با موفقیت وارد شدید" "$LOGIN"
chk "login returns accessToken" "accessToken" "$LOGIN"
chk "login returns refreshToken" "refreshToken" "$LOGIN"
chk "login returns user" '"user"' "$LOGIN"
chk "login user has NO password" "role" "$LOGIN"
echo "$LOGIN" | grep -q '"password"' && { echo "  ❌ password leaked!"; fail=$((fail+1)); } || { echo "  ✅ password excluded (@Exclude works)"; pass=$((pass+1)); }

AT=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
RT=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['refreshToken'])")

chk "bad password -> 400 fa" "اطلاعات ورود نامعتبر است" \
  "$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@blog.dev","password":"wrongpass"}')"
chk "validation -> message is array" '"message":\[' \
  "$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"nope"}')"
chk "GET /auth/me with token" "پروفایل با موفقیت بازیابی شد" "$(curl -s $B/auth/me -H "Authorization: Bearer $AT")"
chk "GET /auth/me w/o token -> 401" "لطفاً وارد شوید" "$(curl -s $B/auth/me)"
chk "unknown field rejected (forbidNonWhitelisted)" "should not exist" \
  "$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@blog.dev","password":"admin123","hacker":1}')"

echo "── 3. Posts ──"
POSTS=$(curl -s "$B/post?page=1&limit=3")
chk "GET /post has data+meta (NO envelope)" '"meta"' "$POSTS"
echo "$POSTS" | grep -q '"message"' && { echo "  ❌ /post should NOT have message envelope"; fail=$((fail+1)); } || { echo "  ✅ /post correctly has no envelope"; pass=$((pass+1)); }
chk "GET /post meta.totalPages" "totalPages" "$POSTS"
chk "GET /post includes author" '"author"' "$POSTS"
chk "GET /post includes categories" '"categories"' "$POSTS"
SLUG=$(echo "$POSTS" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'][0];print(d['slug'])")
chk "GET /post/:slug" "پست با موفقیت بازیابی شد" "$(curl -s $B/post/$SLUG)"
chk "GET /post/my (auth)" '"meta"' "$(curl -s $B/post/my -H "Authorization: Bearer $AT")"
chk "category filter works" '"categories"' "$(curl -s -G "$B/post" --data-urlencode "category=طراحی")"
# NOTE: slugify() strips ZWNJ (نیم‌فاصله U+200C), so "برنامه‌نویسی" slugs to "برنامهنویسی"
chk "Persian slug keeps ZWNJ stripped" '"categories"' "$(curl -s -G "$B/post" --data-urlencode "category=برنامهنویسی")"

echo "── 4. Categories ──"
CATS=$(curl -s $B/categories)
chk "GET /categories -> data.categories nesting" '"categories":\[' "$CATS"
chk "GET /categories envelope.fa" "دسته‌بندی‌ها با موفقیت بازیابی شدند" "$CATS"
chk "GET /categories/:slug (ZWNJ-stripped slug)" "دسته‌بندی با موفقیت بازیابی شد" \
  "$(curl -s -G "$B/categories/$(printf '%s' 'برنامهنویسی' | python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read()))')")"
chk "GET /categories/:unknown -> 404" "دسته‌بندی یافت نشد" "$(curl -s $B/categories/nope)"


echo "── 5. Comments ──"
PID=$(echo "$POSTS" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'][0]['id'])")
COM=$(curl -s $B/posts/$PID/comments)
chk "GET comments envelope" "کامت ها با موفقیت بازیابی شد" "$COM"
chk "comments include eager author" '"author"' "$COM"
NEWC=$(curl -s -X POST $B/posts/$PID/comments -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"content":"تست کامنت جدید"}')
chk "POST comment" "کامنت با موفقیت ساخته شد" "$NEWC"
CID=$(echo "$NEWC" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
REPLY=$(curl -s -X POST $B/posts/$PID/comments -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"content\":\"پاسخ به تست\",\"parentId\":\"$CID\"}")
chk "reply with parentId" "parentId" "$REPLY"
chk "PATCH comment" "کامنت با موفقیت آپدیت شد" \
  "$(curl -s -X PATCH $B/comments/$CID -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"content":"ویرایش شد"}')"
chk "DELETE comment" "کامنت با موفقیت حذف شد" "$(curl -s -X DELETE $B/comments/$CID -H "Authorization: Bearer $AT")"

echo "── 6. Users / roles ──"
chk "GET /users (admin) -> RAW array" '^\[' "$(curl -s $B/users -H "Authorization: Bearer $AT")"
SARA=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"sara@blog.dev","password":"sara1234"}')
SAT=$(echo "$SARA" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
chk "non-admin GET /users -> 403" "دسترسی مجاز نیست" "$(curl -s $B/users -H "Authorization: Bearer $SAT")"
chk "non-admin POST /categories -> 403" "دسترسی مجاز نیست" \
  "$(curl -s -X POST $B/categories -H "Authorization: Bearer $SAT" -H 'Content-Type: application/json' -d '{"name":"تست"}')"

echo "── 7. Post CRUD + ownership ──"
NP=$(curl -s -X POST $B/post -H "Authorization: Bearer $SAT" -H 'Content-Type: application/json' \
  -d '{"title":"پست تستی سارا","content":"محتوای تستی","published":true}')
chk "POST /post (create)" "پست جدید با موفقیت ایجاد شد" "$NP"
NPID=$(echo "$NP" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
chk "auto slug generated" "پست-تستی-سارا" "$NP"
chk "PATCH own post" "پست با موفقیت به‌روزرسانی شد" \
  "$(curl -s -X PATCH $B/post/$NPID -H "Authorization: Bearer $SAT" -H 'Content-Type: application/json' -d '{"title":"عنوان عوض شد"}')"
ALI=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"ali@blog.dev","password":"ali12345"}')
AAT=$(echo "$ALI" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
chk "PATCH others' post -> 403" "not allowed to modify" \
  "$(curl -s -X PATCH $B/post/$NPID -H "Authorization: Bearer $AAT" -H 'Content-Type: application/json' -d '{"title":"هک"}')"
chk "admin CAN patch others' post" "به‌روزرسانی" \
  "$(curl -s -X PATCH $B/post/$NPID -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"published":false}')"

echo "── 8. Uploads ──"
printf 'fakepng' > /tmp/t.png
chk "POST /uploads/avatar" "عکس پروفایل با موفقیت آپلود شد" \
  "$(curl -s -X POST $B/uploads/avatar -H "Authorization: Bearer $AT" -F 'file=@/tmp/t.png')"
chk "POST /uploads/cover" "تصویر کاور با موفقیت آپلود شد" \
  "$(curl -s -X POST $B/uploads/cover -H "Authorization: Bearer $AT" -F 'file=@/tmp/t.png')"
chk "uploads w/o auth -> 401" "لطفاً وارد شوید" "$(curl -s -X POST $B/uploads/cover -F 'file=@/tmp/t.png')"

echo "── 9. Token refresh (rotation) ──"
# Refresh FIRST — logout below destroys the Redis session, which also
# invalidates the refresh token (validateSession looks the session up in Redis).
REFRESHED=$(curl -s -X POST $B/auth/refresh -H "Authorization: Bearer $RT")
chk "POST /auth/refresh" "توکن جدبد با موفقیت ساخته شد" "$REFRESHED"
chk "refresh rotates: new tokens issued" "refreshToken" "$REFRESHED"
NAT=$(echo "$REFRESHED" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
NRT=$(echo "$REFRESHED" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['refreshToken'])" 2>/dev/null)
chk "new access token works" "پروفایل" "$(curl -s $B/auth/me -H "Authorization: Bearer $NAT")"
# ⚠️ The real AuthService deletes the OLD session during refresh, so any
# in-flight request still carrying the previous access token immediately 401s.
# The frontend must swap tokens atomically (single-flight refresh queue).
chk "old access token dead after rotation" "نامعتبر" "$(curl -s $B/auth/me -H "Authorization: Bearer $AT")"
chk "old refresh token rejected after rotation" "نامعتبر" \
  "$(curl -s -X POST $B/auth/refresh -H "Authorization: Bearer $RT")"

echo "── 9b. Logout ──"
chk "POST /auth/logout" "با موفقیت خارج شد" "$(curl -s -X POST $B/auth/logout -H "Authorization: Bearer $NAT")"
chk "access token dead after logout" "نامعتبر" "$(curl -s $B/auth/me -H "Authorization: Bearer $NAT")"
chk "refresh token also dead after logout (session gone from Redis)" "نامعتبر" \
  "$(curl -s -X POST $B/auth/refresh -H "Authorization: Bearer $NRT")"

echo "── 10. Media + misc ──"
chk "cover SVG served" "<svg" "$(curl -s $B/img/cover/security.svg)"
chk "avatar SVG served" "<svg" "$(curl -s $B/img/avatar/maryam.svg)"
chk "404 fallback shape" "statusCode" "$(curl -s $B/nope)"
chk "register validation (match)" "Confirm password must match password" \
  "$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"name":"x","email":"x@y.com","password":"123456","confirmPassword":"654321"}')"

echo
echo "════════════════════════════════════"
echo "  PASS: $pass   FAIL: $fail"
echo "════════════════════════════════════"
[ "$fail" -eq 0 ]
