# Social regression tests

Use a disposable PostgreSQL database and Redis instance. The API integration
suite creates two test users and a published test post through real Nest routes.
It never replaces the production API with a mock server.

1. Start Nest on port **3000**, configured for the disposable database and Redis.
2. In `frontend`: `npm install` and `npx playwright install chromium`.
3. Run `npm run test:social` — immutable snapshots, conflicting mounts,
   pending-request reconciliation, rollback primitives and React StrictMode auth.
4. Run `npm run test:api` — writes through Nest and rereads warm Redis-backed
   list/detail responses. Includes concurrent/idempotent likes, follow/unfollow,
   and comment create/delete counters. Saves a temporary fixture in `.cache/`.
5. Run `npm run build` then `npm run start` (port **3001**).
6. In another terminal run `npm run test:browser` — Chromium desktop English
   and mobile Persian, sign-in, like/unlike, reload, client navigation/back,
   follow/unfollow, hover labels, deliberate transport errors with rollback,
   icon-only history navigation, console errors and mobile horizontal overflow.

The browser suite needs the fixture generated in step 4. `TEST_API` and
`TEST_SITE` optionally override the default local origins. Browser test requests
are genuine HTTP requests except the two deliberate aborted mutations used to
verify rollback. Do not run against a production database.
