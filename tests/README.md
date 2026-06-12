# GTV Test Suite

The fast suite uses Vitest with mocked boundaries. Extended tests use a disposable PostgreSQL database, real Prisma migrations, temporary S3-compatible storage, and Playwright Chromium. No production database or storage service is used.

## Structure

- `auth-routes.test.ts`: registration, login, rate limiting, and account deletion
- `trip-routes.test.ts`: trip creation, editing, publication, and deletion
- `lifecycle.test.ts`: draft reminder and deletion processing
- `travel-itinerary-routes.test.ts`: section CRUD, round trips, population, and date validation
- `updates-routes.test.ts`: update creation, propagation, editing, deletion, and replay
- `public-routes.test.ts`: published access, media access, and poll voting
- `media-upload.test.ts`: signatures and upload-size rejection
- `update-indicators.test.tsx`: traveler UPDATE badges
- `domain.test.ts`: date, summary, schedule, and file-signature rules
- `schema-integrity.test.ts`: return-segment schema and migration constraints
- `upload-body.test.ts`: streaming request-size boundary behavior
- `integration/`: real PostgreSQL, constraints, concurrency, backups, QR, and lifecycle tests
- `e2e/`: complete organizer and traveler browser workflow

## Commands

```powershell
npm test
npm run test:integration
npm run test:e2e
npm run test:extended
npm run lint
npm run build
```

`test:integration` and `test:e2e` require a local PostgreSQL server reachable through `DATABASE_URL`. The runner creates a uniquely named database, applies every migration, and drops the database after the suite. Install the browser once with `npx playwright install chromium`.
