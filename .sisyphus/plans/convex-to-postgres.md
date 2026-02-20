# Convex to Postgres Migration Plan (Keep Redis)

## TL;DR

> **Quick Summary**: Replace Convex persistence with Postgres behind the existing Express API while preserving scanner correctness, Redis lock semantics, and frontend response contracts.
>
> **Deliverables**:
> - Prisma schema + Postgres DB + migrations
> - Prisma Client integration (`be/src/db/prisma.ts`)
> - Storage facade supporting `convex | postgres | dual`
> - Migrated routes (`scan`, `events`, `orders`, `users`, `dashboard`)
> - Backfill + parity + cutover + rollback runbooks
>
> **Estimated Effort**: Large (7-10 focused engineering days)
> **Parallel Execution**: YES - 4 implementation waves + final review wave
> **Critical Path**: T1 -> T3 -> T5 -> T12 -> T16 -> T19 -> T23 -> T24

---

## Context

### Original Request
Migrate from Convex to Postgres and keep Redis in the stack.

### Interview Summary
**Key Discussions**:
- User wants migration planned first before implementation.
- User wants production-safe setup, not local-only `convex dev --local` behavior.
- User explicitly asked for a Postgres + Redis target stack.

**Research Findings**:
- Convex usage is concentrated in route handlers and Convex function files:
  - `be/src/routes/scan.ts`
  - `be/src/routes/events.ts`
  - `be/src/routes/orders.ts`
  - `be/src/routes/users.ts`
  - `be/src/routes/dashboard.ts`
  - `be/convex/schema.ts`
  - `be/convex/orders.ts`
  - `be/convex/events.ts`
  - `be/convex/users.ts`
  - `be/src/utils/convex-api.ts`
- Redis lock/cache/rate-limit logic already exists and must be preserved:
  - `be/src/utils/redis-lock.ts`
  - `be/src/middleware/auth.ts`
- Frontend depends on current backend API shapes:
  - `fe/lib/api.ts`
- No current automated test suite found.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Missing explicit route-by-route contract parity requirements.
- Missing source-of-truth rules during dual mode.
- Missing rollback drill criteria and divergence monitoring.
- Missing lock semantics guardrails for Redis behavior.
- Missing scope lock to avoid migration-adjacent refactors.

---

## Work Objectives

### Core Objective
Move data persistence from Convex to Postgres with zero API contract drift and no scanner correctness regression, while retaining Redis as the distributed coordination layer.

### Concrete Deliverables
- Prisma schema (`schema.prisma`) and migration history for `users`, `events`, `orders`, `scan_logs`, `gates`
- Prisma Client setup and repository layer (`convex | postgres | dual`)
- Migrated route handlers backed by Prisma repositories
- Data migration toolchain (export/backfill/verification)
- Production cutover + rollback runbook with canary steps

### Definition of Done
- [x] All public API endpoints return contract-compatible payloads (shape + status codes + key semantics).
- [x] Scanner flow preserves one-time check-in guarantee under concurrent scans.
- [x] Dual-write/shadow-read parity mismatch rate < 0.1% for 72h burn-in.
- [x] Cutover to Postgres completed with rollback switch validated.

### Must Have
- Preserve `orderId` behavior and QR verification behavior from `be/src/utils/qr-code.ts`.
- Preserve Redis lock key and TTL semantics from `be/src/utils/redis-lock.ts`.
- Keep frontend integration unchanged (`fe/lib/api.ts` contract preserved).
- Maintain route status codes and error codes in scanner flow.

### Must NOT Have (Guardrails)
- No endpoint redesign or payload restructuring.
- No unrelated auth redesign (`be/src/routes/auth.ts` stays functionally untouched).
- No broad “cleanup refactor” outside migration scope.
- No manual-only acceptance criteria.
- No cutover without rollback drill evidence.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - All verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: YES (introduce minimal backend test harness)
- **Framework**: `vitest` + `supertest` for route-level API regression, Postgres test DB
- **Workflow**: TDD from repository/storage-facade tasks onward

