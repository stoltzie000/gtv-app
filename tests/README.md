# GTV Test Suite

The suite uses Vitest with mocked Prisma, authentication, email, and storage boundaries. It focuses on route-level behavior and high-risk domain rules without requiring a disposable database for every run.

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

## Commands

```powershell
npm test
npm run lint
npm run build
```
