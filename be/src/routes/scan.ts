import { Router, Request, Response } from "express";
import { ConvexHttpClient } from "convex/browser";
import { getRedisLockManager } from "../utils/redis-lock.js";
import { verifyQRCode } from "../utils/qr-code.js";
import { gateAuthMiddleware, rateLimitMiddleware } from "../middleware/auth.js";
import { loadConvexApi } from "../utils/convex-api.js";

const router: Router = Router();

// Lazy-load Convex client (env vars not available at import time)
let _convex: ConvexHttpClient | null = null;
const getConvex = () => {
  if (!_convex) {
    const url = process.env.CONVEX_URL;
    if (!url) throw new Error("CONVEX_URL environment variable is required");
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
};

// Helper to get Convex API - dynamically loaded after convex dev generates types
const getApi = async () => loadConvexApi();

/**
 * POST /api/scan/verify
 * Main verification endpoint - verifies and checks in a ticket
 */
router.post(
  "/verify",
  gateAuthMiddleware,
  rateLimitMiddleware(100),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { qrCode, eventId } = req.body;
    const gate = (req as any).gate;

    if (!qrCode) {
      res.status(400).json({
        success: false,
        error: "QR code is required",
        code: "MISSING_QR_CODE",
      });
      return;
    }

    const lockManager = getRedisLockManager();

    try {
      const api = await getApi();
      
      // Step 1: Verify QR code signature
      const qrResult = verifyQRCode(qrCode);
      if (!qrResult.valid || !qrResult.payload) {
        res.status(400).json({
          success: false,
          error: qrResult.error || "Invalid QR code",
          code: "INVALID_QR",
        });
        return;
      }

      const { orderId } = qrResult.payload;

      // Step 2: Check Redis cache for fast rejection
      const cachedResult = await lockManager.getCachedScanResult(orderId);
      if (cachedResult.cached && cachedResult.result === "already_used") {
        // Fetch user/order data for rejected entry display
        let data: any = { orderId };
        try {
          const orderInfo = await getConvex().query(api.orders.getByOrderId, { orderId });
          if (orderInfo) {
            data = {
              orderId: orderInfo.orderId,
              quantity: orderInfo.quantity,
              user: orderInfo.user ? { name: orderInfo.user.name, email: orderInfo.user.email } : null,
              event: orderInfo.event ? { name: orderInfo.event.name, venue: orderInfo.event.venue } : null,
            };
          }
        } catch (_) { /* best-effort */ }

        res.status(409).json({
          success: false,
          error: "Ticket has already been used",
          code: "ALREADY_USED",
          checkedInAt: cachedResult.checkedInAt,
          data,
          responseTime: Date.now() - startTime,
        });
        return;
      }

      // Step 4: Acquire distributed lock
      const lockToken = await lockManager.acquireLock(orderId);
      if (!lockToken) {
        res.status(409).json({
          success: false,
          error: "Ticket is being scanned at another gate. Please wait.",
          code: "CONCURRENT_SCAN",
          responseTime: Date.now() - startTime,
        });
        return;
      }

      try {
        // Step 5: Perform check-in in Convex (includes event-match check)
        const result = await getConvex().mutation(api.orders.checkIn, {
          orderId,
          scannedBy: gate.id,
          gate: gate.id,
          expectedEventId: eventId ? eventId as any : undefined,
        });

        // Step 6: Update cache and log
        if (result.success) {
          await lockManager.cacheScanResult(orderId, "already_used", Date.now());
          if (result.eventId) {
            await lockManager.incrementScanCount(result.eventId);
          }

          await getConvex().mutation(api.orders.logScan, {
            orderId,
            eventId: result.eventId as any,
            scanResult: "success",
            scannedBy: gate.id,
            gate: gate.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });

          res.json({
            success: true,
            message: "Entry allowed",
            code: "VALID",
            data: {
              orderId: result.order?.orderId,
              quantity: result.order?.quantity,
              user: result.user,
              event: result.event,
            },
            responseTime: Date.now() - startTime,
          });
        } else {
          // Cache invalid results
          if (result.reason === "already_used") {
            await lockManager.cacheScanResult(
              orderId,
              "already_used",
              result.checkedInAt
            );
          }

          await getConvex().mutation(api.orders.logScan, {
            orderId,
            eventId: result.eventId as any,
            scanResult: result.reason as any,
            scannedBy: gate.id,
            gate: gate.id,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });

          const errorMessages: Record<string, string> = {
            already_used: "Already scanned",
            not_found: "Not found",
            not_paid: "Not paid",
          };

          const statusCodes: Record<string, number> = {
            already_used: 409,
            not_found: 404,
            not_paid: 402,
          };

          res.status(statusCodes[result.reason] || 400).json({
            success: false,
            error: errorMessages[result.reason] || "Invalid ticket",
            code: result.reason.toUpperCase(),
            checkedInAt: result.checkedInAt,
            checkedInBy: result.checkedInBy,
            data: {
              orderId: result.order?.orderId,
              quantity: result.order?.quantity,
              user: result.user,
              event: result.event,
            },
            responseTime: Date.now() - startTime,
          });
        }
      } finally {
        // Always release the lock
        await lockManager.releaseLock(orderId, lockToken);
      }
    } catch (error) {
      console.error("Scan error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify ticket",
        code: "SERVER_ERROR",
        responseTime: Date.now() - startTime,
      });
    }
  }
);

/**
 * POST /api/scan/validate
 * Quick validation without check-in
 */
router.post(
  "/validate",
  gateAuthMiddleware,
  async (req: Request, res: Response) => {
    const { qrCode } = req.body;

    if (!qrCode) {
      res.status(400).json({
        success: false,
        error: "QR code is required",
        code: "MISSING_QR_CODE",
      });
      return;
    }

    try {
      const api = await getApi();
      
      // Verify QR code signature
      const qrResult = verifyQRCode(qrCode);
      if (!qrResult.valid || !qrResult.payload) {
        res.status(400).json({
          success: false,
          error: qrResult.error || "Invalid QR code",
          code: "INVALID_QR",
        });
        return;
      }

      const { orderId } = qrResult.payload;

      // Check with Convex
      const result = await getConvex().query(api.orders.validate, { orderId });

      if (result.valid) {
        res.json({
          success: true,
          message: "Ticket is valid",
          code: "VALID",
          data: {
            orderId: result.order?.orderId,
            quantity: result.order?.quantity,
            user: result.user,
            event: result.event,
          },
        });
      } else {
        const statusCodes: Record<string, number> = {
          already_used: 409,
          not_found: 404,
          not_paid: 402,
        };

        res.status(statusCodes[result.reason] || 400).json({
          success: false,
          error: result.reason,
          code: result.reason.toUpperCase(),
          checkedInAt: result.checkedInAt,
        });
      }
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to validate ticket",
        code: "SERVER_ERROR",
      });
    }
  }
);

/**
 * GET /api/scan/stats/:eventId
 * Get real-time scanning statistics
 */
router.get("/stats/:eventId", async (req: Request, res: Response) => {
  const { eventId } = req.params;

  try {
    const api = await getApi();
    const lockManager = getRedisLockManager();
    const [realtimeStats, eventStats] = await Promise.all([
      lockManager.getRealtimeStats(eventId),
      getConvex().query(api.events.getStats, { eventId: eventId as any }),
    ]);

    res.json({
      success: true,
      data: {
        ...realtimeStats,
        ...eventStats,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get statistics",
    });
  }
});

export default router;