### QA Policy
- Every task includes executable QA scenarios (happy path + negative path).
- Evidence files saved under `.sisyphus/evidence/task-{N}-{scenario}.{ext}`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| API route behavior | Bash (`curl`) + `jq` + `diff` | request/response contract diffing |
| DB persistence | Bash (`psql` + `npx prisma`) | row/constraint/index checks |
| Concurrency correctness | Bash parallel requests + Redis inspection | lock and double-scan assertions |
| Backend tests | Bash (`pnpm --filter be test`) | automated regression suite |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (foundation, start immediately):
├── T1 Contract inventory + Convex touchpoint map [unspecified-high]
├── T2 ID mapping + invariants spec [quick]
├── T3 Postgres runtime/config wiring [quick]
├── T4 Prisma setup and initial schema [quick]
├── T5 Create core Prisma models [unspecified-high]
├── T6 Indexes/constraints/perf in Prisma [unspecified-high]
└── T7 Test harness bootstrap (vitest/supertest) [quick]

Wave 2 (data access layer, max parallel):
├── T8 Prisma Client + tx helper + health checks [quick]
├── T9 Users repository [unspecified-high]
├── T10 Events repository [unspecified-high]
├── T11 Orders repository [deep]
├── T12 Scan repository (validate/check-in/log) [deep]
├── T13 Dashboard repository analytics [unspecified-high]
└── (Skip T14 facade in fast path)

Wave 3 (route migration - FAST PATH):
├── T14 Direct migration of users/events/orders routes to Postgres [deep]
├── T15 Direct migration of scan route to Postgres [deep]
├── T16 Direct migration of dashboard route to Postgres [unspecified-high]
└── T17 Delete Convex dependencies and clean up [quick]

Wave FINAL (independent review):
├── F1 Plan compliance audit (oracle)
├── F2 Code quality review (unspecified-high)
├── F3 Real QA execution (unspecified-high)
└── F4 Scope fidelity check (deep)

