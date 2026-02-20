# Issues

## 2026-02-20 Task 1
- Baseline snapshot run showed infrastructure gaps in this workspace context: Redis was unreachable (`ECONNREFUSED 127.0.0.1:6379`) and Convex backend was not reachable from fixture URL, so several baseline fixtures returned route-level failure envelopes (`500` or route catch-path `400`).
- `POST /api/scan/verify` with gate headers timed out in fixture run because rate-limit middleware depends on Redis before QR validation logic executes.

## 2026-02-20 Task 3
- No new blocker found for Task 3 implementation; invalid  now exits fast at startup with code  and explicit log output.

## 2026-02-20 Task 2
- No runtime blocker; task validated via static manifest rules because this workspace still has Redis/Convex connectivity gaps for live end-to-end checks.
- Negative validator evidence currently fails fast on first invalid field (`orders.orderId`), so malformed FK checks are not reached in the same run (expected short-circuit behavior).

## 2026-02-20 Task 3 (correction)
- No new blocker found for Task 3 implementation; invalid DATABASE_URL now exits fast at startup with code 1 and explicit log output.

## 2026-02-20 Task 7
- No implementation blocker; deterministic negative evidence is captured by running the same smoke test with `FORCE_FAIL_HEALTH_TEST=1` to force an assertion mismatch.

## 2026-02-20 Task 4
- `pnpm --filter be db:migrate` correctly dispatches `prisma migrate dev` but fails with `P1001` because Postgres is not reachable at `localhost:5432` in this environment.

## 2026-02-20 Task 5 (Fix)
- Previous implementation failed `prisma validate` with a `P1012` error because of unsupported `datasource.url` in the schema file.

## 2026-02-20 Task 8
- Prisma 7 client initialization can fail immediately when constructed without adapter/accelerate options in this workspace setup, so eager construction was avoided and guarded behind lazy singleton access.
- No blocker for Task 8 acceptance: readiness evidence, build, and tests are green.

## 2026-02-20 Task 8 QA gap fix
- `pnpm --filter be build` initially failed because some files still referenced `../../generated/prisma/index.js` while the generated output path was `client.js`; added a generated shim `be/generated/prisma/index.ts` to restore compatibility.

## 2026-02-20 Task 9
- Encountered `PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"` since Prisma 7 removes the binary/library query engines. Resolved by explicit addition and configuration of `@prisma/adapter-pg`.

## 2026-02-20 Task 9 (Fixes)
- Previous implementation lacked `getOrders` and didn't check for blank email input. Also missed correct evidence file naming for idempotency and invalid input. Resolved by extending `users.ts` and generating `task-9-idempotent.txt` and `task-9-invalid-input.txt`.

## 2026-02-20 Task 10
- Execution scripts need a valid `DATABASE_URL` in their environment if they don't load `.env` properly. Handled by passing it inline during verification to local Postgres.

## 2026-02-20 Task 11
- `tsx` execution from `/tmp` defaulted to CJS transform and rejected top-level await; fixed by wrapping evidence runner in an async `run()` function.
- No repository implementation blocker after running checks against local Docker Postgres at `127.0.0.1:55432/fest`.

## 2026-02-20 Task 12
- `lsp_diagnostics` initially reported stale unused-import hint in `be/src/db/scan.ts`; resolved after normalizing the import line and re-running diagnostics.
- No blocker during deterministic first/second scan evidence generation against local Postgres (`127.0.0.1:55432/fest`).

## 2026-02-20 Task 13
- Verified that `api/dashboard/data` correctly returns `401 Unauthorized` responses directly when session missing/invalid, demonstrating that repository extensions did not accidentally modify route auth middleware logic.

## 2026-02-20 Task 14
- No migration blocker in users/events/orders routes; focused supertest checks against local Postgres (`127.0.0.1:55432/fest`) validated expected success/error envelopes and core status codes.
- **Task 15**: Encountered Prisma generated client ESM resolution issue in local test scripts but built TS successfully and preserved exact same route structure.

## 2026-02-20 Task F3 QA
- No blockers for final F3 completion. Re-generation of fresh QRs in rollback drills was necessary to bypass Redis cache hits and explicitly force Postgres connection checks during the "down" phase.
