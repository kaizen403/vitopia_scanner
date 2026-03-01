import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import routes
import scanRoutes from "./routes/scan.js";
import eventsRoutes from "./routes/events.js";
import ordersRoutes from "./routes/orders.js";
import usersRoutes from "./routes/users.js";
import dashboardRoutes from "./routes/dashboard.js";
import mailRoutes from "./routes/mail.js";
import authRoutes from "./routes/auth.js";
import { errorHandler } from "./middleware/auth.js";
import { getDatabaseReadiness } from "./db/readiness.js";

import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

type AppOptions = {
  enableNotFound?: boolean;
  getDatabaseHealth?: () => Promise<{ connected: boolean; error?: string }>;
};

export const createApp = ({
  enableNotFound = true,
  getDatabaseHealth = getDatabaseReadiness,
}: AppOptions = {}): express.Express => {
  const app = express();

  // Production security headers
  app.use(helmet({
    contentSecurityPolicy: false,
  }));

  // Gzip compression
  app.use(compression());

  // Middleware — allow same-origin (combined server) + dev origins + droplet IP
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003", // Added main app local port
    "http://157.245.97.218",
    "https://157.245.97.218",
    "https://scanner.pims.in",
    "http://scanner.pims.in",
    "https://scanner.cytieq.com",
    "https://praana.pims.in",
    process.env.FRONTEND_URL,
    process.env.RENDER_EXTERNAL_URL,
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests with no origin (same-origin, curl, mobile apps)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Tighten security: only allow whitelisted origins
          console.warn(`[CORS Block] Forbidden origin: ${origin}`);
          callback(null, false);
        }
      },
      credentials: true,
    })
  );

  // Global rate limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, error: "Too many requests. Slow down." }
  });
  app.use("/api/", generalLimiter);

  // Auth rate limiter
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { success: false, error: "Too many login attempts." }
  });
  app.use("/api/auth/", authLimiter);

  app.use(express.json());

  // Health check
  app.get("/health", async (req, res) => {
    const db = await getDatabaseHealth();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "fest-entry-verification",
      db,
    });
  });

  // API Routes
  app.use("/api/scan", scanRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/mail", mailRoutes);

  // Error handling
  app.use(errorHandler);

  if (enableNotFound) {
    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
      });
    });
  }

  return app;
};
