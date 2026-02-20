# Migration Contract Manifest (Task 1)

This document captures the current API contract surface and every Convex touchpoint used by the backend routes for `scan`, `events`, `orders`, `users`, and `dashboard`. It is baseline-only documentation; no runtime behavior changes were made.

## Route Mount Points

From `be/src/app.ts`:

- `/api/scan` -> `be/src/routes/scan.ts`
- `/api/events` -> `be/src/routes/events.ts`
- `/api/orders` -> `be/src/routes/orders.ts`
- `/api/users` -> `be/src/routes/users.ts`
- `/api/dashboard` -> `be/src/routes/dashboard.ts`

## Convex Client Instantiation Map

Explicit mapping for `grep -R "ConvexHttpClient" be/src/routes`:

```txt
be/src/routes/events.ts:2,9,14
be/src/routes/users.ts:3,9,14
be/src/routes/dashboard.ts:2,9,14
be/src/routes/orders.ts:2,9,14
be/src/routes/scan.ts:2,11,16
```

`new ConvexHttpClient(url)` call sites (AST confirmed):

- `be/src/routes/scan.ts:16`
- `be/src/routes/events.ts:14`
- `be/src/routes/orders.ts:14`
- `be/src/routes/users.ts:14`
- `be/src/routes/dashboard.ts:14`

## Dynamic Convex API Loader Touchpoint

`be/src/utils/convex-api.ts` is the shared runtime boundary:

- `loadConvexApi()` resolves generated module from:
  - `convex/_generated/api.js`
  - `be/convex/_generated/api.js`
- Throws `Convex API not generated. Run 'npx convex dev' first.` if neither path exists.

All five mapped route files call `loadConvexApi()` before using Convex query/mutation functions.

## Contract Map By Route

## Scan (`be/src/routes/scan.ts`)

- `POST /api/scan/verify`
  - Middleware: `gateAuthMiddleware`, `rateLimitMiddleware(100)`.
  - Request keys: `qrCode` (required), `eventId` (optional).
  - Success `200`: `{ success: true, message: "Entry allowed", code: "VALID", data, responseTime }`.
  - Error statuses:
    - `400` missing QR -> `code: "MISSING_QR_CODE"`.
    - `400` invalid QR signature -> `code: "INVALID_QR"`.
    - `409` concurrent lock -> `code: "CONCURRENT_SCAN"`.
    - `409` already used -> `code: "ALREADY_USED"` (+ `checkedInAt`, `data`, `responseTime`).
    - `404` not found from check-in result -> `code: "NOT_FOUND"`.
    - `402` not paid from check-in result -> `code: "NOT_PAID"`.
    - `500` unexpected failure -> `code: "SERVER_ERROR"`.
  - Convex touchpoints:
    - `query(api.orders.getByOrderId)` for cached already-used enrichment.
    - `mutation(api.orders.checkIn)` for atomic check-in decision.
    - `mutation(api.orders.logScan)` for audit logging (success and failure).

- `POST /api/scan/validate`
  - Middleware: `gateAuthMiddleware`.
  - Request keys: `qrCode` (required).
  - Success `200`: `{ success: true, message: "Ticket is valid", code: "VALID", data }`.
  - Error statuses:
    - `400` missing QR -> `code: "MISSING_QR_CODE"`.
    - `400` invalid QR -> `code: "INVALID_QR"`.
    - `409` reason `already_used` -> `code: "ALREADY_USED"`.
    - `404` reason `not_found` -> `code: "NOT_FOUND"`.
    - `402` reason `not_paid` -> `code: "NOT_PAID"`.
    - `500` -> `code: "SERVER_ERROR"`.
  - Convex touchpoint: `query(api.orders.validate)`.

- `GET /api/scan/stats/:eventId`
  - Success `200`: `{ success: true, data: { ...realtimeStats, ...eventStats } }`.
  - Error `500`: `{ success: false, error: "Failed to get statistics" }`.
  - Convex touchpoint: `query(api.events.getStats)`.
  - Redis touchpoint: `getRealtimeStats(eventId)` merged with Convex stats.

## Events (`be/src/routes/events.ts`)

- `GET /api/events`
  - Success `200`: `{ success: true, data: Event[] }`.
  - Error `500`: `{ success: false, error: "Failed to fetch events" }`.
  - Convex touchpoint: `query(api.events.listActive)`.

- `GET /api/events/:id`
  - Success `200`: `{ success: true, data: Event }`.
  - Not found `404`: `{ success: false, error: "Event not found" }`.
  - Error `500`: `{ success: false, error: "Failed to fetch event" }`.
  - Convex touchpoint: `query(api.events.getById)`.

- `POST /api/events`
  - Request keys required: `name`, `description`, `date`, `venue`, `capacity`, `price`.
  - Validation error `400`: `{ success: false, error: "Missing required fields" }`.
  - Success `201`: `{ success: true, data: { eventId } }`.
  - Error `500`: `{ success: false, error: "Failed to create event" }`.
  - Convex touchpoint: `mutation(api.events.create)`.

- `GET /api/events/:id/stats`
  - Success `200`: `{ success: true, data: EventStats }`.
  - Not found `404`: `{ success: false, error: "Event not found" }`.
  - Error `500`: `{ success: false, error: "Failed to fetch stats" }`.
  - Convex touchpoint: `query(api.events.getStats)`.

## Orders (`be/src/routes/orders.ts`)

