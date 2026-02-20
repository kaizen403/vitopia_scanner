import { Router, Request, Response } from "express";
import { getRedisLockManager } from "../utils/redis-lock.js";
import { verifyQRCode } from "../utils/qr-code.js";
import { gateAuthMiddleware, rateLimitMiddleware } from "../middleware/auth.js";
import {
  checkIn,
  validate,
  getStats as dbGetStats,
  logScan,
  getScanHistoryByOrderId,
} from "../db/scan.js";
import { getByOrderId } from "../db/orders.js";

const router: Router = Router();

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
      const qrResult = verifyQRCode(qrCode);
      if (!qrResult.valid || !qrResult.payload) {
        res.status(400).json({
          success: false,
          error: qrResult.error || "Invalid QR code",
          code: "INVALID_QR",
          responseTime: Date.now() - startTime,
        });
        return;
      }
      const { orderId } = qrResult.payload;

      // Step 2: Check Redis cache for fast rejection
      const cachedResult = await lockManager.getCachedScanResult(orderId, eventId);
      if (cachedResult.cached && cachedResult.result === "already_used") {
        // Fetch user/order data for rejected entry display
        let data: any = { orderId };
        try {
          const orderInfo = await getByOrderId(orderId);
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
        // Step 5: Perform check-in in Postgres
        const result = await checkIn({
          orderId,
          scannedBy: gate.id,
          gate: gate.id,
          expectedEventId: eventId,
        });

        // Step 6: Update cache and log
        if (result.success) {
          await lockManager.cacheScanResult(orderId, "already_used", Date.now(), eventId);
          if (result.eventId) {
            await lockManager.incrementScanCount(result.eventId);
          }

          await logScan({
            orderId,
            eventId: result.eventId,
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
            ...result.order,
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
              result.checkedInAt || Date.now(),
              eventId
            );
          }

          if (result.eventId) {
            await logScan({
              orderId,
              eventId: result.eventId,
              scanResult: result.reason as any,
              scannedBy: gate.id,
              gate: gate.id,
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"],
            });
          }

          const errorMessages: Record<string, string> = {
            already_used: "Already scanned",
            not_found: "Not found",
            not_paid: "Not paid",
            wrong_event: "Wrong event",
          };

          const statusCodes: Record<string, number> = {
            already_used: 409,
            not_found: 404,
            not_paid: 402,
            wrong_event: 400,
          };

          res.status(statusCodes[result.reason] || 400).json({
            success: false,
            error: errorMessages[result.reason] || "Invalid ticket",
            code: result.reason.toUpperCase(),
            checkedInAt: result.checkedInAt,
            checkedInBy: result.checkedInBy,
            data: {
              ...result.order,
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
    const { qrCode, eventId } = req.body;

    if (!qrCode) {
      res.status(400).json({
        success: false,
        error: "QR code is required",
        code: "MISSING_QR_CODE",
      });
      return;
    }

    try {
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

      const result = await validate(orderId, eventId);

      if (result.valid) {
        res.json({
          success: true,
          message: "Ticket is valid",
          code: "VALID",
          data: {
            ...result.order,
            user: result.user,
            event: result.event,
          },
        });
      } else {
        const statusCodes: Record<string, number> = {
          already_used: 409,
          not_found: 404,
          not_paid: 402,
          wrong_event: 400,
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

router.post(
  "/history",
  gateAuthMiddleware,
  rateLimitMiddleware(100),
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

      const history = await getScanHistoryByOrderId(orderId);
      if (!history) {
        res.status(404).json({
          success: false,
          error: "Ticket not found",
          code: "NOT_FOUND",
        });
        return;
      }

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error("History lookup error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch ticket history",
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
    const lockManager = getRedisLockManager();
    const [realtimeStats, eventStats] = await Promise.all([
      lockManager.getRealtimeStats(eventId),
      dbGetStats(eventId),
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
