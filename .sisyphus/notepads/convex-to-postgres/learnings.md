# Learnings

## 2026-02-20 Task 1
- `be/src/routes/{scan,events,orders,users,dashboard}.ts` each instantiate `ConvexHttpClient` lazily and all route contracts are wrapped in `{ success, ... }` JSON envelopes.
- `scan` route has the richest error-code semantics (`MISSING_QR_CODE`, `INVALID_QR`, `CONCURRENT_SCAN`, `ALREADY_USED`, `NOT_FOUND`, `NOT_PAID`, `SERVER_ERROR`) and mixes Redis lock/cache behavior with Convex mutations.
- Frontend dependency surface is centralized in `fe/lib/api.ts`; scanner functions (`verifyTicket`, `validateTicket`) parse raw JSON directly and are tightly coupled to `code` plus optional `responseTime`.

## 2026-02-20 Task 2
- `orderId` is the stable external identity used in QR tokens (`generateQRCode`, `verifyQRCode`, `extractOrderId`) and must stay decoupled from internal Postgres PKs.
- Convex relations are `_id`-based (`v.id("users"|"events"|"orders")`) while scan logs already join by external `orderId`, so Postgres should keep `scan_logs.order_id -> orders.order_id` to preserve scanner/debug semantics.

## 2026-02-20 Task 3
- Added  to  while preserving existing Convex and Redis keys, so runtime config can carry both backends during migration.
- Extended  with  connectivity metadata (, optional ) while keeping existing , , and  fields unchanged.

## 2026-02-20 Task 3 (correction)
- Added DATABASE_URL to be/.env.example while preserving existing Convex and Redis keys, so runtime config can carry both backends during migration.
- Extended /health with db connectivity metadata (connected, optional error) while keeping existing status, timestamp, and service fields unchanged.

## 2026-02-20 Task 7
- Minimal backend test harness works with `pnpm --filter be test` by adding a `vitest run` script in `be/package.json`.
- A single `supertest` smoke test against `GET /health` can reuse `createApp({ enableNotFound: false })` directly with no server bootstrap or route refactor.

## 2026-02-20 Task 4
- Prisma bootstrap completed in `be` with `prisma init --datasource-provider postgresql`, creating `be/prisma/schema.prisma` and `be/prisma.config.ts`.
- Workspace script wiring now exposes `db:generate`, `db:migrate`, `db:migrate:status`, and `db:migrate:deploy`; root invocation via `pnpm --filter be ...` resolves correctly.

## 2026-02-20 Task 5 (Fix)
- Prisma schema validation fails with `P1012` if `url` is present in the `datasource` block within `schema.prisma` in recent versions. It requires `url` to be defined in `prisma.config.ts`.
- `prisma migrate diff` can be used offline with `--from-empty --to-schema prisma/schema.prisma --script` to validate and output generated SQL, serving as a reliable artifact for FK validation without a running database.

## 2026-02-20 Task 6
- Identified performance-critical fields via query analysis: `eventId` for stats (`getDashboardData`, `listDay1Orders`), `isActive`/`date` for `events`, and composite `eventId, checkedIn` for dashboard filtering.
- Prisma `@@index` annotations accurately map to standard `CREATE INDEX` SQL statements, which can be extracted safely via `prisma migrate diff --from-empty --to-schema ... --script`.

## 2026-02-20 Task 8
- Added shared DB foundation modules under `be/src/db/`: singleton-safe Prisma bootstrap (`prisma.ts`), reusable transaction wrapper (`transaction.ts`), and deterministic readiness guard (`readiness.ts`).
- Health/readiness behavior remains contract-compatible (`/health` still returns `status`, `timestamp`, `service`, `db`) while readiness now lives in a reusable utility for upcoming repository tasks.

## 2026-02-20 Task 8 QA gap fix
- Transaction QA evidence now uses local docker Postgres (`127.0.0.1:55432/fest`) and a deterministic `tx_probe` table to prove both commit persistence and rollback on thrown error via `runInTransaction`.

