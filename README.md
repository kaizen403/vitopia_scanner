# Fest Entry Verification System

A QR-based entry verification system for college fests and events. This system allows organizers to securely verify event registrations at entry gates using QR codes, while preventing duplicate entries, fake tickets, and race conditions across multiple scanning points.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Express API   │────▶│     Redis       │
│   (Next.js)     │     │   (Node.js)     │     │  (Dist. Lock)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │     Convex      │
                        │   (Database)    │
                        └─────────────────┘
```

## Features

- **QR-based ticket verification** - JWT-signed QR codes for tamper-proof tickets
- **One-time ticket usage enforcement** - Prevents duplicate entries
- **Real-time scan validation** - Sub-100ms response times
- **Multiple gate support** - Distributed locking prevents race conditions
- **Admin dashboard** - Real-time entry statistics and event management
- **Mobile-friendly scanner** - Works on any device with a camera

## Project Structure

```
├── be/                          # Backend
│   ├── convex/                  # Convex database schema & functions
│   │   ├── schema.ts            # Database schema (users, events, orders, scanLogs)
│   │   ├── events.ts            # Event CRUD operations
│   │   ├── orders.ts            # Order management & check-in
│   │   └── users.ts             # User management
│   ├── src/
│   │   ├── server.ts            # Express server entry point
│   │   ├── routes/
│   │   │   ├── scan.ts          # QR verification endpoints
│   │   │   ├── events.ts        # Event API endpoints
│   │   │   ├── orders.ts        # Order API endpoints
│   │   │   └── users.ts         # User API endpoints
│   │   ├── utils/
│   │   │   ├── redis-lock.ts    # Distributed locking with Redis
│   │   │   └── qr-code.ts       # JWT-signed QR code generation
│   │   └── middleware/
│   │       └── auth.ts          # Gate authentication & rate limiting
│   └── package.json
│
├── fe/                          # Frontend (Next.js)
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── events/
│   │   │   ├── page.tsx         # Event listing
│   │   │   └── [id]/page.tsx    # Event details & ticket purchase
│   │   ├── scanner/page.tsx     # QR scanner for gate volunteers
│   │   ├── admin/page.tsx       # Admin dashboard
│   │   └── ticket/[orderId]/page.tsx  # Ticket display with QR
│   ├── lib/
│   │   └── api.ts               # API client functions
│   └── package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for running local Redis and Database services)

### Installation & Running Locally

1. **Install dependencies from the project root:**
   ```bash
   pnpm install
   ```

2. **Setup Environment Variables:**
   Make sure you have your `.env` and `.env.local` files configured in the respective `be`, `fe`, and `admin` directories as needed.

3. **Start external services (e.g. Redis):**
   ```bash
   pnpm run redis:up
   ```

4. **Start all development servers (Frontend, Admin, and Backend):**
   ```bash
   pnpm run dev:all
   ```

   This single command will launch:
   - **Frontend App:** `http://localhost:3000`
   - **Backend API:** `http://localhost:3001`
   - **Admin Dashboard:** `http://localhost:3002`

*(To stop the background Redis container later, run `pnpm run redis:down`)*

## API Endpoints

### Scan Endpoints
- `POST /api/scan/verify` - Verify and check-in a ticket
- `POST /api/scan/validate` - Validate ticket without check-in
- `GET /api/scan/stats/:eventId` - Real-time scanning statistics

### Event Endpoints
- `GET /api/events` - List all active events
- `GET /api/events/:id` - Get event details
- `POST /api/events` - Create new event (admin)
- `GET /api/events/:id/stats` - Get event statistics

### Order Endpoints
- `POST /api/orders` - Create new order
- `POST /api/orders/:orderId/pay` - Process payment (simulated)
- `GET /api/orders/:orderId` - Get order with QR code

### User Endpoints
- `POST /api/users` - Create or get user
- `GET /api/users/:id` - Get user details
- `GET /api/users/:id/orders` - Get user's orders

## How the Verification Flow Works

1. **Ticket Purchase**
   - User registers and purchases tickets
   - System generates unique Order ID
   - JWT-signed QR code is created containing order details

2. **Entry Scanning**
   - Volunteer scans QR code at gate
   - System verifies JWT signature (prevents tampering)
   - Redis lock acquired to prevent concurrent scans
   - Convex checks ticket validity and check-in status
   - Entry decision returned in <100ms

3. **Race Condition Prevention**
   - Redis distributed lock ensures only one gate can process a ticket at a time
   - Lock has 5-second TTL to prevent deadlocks
   - Failed scans are cached for fast rejection

## Security Features

- **JWT-signed QR codes** - Tickets cannot be forged or modified
- **Distributed locking** - Prevents double-entry from multiple gates
- **Rate limiting** - Protects against DoS attacks
- **Scan logging** - Full audit trail of all scan attempts

## Production Deployment

### Backend
- Deploy Express server to Railway, Render, or AWS
- Deploy Convex functions with `npx convex deploy`
- Use managed Redis (Upstash recommended)

### Frontend
- Deploy to Vercel (recommended for Next.js)
- Set `NEXT_PUBLIC_API_URL` to production backend URL

## Environment Variables

### Backend (.env)
```
CONVEX_URL=https://your-deployment.convex.cloud
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key
PORT=3001
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## License

MIT