Critical Path: T1 -> T3 -> T5 -> T12 -> T16 -> T19 -> T23 -> T24
Parallel Speedup: ~65% vs sequential execution
Max Concurrent: 7 tasks
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| T1 | - | T14, T21 | 1 |
| T2 | - | T5, T11, T12, T18 | 1 |
| T3 | - | T8, T18 | 1 |
| T4 | - | T5, T6, T18 | 1 |
| T5 | T2, T4 | T9-T13, T18 | 1 |
| T6 | T5 | T12, T22 | 1 |
| T7 | - | T21 | 1 |
| T8 | T3, T5 | T9-T14 | 2 |
| T9 | T5, T8 | T14, T15 | 2 |
| T10 | T5, T8 | T14, T15, T17 | 2 |
| T11 | T2, T5, T8 | T14, T15, T16 | 2 |
| T12 | T2, T5, T6, T8 | T14, T16, T19, T22 | 2 |
| T13 | T5, T8, T10, T11, T12 | T14, T17 | 2 |
| T14 | T1, T8-T13 | T15-T21 | 2 |
| T15 | T9, T10, T11, T14 | T19, T21 | 3 |
| T16 | T11, T12, T14 | T19, T21, T22 | 3 |
| T17 | T10, T13, T14 | T19, T21 | 3 |
| T18 | T2, T3, T4, T5 | T19, T23 | 3 |
| T19 | T12, T14-T18 | T20, T23, T24 | 3 |
| T20 | T19 | T24 | 3 |
| T21 | T1, T7, T14-T17 | T23, T24 | 3 |
| T22 | T6, T12, T16 | T23, T24 | 4 |
| T23 | T18, T19, T21, T22 | T24, T25 | 4 |
| T24 | T19-T23 | T25, FINAL | 4 |
| T25 | T23, T24 | FINAL | 4 |
| F1-F4 | T1-T25 | - | FINAL |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks -> Agent Category |
|------|------------|-------------------------|
| 1 | 7 | T1 `unspecified-high`, T2 `quick`, T3 `quick`, T4 `quick`, T5 `unspecified-high`, T6 `unspecified-high`, T7 `quick` |
| 2 | 7 | T8 `quick`, T9 `unspecified-high`, T10 `unspecified-high`, T11 `deep`, T12 `deep`, T13 `unspecified-high`, T14 `deep` |
| 3 | 7 | T15 `deep`, T16 `deep`, T17 `unspecified-high`, T18 `unspecified-high`, T19 `deep`, T20 `quick`, T21 `deep` |
| 4 | 4 | T22 `unspecified-high`, T23 `unspecified-high`, T24 `deep`, T25 `quick` |
| FINAL | 4 | F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep` |

---

## TODOs

- [x] 1. Build API contract manifest and Convex touchpoint map
  - What to do: catalog every Convex call site and expected route response shape/status in `scan/events/orders/users/dashboard`.
  - Must NOT do: change route behavior while documenting.
  - Recommended Agent Profile: category `unspecified-high`; skills `none` (codebase mapping only).
  - Parallelization: YES, Wave 1; Blocks T14/T21; Blocked by None.
  - References:
    - `be/src/routes/scan.ts` - canonical scanner contract.
    - `be/src/routes/events.ts` - events API shape.
    - `be/src/routes/orders.ts` - payment/QR response contracts.
    - `be/src/routes/users.ts` - user create/get patterns.
    - `be/src/routes/dashboard.ts` - dashboard payload shape.
    - `fe/lib/api.ts` - frontend dependency surface.
  - Acceptance Criteria:
    - [x] `docs/migration-contracts.md` equivalent in plan artifacts is produced (route-by-route shape/status map).
    - [x] `grep -R "ConvexHttpClient" be/src/routes` returns mapped locations only.
  - QA Scenarios:
    - Scenario happy: run `curl` for each route fixture, capture normalized JSON to `.sisyphus/evidence/task-1-contract-snapshots.json`.
    - Scenario negative: intentionally call invalid route payload and confirm current error code snapshot saved to `.sisyphus/evidence/task-1-error-snapshots.json`.

- [x] 2. Define ID mapping and invariants spec
  - What to do: define mapping from Convex `_id` to Postgres PKs, preserving external `orderId` invariants.
  - Must NOT do: expose internal PK changes to frontend.
  - Recommended Agent Profile: category `quick`; skills `none`.
  - Parallelization: YES, Wave 1; Blocks T5/T11/T12/T18; Blocked by None.
  - References:
    - `be/convex/schema.ts` - current id usage and relationships.
    - `be/convex/orders.ts` - `orderId` generation/usage.
    - `be/src/utils/qr-code.ts` - QR payload depends on `orderId`.
  - Acceptance Criteria:
    - [x] Spec documents immutable `orderId` behavior.
    - [x] FK mapping rules documented for users/events/orders/scan_logs.
  - QA Scenarios:
    - Happy: validate sample mapping manifest parse with script output `.sisyphus/evidence/task-2-id-map-ok.txt`.
    - Negative: run validator on malformed mapping and assert rejection, `.sisyphus/evidence/task-2-id-map-error.txt`.

- [x] 3. Add Postgres runtime config and connection env wiring
  - What to do: add `DATABASE_URL` formatted for Prisma, startup health probe.
  - Must NOT do: remove Convex env keys yet.
  - Recommended Agent Profile: category `quick`.
  - Parallelization: YES, Wave 1; Blocks T8/T18; Blocked by None.
  - References:
    - `be/.env.example` - current env conventions.
    - `be/src/app.ts` - env loading.
    - `be/src/server.ts` - startup logging/health context.
  - Acceptance Criteria:
    - [x] Backend starts with Postgres env set.
    - [x] `/health` includes db connectivity status.
  - QA Scenarios:
    - Happy: run server with valid `DATABASE_URL`; `curl /health` returns db=ok, evidence `.sisyphus/evidence/task-3-health-ok.json`.
    - Negative: start with invalid `DATABASE_URL`; process logs db failure and exits non-zero, `.sisyphus/evidence/task-3-health-fail.txt`.

- [x] 4. Bootstrap Prisma ORM and Migration Tooling
  - What to do: initialize Prisma (`npx prisma init`), add migration CLI scripts.
  - Must NOT do: mix business logic into migration scripts.
  - Recommended Agent Profile: category `quick`.
  - Parallelization: YES, Wave 1; Blocks T5/T6/T18; Blocked by None.
  - References:
    - `be/package.json` - script style.
    - `pnpm-workspace.yaml` - workspace command conventions.
  - Acceptance Criteria:
    - [x] `prisma` dependencies added to `be/package.json`.
    - [x] `pnpm --filter be db:migrate` triggers `prisma migrate dev`.
  - QA Scenarios:
    - Happy: run `npx prisma migrate status`, record output `.sisyphus/evidence/task-4-migrate-up.txt`.
    - Negative: run invalid prisma command and assert safe error handling, `.sisyphus/evidence/task-4-migrate-down-error.txt`.

- [x] 5. Create core Prisma models (tables/enums/relations)
  - What to do: implement Prisma schema (`schema.prisma`) equivalent of Convex entities and relations.
  - Must NOT do: alter business meanings (status enums, checked-in semantics).
  - Recommended Agent Profile: category `unspecified-high`.
  - Parallelization: YES, Wave 1; Blocks T9-T13/T18; Blocked by T2/T4.
  - References:
    - `be/convex/schema.ts` - source model.
    - `be/convex/orders.ts` - status/field semantics.
    - `be/convex/events.ts`, `be/convex/users.ts` - event/user semantics.
  - Acceptance Criteria:
    - [x] models exist: `User`, `Event`, `Order`, `ScanLog`, `Gate`.
    - [x] Prisma constraints compile and migration generates cleanly.
  - QA Scenarios:
    - Happy: `npx prisma validate` passes, saved to `.sisyphus/evidence/task-5-schema-describe.txt`.
    - Negative: insert row violating FK and assert failure, `.sisyphus/evidence/task-5-fk-error.txt`.

- [x] 6. Add performance-critical indexes and constraints in Prisma
  - What to do: add `@unique` and `@@index` annotations in `schema.prisma` for scan path and stats queries.
  - Must NOT do: add speculative indexes without observed use.
  - Recommended Agent Profile: category `unspecified-high`.
  - Parallelization: YES, Wave 1; Blocks T12/T22; Blocked by T5.
  - References:
    - `be/convex/schema.ts` indexes.
    - `be/src/routes/scan.ts` query access patterns.
    - `be/convex/orders.ts` lookup/check-in paths.
  - Acceptance Criteria:
    - [x] `@unique` index on `orders.orderId`.
    - [x] Prisma creates correct indexes in migration SQL.
  - QA Scenarios:
    - Happy: Generated SQL contains `CREATE INDEX` for target paths; `.sisyphus/evidence/task-6-explain-ok.txt`.
    - Negative: duplicate `order_id` insert rejected; `.sisyphus/evidence/task-6-unique-error.txt`.

- [x] 7. Introduce backend test harness (vitest + supertest)
  - What to do: add minimal test infrastructure and first smoke test for `/health`.
  - Must NOT do: expand to unrelated frontend tests.
  - Recommended Agent Profile: category `quick`.
  - Parallelization: YES, Wave 1; Blocks T21; Blocked by None.
  - References:
    - `be/package.json` scripts.
    - `be/src/app.ts` express app factory.
  - Acceptance Criteria:
    - [x] `pnpm --filter be test` runs.
    - [x] smoke test passes in CI-like environment.
  - QA Scenarios:
    - Happy: test run output saved `.sisyphus/evidence/task-7-test-pass.txt`.
    - Negative: forced failing assertion returns non-zero and is captured `.sisyphus/evidence/task-7-test-fail.txt`.

- [x] 8. Implement Prisma Client + transaction helper + readiness guard
  - What to do: instantiate global `PrismaClient` and wrapper for route/repository usage (`$transaction`).
  - Must NOT do: instantiate multiple Prisma clients.
  - Recommended Agent Profile: category `quick`.
  - Parallelization: YES, Wave 2; Blocks T9-T14; Blocked by T3/T5.
  - References:
    - `be/src/utils/convex-api.ts` - current adapter boundary pattern.
    - `be/src/app.ts` - bootstrapping point.
  - Acceptance Criteria:
    - [x] single reusable Prisma module exists (`be/src/db/prisma.ts`).
    - [x] transaction helper supports rollback on error.
  - QA Scenarios:
    - Happy: commit path persists row in test table using Prisma, `.sisyphus/evidence/task-8-tx-commit.txt`.
    - Negative: throw mid-transaction and assert rollback via Prisma `$transaction`, `.sisyphus/evidence/task-8-tx-rollback.txt`.

- [x] 9. Implement Users repository
  - What to do: create/get-by-email/get-by-id/get-user-orders parity methods.
  - Must NOT do: change user uniqueness semantics.
  - Recommended Agent Profile: category `unspecified-high`.
  - Parallelization: YES, Wave 2; Blocks T14/T15; Blocked by T5/T8.
  - References:
    - `be/convex/users.ts` behavior source.
    - `be/src/routes/users.ts` route expectations.
  - Acceptance Criteria:
    - [x] user create-or-get idempotent by email.
    - [x] orders enrichment includes event data like current behavior.
  - QA Scenarios:
    - Happy: create same email twice returns same user id, `.sisyphus/evidence/task-9-idempotent.txt`.
    - Negative: missing email input rejected by repository contract, `.sisyphus/evidence/task-9-invalid-input.txt`.

- [x] 10. Implement Events repository
  - What to do: list active, get by id, create, stats aggregation parity.
  - Must NOT do: change sorting/default active filters unexpectedly.
  - Recommended Agent Profile: category `unspecified-high`.
  - Parallelization: YES, Wave 2; Blocks T14/T15/T17; Blocked by T5/T8.
  - References:
    - `be/convex/events.ts`.
    - `be/src/routes/events.ts`.
  - Acceptance Criteria:
    - [x] active list and stats math parity validated.
  - QA Scenarios:
    - Happy: stats endpoint fixture equals expected aggregate numbers, `.sisyphus/evidence/task-10-stats-ok.json`.
    - Negative: unknown event id returns null/not-found contract, `.sisyphus/evidence/task-10-notfound.json`.

- [x] 11. Implement Orders repository
  - What to do: create, mark-paid, get-by-orderId, capacity checks, QR-readiness support.
  - Must NOT do: alter `orderId` format or payment status semantics.
  - Recommended Agent Profile: category `deep`.
  - Parallelization: YES, Wave 2; Blocks T14/T15/T16; Blocked by T2/T5/T8.
  - References:
    - `be/convex/orders.ts` create/markAsPaid/getByOrderId.
    - `be/src/routes/orders.ts` status and payload expectations.
    - `be/src/utils/qr-code.ts` QR generation dependency.
  - Acceptance Criteria:
    - [x] capacity check prevents oversell.
    - [x] `markAsPaid` and `getByOrderId` parity maintained.
  - QA Scenarios:
    - Happy: paid order returns QR-capable payload, `.sisyphus/evidence/task-11-paid-order.json`.
    - Negative: oversell attempt fails with expected error, `.sisyphus/evidence/task-11-oversell-error.json`.

- [x] 12. Implement Scan repository with atomic check-in semantics
  - What to do: validate/check-in/logScan/getStats methods with transaction safety.
  - Must NOT do: drop `already_used/not_paid/not_found/wrong_event` semantics.
  - Recommended Agent Profile: category `deep`.
  - Parallelization: YES, Wave 2; Blocks T14/T16/T19/T22; Blocked by T2/T5/T6/T8.
  - References:
    - `be/convex/orders.ts` checkIn/validate/logScan.
    - `be/src/routes/scan.ts` status codes and payloads.
    - `be/src/utils/redis-lock.ts` lock/cache coordination.
  - Acceptance Criteria:
    - [x] double scan never produces two successes.
    - [x] scan logs persist with same result taxonomy.
  - QA Scenarios:
    - Happy: first scan returns `success=true code=VALID`, `.sisyphus/evidence/task-12-first-scan.json`.
    - Negative: second scan same ticket returns 409 already-used, `.sisyphus/evidence/task-12-second-scan-409.json`.

- [x] 13. Implement Dashboard repository parity
  - What to do: aggregate analytics + enriched logs equivalent to `getDashboardData`.
  - Must NOT do: reduce required fields used by frontend dashboard.
  - Recommended Agent Profile: category `unspecified-high`.
  - Parallelization: YES, Wave 2; Blocks T14/T17; Blocked by T5/T8/T10/T11/T12.
  - References:
    - `be/convex/orders.ts` `getDashboardData`.
    - `be/src/routes/dashboard.ts` output use.
  - Acceptance Criteria:
    - [x] analytics totals and scanLogs structure parity confirmed.
  - QA Scenarios:
    - Happy: dashboard endpoint returns analytics + logs fields, `.sisyphus/evidence/task-13-dashboard-ok.json`.
    - Negative: unauthorized dashboard call still 401, `.sisyphus/evidence/task-13-dashboard-unauth.json`.

- [x] 14. Direct migration of users/events/orders routes
  - What to do: replace Convex client calls in those routes with Prisma repository calls.
  - Must NOT do: implement dual-writes or complex facades.
  - Recommended Agent Profile: category `deep`.
  - Parallelization: YES, Wave 3; Blocks T17; Blocked by T9/T10/T11.
  - References:
    - `be/src/routes/users.ts`, `events.ts`, `orders.ts`
  - Acceptance Criteria:
    - [x] route endpoints function directly from Postgres with no Convex dependencies.

- [x] 15. Direct migration of scan route
  - What to do: switch `/api/scan/verify|validate|stats` to Prisma repository while preserving Redis lock/cache flow.
  - Must NOT do: change lock key prefixes/TTL behavior.
  - Recommended Agent Profile: category `deep`.
  - Parallelization: YES, Wave 3; Blocks T17; Blocked by T11/T12.
  - References:
    - `be/src/routes/scan.ts`, `be/src/utils/redis-lock.ts`
  - Acceptance Criteria:
    - [x] lock acquire/release path still wraps check-in flow via Postgres.

- [x] 16. Direct migration of dashboard route
  - What to do: replace Convex query call with Prisma repository call.
  - Recommended Agent Profile: category `unspecified-high`.
  - Parallelization: YES, Wave 3; Blocks T17; Blocked by T10/T13.
  - References:
    - `be/src/routes/dashboard.ts`
  - Acceptance Criteria:
    - [x] dashboard data shape equals baseline shape but sourced from Postgres.

- [x] 17. Remove Convex runtime dependency
  - What to do: completely remove Convex client usage, convex folder, and env vars. Delete convex package.
  - Must NOT do: leave any orphaned convex code.
  - Recommended Agent Profile: category `quick`.
  - Parallelization: YES, Wave 3; Blocks FINAL; Blocked by T14/T15/T16.
  - References:
    - `be/package.json` scripts, `be/src/utils/convex-api.ts`, `be/convex/`
  - Acceptance Criteria:
    - [x] no runtime Convex imports remain in backend route path.
    - [x] `convex` folder deleted.

---

## Final Verification Wave (MANDATORY)
- [x] F1. **Plan Compliance Audit** - `oracle`
  - Verify each must-have and must-not-have against implementation and evidence files.
  - Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT`

