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
import authRoutes from "./routes/auth.js";
import { errorHandler } from "./middleware/auth.js";

type AppOptions = {
  enableNotFound?: boolean;
};

export const createApp = ({ enableNotFound = true }: AppOptions = {}): express.Express => {
  const app = express();

  // Middleware — allow same-origin (combined server) + dev origins + droplet IP
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://157.245.97.218",
    "https://157.245.97.218",
    "https://scanner.vitap.in",
    "http://scanner.vitap.in",
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
          callback(null, true); // permissive — tighten in production if needed
        }
      },
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "fest-entry-verification",
    });
  });

  // API Routes
  app.use("/api/scan", scanRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);

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
