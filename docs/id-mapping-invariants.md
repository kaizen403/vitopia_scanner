# ID Mapping and Invariants Spec (Task 2)

## Scope

This spec defines how Convex document identifiers (`_id`) map into Postgres primary and foreign keys for the migration path.

It also locks the externally visible identifier contract:

- `orderId` remains the immutable external order key.
- QR code verification and API routes continue to treat `orderId` as the ticket identity.
- Internal Postgres primary key changes are never exposed as replacement identifiers to frontend callers.

## Canonical Rules

1. Postgres internal keys use UUID primary keys (`id`) for all core tables.
2. Convex `_id` values are persisted as provenance in nullable, unique columns named `convex_id` on migrated root entities.
3. Internal relations use Postgres UUID foreign keys only.
4. `orders.order_id` is a dedicated immutable external key, separate from `orders.id`.
5. `scan_logs.order_id` stores the external order key (not internal UUID) to preserve scanner/debug compatibility.
6. Any API or QR flow that currently accepts/returns `orderId` keeps doing so unchanged.

## Table Mapping

| Entity | Convex source id | Postgres PK | External identifier(s) | Required uniqueness | Notes |
|---|---|---|---|---|---|
| `users` | `users._id` | `users.id` (UUID) | none | `users.convex_id` unique when present | `email` uniqueness remains business-level constraint. |
| `events` | `events._id` | `events.id` (UUID) | none | `events.convex_id` unique when present | Used by orders/gates/scan logs relations. |
| `orders` | `orders._id` | `orders.id` (UUID) | `orders.order_id` (string) | `orders.order_id` unique, immutable; `orders.convex_id` unique when present | `order_id` is QR/API contract key. |
| `scan_logs` | `scanLogs._id` (optional provenance) | `scan_logs.id` (UUID) | `scan_logs.order_id` mirrors external `orders.order_id` | optional `scan_logs.convex_id` unique when present | Preserve historical scans even if order row is deleted later. |
| `gates` | `gates._id` | `gates.id` (UUID) | `gates.gate_id` (string) | `gates.gate_id` unique; `gates.convex_id` unique when present | `gate_id` remains operational/public gate token. |

## Foreign Key Mapping

| Source relation (Convex) | Postgres column | References | Constraint |
|---|---|---|---|
| `orders.userId -> users._id` | `orders.user_id` (UUID) | `users.id` | `NOT NULL`, FK required |
| `orders.eventId -> events._id` | `orders.event_id` (UUID) | `events.id` | `NOT NULL`, FK required |
| `scanLogs.eventId -> events._id` | `scan_logs.event_id` (UUID) | `events.id` | `NOT NULL`, FK required |
| `scanLogs.orderId -> orders.orderId` | `scan_logs.order_id` (string) | `orders.order_id` | `NOT NULL`, FK to external key |
| `gates.eventId -> events._id` | `gates.event_id` (UUID) | `events.id` | `NOT NULL`, FK required |

## `orderId` Invariants (MUST HOLD)

1. Creation: `orderId` is generated once at order creation and written to `orders.order_id`.
2. Immutability: `orders.order_id` is never updated after insert.
3. Uniqueness: `orders.order_id` has a unique constraint and is queryable by index.
4. QR coupling: QR token payload/signature binds to `orderId` exactly.
5. API coupling: order routes and scan routes continue to use `orderId` in request paths and response payloads.
6. Migration safety: Convex `_id` is not substituted for `orderId` in any external contract.

## Legacy Convex ID Handling

- Store legacy Convex IDs in provenance columns:
  - `users.convex_id`
  - `events.convex_id`
  - `orders.convex_id`
  - `scan_logs.convex_id` (optional for backfilled logs)
  - `gates.convex_id`
- Each `convex_id` column is nullable but unique where present.
- Backfill must maintain deterministic mapping from every referenced Convex `_id` to a Postgres UUID before inserting dependent rows.
- Provenance columns are for migration/debug only and not part of frontend/API output contracts.

## Validator Manifest Contract

The Task 2 validator checks a migration manifest with this minimum shape:

```json
{
  "users": [{"convexId": "users:abc", "postgresId": "uuid"}],
  "events": [{"convexId": "events:abc", "postgresId": "uuid"}],
  "orders": [{"convexId": "orders:abc", "postgresId": "uuid", "orderId": "ORD-..."}],
  "scanLogs": [{"convexId": "scanLogs:abc", "postgresId": "uuid", "orderId": "ORD-...", "eventPostgresId": "uuid"}],
  "gates": [{"convexId": "gates:abc", "postgresId": "uuid", "eventPostgresId": "uuid", "gateId": "gate-a"}]
}
```

Validation rules:

- every `postgresId`/`eventPostgresId` must be UUID-like;
- `orders.orderId` must match `^ORD-[A-Z0-9-]+$` and be unique;
- each `scanLogs.orderId` must exist in mapped orders;
- each FK reference (`eventPostgresId`) must exist in mapped events;
- duplicate Convex IDs or duplicate Postgres IDs are rejected per entity.

## Worked Mapping Example

| Convex | Postgres | External |
|---|---|---|
| `orders:qx7...` | `0e179f35-6a6a-49dc-bb6a-79f8f6bbf4c9` | `ORD-MXL2U9A7-1A2B3C` |
| `scanLogs:pb2...` | `19364f32-e8fd-4cfd-9498-3523b95db796` | `order_id=ORD-MXL2U9A7-1A2B3C` |

Interpretation:

- APIs continue using `ORD-MXL2U9A7-1A2B3C`.
- Internal joins use UUIDs (`orders.id`, `events.id`).
- Legacy source IDs remain queryable via `convex_id` for audit/backfill reconciliation.