- [x] F2. **Code Quality Review** - `unspecified-high`
  - Run build/lint/tests, inspect for unsafe patterns and migration shortcuts.
  - Output: `Build | Lint | Tests | VERDICT`

- [x] F3. **Real QA Execution** - `unspecified-high`
  - Execute all task QA scenarios from evidence list, including canary and rollback drills.
  - Output: `Scenarios [N/N] | Integration [N/N] | VERDICT`

- [x] F4. **Scope Fidelity Check** - `deep`
  - Ensure all changes map 1:1 to migration plan scope and no unrelated refactors shipped.
  - Output: `Tasks [N/N compliant] | Scope Creep [NONE/FOUND] | VERDICT`

---

## Commit Strategy

| After Task Group | Message Pattern | Files | Verification |
|------------------|-----------------|-------|--------------|
| Wave 1 | `chore(db): bootstrap prisma and postgres foundation` | schema/config/migrations/tests scaffold | migrate + smoke test |
| Wave 2 | `feat(storage): add prisma repositories and facade` | `be/src/db/*`, facade | unit tests + contract smoke |
| Wave 3 | `feat(api): migrate routes directly to postgres` | `be/src/routes/*`, `be/convex/` | full regression |

---

## Success Criteria

### Verification Commands
```bash
# backend tests
pnpm --filter be test

# contract/parity checks
pnpm --filter be test:parity

# load benchmark (scan)
pnpm --filter be bench:scan

# db migration + schema checks
pnpm --filter be db:migrate
npx prisma validate
```

### Final Checklist
- [x] All must-have requirements verified by evidence files.
- [x] All must-not-have guardrails satisfied.
- [x] All must-have requirements verified by evidence files.
- [x] Contract endpoints run directly against Postgres.
- [x] Scan concurrency correctness verified (no double-success).
- [x] Convex runtime completely removed.
