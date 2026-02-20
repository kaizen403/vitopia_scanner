import { createApp } from "./app.js";
import { startVtopiaCronJob } from "./jobs/vtopiaSync.js";
import { validateDatabaseUrl } from "./db/readiness.js";

const parseDatabaseUrlOrThrow = (): URL => {
  const databaseUrl = process.env.DATABASE_URL;
  const validation = validateDatabaseUrl(databaseUrl);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return new URL(databaseUrl as string);
};

try {
  const parsedDatabaseUrl = parseDatabaseUrlOrThrow();
  console.log(
    `[startup] DATABASE_URL configured for ${parsedDatabaseUrl.hostname}:${parsedDatabaseUrl.port || "5432"}`
  );
} catch (err) {
  console.error(`[startup] ${err instanceof Error ? err.message : "Invalid DATABASE_URL"}`);
  process.exit(1);
}

const app = createApp();
const PORT = process.env.PORT || 3001;

// Start background sync jobs
startVtopiaCronJob();

// Start server
app.listen(PORT, () => {
  console.log(`
🎫 Fest Entry Verification System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on http://localhost:${PORT}
Health check: http://localhost:${PORT}/health

API Endpoints:
  POST /api/scan/verify     - Verify & check-in ticket
  POST /api/scan/validate   - Validate ticket (no check-in)
  GET  /api/scan/stats/:id  - Real-time scan statistics
  
  GET  /api/events          - List events
  POST /api/events          - Create event
  GET  /api/events/:id      - Get event details
  
  POST /api/users           - Create/get user
  GET  /api/users/:id       - Get user details
  
  POST /api/orders          - Create order
  POST /api/orders/:id/pay  - Process payment
  GET  /api/orders/:id      - Get order with QR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export default app;