- `POST /api/orders`
  - Request keys required: `userId`, `eventId`, `quantity`.
  - Validation error `400`: `{ success: false, error: "Missing required fields: userId, eventId, quantity" }`.
  - Success `201`: `{ success: true, data: { id, orderId, totalAmount } }` (shape from Convex mutation result).
  - Route catch error `400`: `{ success: false, error: error.message || "Failed to create order" }`.
  - Convex touchpoint: `mutation(api.orders.create)`.

- `POST /api/orders/:orderId/pay`
  - Not found `404`: `{ success: false, error: "Order not found" }`.
  - Success `200`: `{ success: true, message: "Payment successful", data: { orderId, qrCode } }`.
  - Route catch error `400`: `{ success: false, error: error.message || "Payment failed" }`.
  - Convex touchpoints:
    - `query(api.orders.getByOrderId)`.
    - `mutation(api.orders.markAsPaid)`.

- `GET /api/orders/:orderId`
  - Not found `404`: `{ success: false, error: "Order not found" }`.
  - Success `200`: `{ success: true, data: { ...order, qrCode } }` where `qrCode` is present only when `paymentStatus === "paid"`.
  - Error `500`: `{ success: false, error: "Failed to fetch order" }`.
  - Convex touchpoint: `query(api.orders.getByOrderId)`.

- `GET /api/orders/:orderId/qr`
  - Not found `404`: `{ success: false, error: "Order not found" }`.
  - Unpaid `400`: `{ success: false, error: "Order is not paid. QR code not available." }`.
  - Success `200`: `{ success: true, data: { qrCode } }`.
  - Error `500`: `{ success: false, error: "Failed to generate QR code" }`.
  - Convex touchpoint: `query(api.orders.getByOrderId)`.

## Users (`be/src/routes/users.ts`)

- `POST /api/users`
  - Request keys required: `email`, `name` (`phone`, `college` optional).
  - Validation error `400`: `{ success: false, error: "Missing required fields: email, name" }`.
  - Success `201`: `{ success: true, data: { userId } }`.
  - Error `500`: `{ success: false, error: "Failed to create user" }`.
  - Convex touchpoint: `mutation(api.users.createOrGet)`.

- `GET /api/users/email/:email`
  - Success `200`: `{ success: true, data: User }`.
  - Not found `404`: `{ success: false, error: "User not found" }`.
  - Error `500`: `{ success: false, error: "Failed to fetch user" }`.
  - Convex touchpoint: `query(api.users.getByEmail)`.

- `GET /api/users/:id`
  - Success `200`: `{ success: true, data: User }`.
  - Not found `404`: `{ success: false, error: "User not found" }`.
  - Error `500`: `{ success: false, error: "Failed to fetch user" }`.
  - Convex touchpoint: `query(api.users.getById)`.

- `GET /api/users/:id/orders`
  - Success `200`: `{ success: true, data: Order[] }`.
  - Error `500`: `{ success: false, error: "Failed to fetch user orders" }`.
  - Convex touchpoint: `query(api.users.getOrders)`.

## Dashboard (`be/src/routes/dashboard.ts`)

- `POST /api/dashboard/auth`
  - Request key: `pin` (must be 6-char string).
  - Validation `400`: `{ success: false, error: "A 6-digit PIN is required" }`.
  - Rate limit `429`: `{ success: false, error: "Too many attempts. Try again later.", retryAfter }`.
  - Invalid pin `401`: `{ success: false, error: "Incorrect PIN", attemptsRemaining }`.
  - Success `200`: `{ success: true, token }`.
  - Convex touchpoints: none.

- `GET /api/dashboard/data`
  - Auth error `401`: `{ success: false, error: "Authorization required" }`.
  - Success `200`: `{ success: true, data: DashboardData }`.
  - Error `500`: `{ success: false, error: "Failed to load dashboard data" }`.
  - Convex touchpoint: `query(api.orders.getDashboardData)`.

## Frontend Dependency Surface (`fe/lib/api.ts`)

- Shared transport expects backend envelope `{ success, data?, error?, code? }`.
- `getEvents`, `getEvent`, `getEventStats` rely on `data` and silently coerce missing data to `[]`/`null`.
- `createUser` expects `data.userId`.
- `createOrder` expects `data.{id, orderId, totalAmount}`.
- `payOrder` expects `data.{orderId, qrCode}`.
- `getOrder` expects full order object and optional `qrCode`.
- `verifyTicket` and `validateTicket` bypass helper and parse raw JSON directly; scanner UI depends on `code`, `success`, `error`/`message`, `data`, and optional `responseTime`.
- `getScanStats` expects merged stats payload keys: `activeScans`, `recentScansPerMinute`, plus event-level stats keys.

## Snapshot Evidence (Task 1 QA)

- Happy/baseline fixtures: `.sisyphus/evidence/task-1-contract-snapshots.json`
- Negative fixtures: `.sisyphus/evidence/task-1-error-snapshots.json`
- Command execution note: snapshots are generated by runnable `curl` calls against a local backend process (`pnpm --filter be exec tsx src/server.ts`, `PORT=3101`).
- Environment constraints observed during snapshot run:
  - Redis unavailable (`ECONNREFUSED 127.0.0.1:6379`) impacted scan middleware and stats paths.
  - Convex backend unavailable (`CONVEX_URL` fixture host) produced expected route-level failure envelopes (`500` or route-specific catch behavior) for Convex-backed reads/writes.
  - Negative validation/auth contracts still returned deterministic current status/code semantics (e.g., `MISSING_GATE_ID`, dashboard `401`, required-field `400`).