## 2026-02-20 Task 9
- Prisma 7 `PrismaClient` initialization defaults to driver adapters. We added `pg` and `@prisma/adapter-pg` and updated `be/src/db/prisma.ts` to instantiate `PrismaPg(pool)` properly.
- For `users` operations, returning mapped objects matching Convex `_id` and `_creationTime` ensures API compatibility with existing clients when routes switch to using the repository.

## 2026-02-20 Task 9 (Fixes)
- Added explicit email validation `if (!data.email || data.email.trim() === '')` in `createOrGet` to match plan's invalid-input constraint.
- Implemented `getOrders` function matching Convex response structure, leveraging Prisma `include: { event: true }` to avoid the N+1 queries present in the legacy Convex script (`await Promise.all(orders.map(...))`).

## 2026-02-20 Task 10
- Parity for events repository achieved. `MappedEvent` type returns Convex-compatible properties (`_id`, `_creationTime`) while abstracting Prisma-specific ones (`id`, `createdAt`, `BigInt` coercions).
- The `getStats` calculation correctly aggregates `orders` where `paymentStatus === "paid"` and `checkedIn === true`, matching legacy logic precisely without requiring complex database-level aggregations upfront.

## 2026-02-20 Task 11
- Orders repository parity methods (`create`, `markAsPaid`, `getByOrderId`) preserve Convex-compatible mapping (`_id`, `_creationTime`) while keeping route-facing `orderId` unchanged for QR generation.
- Deterministic oversell prevention is enforced in a transaction by locking the event row and checking reserved quantity before insert, which consistently yields `Not enough tickets available` on overflow attempts.

## 2026-02-20 Task 12
- `scan.checkIn` preserves Convex taxonomy semantics (`already_used`, `not_paid`, `not_found`, `wrong_event`) and returns context payloads needed by scanner responses.
- Atomic double-scan prevention is enforced by transactional `updateMany` guarded on `checkedIn=false` and `paymentStatus="paid"`, then fallback-read mapping to `already_used` when update count is zero.

## 2026-02-20 Task 13
- Established `dashboard.ts` repository module which aggregates `getDashboardData` to maintain analytics schema parity (`totalTicketsSold`, `totalCheckedIn`, `totalRemaining`).
- Prisma `.findMany` paired with `include: { event: true, order: { include: { user: true } } }` successfully recreates the populated `EnrichedScanLog` object shape natively, matching previous N+1 nested lookups from Convex.

## 2026-02-20 Task 14
- `users.ts`, `events.ts`, and `orders.ts` route files can be migrated with minimal diff by replacing only Convex query/mutation calls with repository methods while preserving envelopes and status behavior.
- QR behavior remains parity-safe when route logic still gates QR generation on `paymentStatus === "paid"` and uses the same `generateQRCode({ orderId })` call path.
- **Task 15**: Scan route migration required replacing `getConvex().query` and `getConvex().mutation` with corresponding methods from `be/src/db/scan.ts` and `be/src/db/orders.ts`. Redis lock usage and rate limits were carefully preserved without changes.
## 2026-02-20 Task 16
- Local testing of the backend on port 3001 using `tsx src/server.ts` allows verifying route responses cleanly.
- Removing Convex references from the dashboard route leaves it completely independent of the old BaaS logic, unblocking the final cleanup task (Task 17).

## 2026-02-20 Task 17
- Convex runtime and schemas have been completely expunged from the backend without affecting application tests.
- Backend dependencies updated and simplified successfully.

## 2026-02-20 Task F3 QA
- Full end-to-end integration and QA narrative confirmed all required behaviors working seamlessly against local Postgres and Redis.
- Concurrency test correctly surfaced the expected ALREADY_USED / CONCURRENT_SCAN conflict behavior through Redis lock acquisition.
- Rollback drill confirmed that stopping Postgres gracefully transitions `/health` and scan endpoints to handle connection errors seamlessly (returning HTTP 500) and recovers automatically upon restart.
