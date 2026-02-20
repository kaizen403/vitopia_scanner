# Decisions

## 2026-02-20 Task 1
- Documented contract/status semantics from current route code as the source of truth, and treated runtime snapshot outputs as environment-conditioned evidence (not normative spec overrides).
- Kept evidence artifacts split into baseline (`task-1-contract-snapshots.json`) and negative (`task-1-error-snapshots.json`) to match plan QA scenarios and unblock downstream parity work.

## 2026-02-20 Task 3
- Implemented DB health probing via native TCP connect () to avoid adding new DB dependencies in this foundation task.
- Enforced fail-fast startup only for malformed/missing ; network/database availability remains a health concern surfaced via  rather than a hard boot blocker.

## 2026-02-20 Task 2
- Chose split identifiers for orders: internal `orders.id` (UUID PK) and immutable external `orders.order_id` (unique), with all QR/API contracts pinned to `order_id`.
- Chose provenance columns (`convex_id`) on migrated entities to preserve deterministic Convex `_id` traceability without leaking internal PK changes into external interfaces.
- Chose foreign-key model where `scan_logs.order_id` references `orders.order_id` (external key), while other relations use UUID FKs (`*_id -> parent.id`).

## 2026-02-20 Task 3 (correction)
- Implemented DB health probing via native TCP connect (node:net) to avoid adding new DB dependencies in this foundation task.
- Enforced fail-fast startup only for malformed or missing DATABASE_URL; network/database availability remains a health concern surfaced via /health rather than a hard boot blocker.

## 2026-02-20 Task 7
- Kept test scope backend-only and intentionally limited to one `/health` smoke test to establish harness behavior without changing application architecture.
- Captured both pass and forced-fail evidence artifacts under `.sisyphus/evidence/` to demonstrate CI-like deterministic outcomes for the same command path.

## 2026-02-20 Task 4
- Kept Prisma schema as bootstrap shell only (no business models) so Task 5 can define entities/relations without rework.
- Added migration scripts in backend package scope to keep DB operations isolated from route/runtime business logic.

## 2026-02-20 Task 5 (Fix)
- Removed `url = env("DATABASE_URL")` from `schema.prisma` since it is already properly configured in `prisma.config.ts`, ensuring compatibility with the current Prisma CLI version.

## 2026-02-20 Task 6
- Added indexes for known scan path and stats access patterns only: `Order(eventId)`, `Order(userId)`, `Order(eventId, checkedIn)`, `ScanLog(orderId)`, `ScanLog(eventId)`, `Gate(eventId)`, and `Event(isActive)`, `Event(date)`.
- Kept `Order.orderId` as `@unique` to deterministically reject duplicate QR orders at the database level.

## 2026-02-20 Task 8
- Kept `/health` response contract unchanged and moved DB readiness logic into `be/src/db/readiness.ts` so route and future repository code can share the same deterministic guard.
- Added `runInTransaction` as the single transaction entry point for downstream repositories, with options passthrough and rollback behavior delegated to Prisma `$transaction` semantics.
- Kept Prisma client bootstrap singleton-safe and lazy to prevent process startup failures when DB client is not yet needed.

## 2026-02-20 Task 8 QA gap fix
- Standardized Prisma generation on `provider = "prisma-client"` and kept import compatibility via `be/generated/prisma/index.ts` shim so existing module paths continue to compile.
- Captured transaction evidence by creating/truncating `tx_probe` in local Postgres and asserting `{ committed: true }` and `{ rolledBack: true }` outputs in dedicated artifacts.

## 2026-02-20 Task 9
- Use a dedicated `MappedUser` interface in `users.ts` repository mapping native PostgreSQL fields to existing Convex properties (`_id`, `_creationTime`) to decouple route logic from data layer migrations.
- Fallback safely to postgres native `id` if `convexId` is null for legacy or newly created records. Check if query `id` is a valid UUID before searching the `id` column.

## 2026-02-20 Task 9 (Fixes)
- For `getOrders`, we ensure we preserve Convex property mapping semantics (mapping `id`/`convexId` to `_id` and `createdAt` to `_creationTime`) simultaneously for both the root order and the included event relationship. This prepares the system perfectly for the Task 15 facade integration.

## 2026-02-20 Task 10
- Maintained legacy `listActive` sort order (`createdAt` descending) explicitly in Prisma queries since Postgres doesn't sort automatically by creation time like Convex did by default.
- Implemented `getStats` memory aggregation instead of SQL aggregations for precise parity with Convex data handling semantics; keeping business logic intact for now.

## 2026-02-20 Task 11
- Kept Convex `orderId` generator format unchanged (`ORD-${base36Timestamp}-${base36Random}` uppercased) to preserve external QR token compatibility.
- Retained payment status contract as Prisma enum-backed string union (`pending|paid|failed|refunded`) and validated happy/negative behavior through repository-level evidence artifacts.

## 2026-02-20 Task 12
- Kept Task 12 repository-only scope: no `be/src/routes/*` edits; acceptance evidence is generated directly via `orders` + `scan` repository calls.
- Standardized QA evidence to include route-equivalent markers (`statusEquivalent`, `codeEquivalent`) while preserving repository-native result shapes.

## 2026-02-20 Task 14
- Kept Task 14 as strict direct-route migration scope: swapped persistence calls in `users/events/orders` routes to repository functions without introducing storage facades or dual-write behavior.
- Preserved existing API contract semantics by keeping route paths, response envelopes (`{ success, data|error }`), and existing status-code branches unchanged.
- **Task 15**: Replaced `api.orders.checkIn` and `api.orders.validate` with `checkIn` and `validate` from `db/scan.ts`. Replaced `api.events.getStats` with `dbGetStats` from `db/scan.ts`. Replaced `api.orders.logScan` with `logScan` from `db/scan.ts`. Kept route responses structurally identical.
## 2026-02-20 Task 16
- Directly migrated dashboard route `/api/dashboard/data` to use Postgres repository `getDashboardData` instead of Convex `getDashboardData`.
- Preserved existing rate-limit mechanism, `/auth` route behavior, token structure, and standard `{ success, data }` response envelope.

## 2026-02-20 Task F3 QA
- F3 is considered complete. Convex runtime dependencies and leftover scripts have been fully expunged. Real local Postgres/Redis endpoints are proven to satisfy the scan taxonomy and dashboard contracts.
