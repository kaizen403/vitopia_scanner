import { Request, Response, NextFunction } from "express";
import { getRedisLockManager } from "../utils/redis-lock.js";

/**
 * Rate limiting middleware for scan endpoints
 */
export function rateLimitMiddleware(maxPerMinute: number = 100) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const gateId = req.headers["x-gate-id"] as string || "default";
    const lockManager = getRedisLockManager();

    const isLimited = await lockManager.isRateLimited(gateId, maxPerMinute);

    if (isLimited) {
      res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down.",
        code: "RATE_LIMITED",
      });
      return;
    }

    await lockManager.recordScanAttempt(gateId);
    next();
  };
}

import { prisma as basePrisma } from "../db/prisma.js";
const prisma = basePrisma as any;

/**
 * Gate authentication middleware
 */
export async function gateAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const gateId = req.headers["x-gate-id"] as string;
  const gateSecret = req.headers["x-gate-secret"] as string;

  if (!gateId || !gateSecret) {
    res.status(401).json({
      success: false,
      error: "Gate ID and Secret are required",
      code: "MISSING_GATE_CREDENTIALS",
    });
    return;
  }

  try {
    const gate = await prisma.gate.findUnique({
      where: { gateId },
    });

    if (!gate || gate.secret !== gateSecret) {
      res.status(401).json({
        success: false,
        error: "Invalid gate credentials",
        code: "INVALID_GATE_CREDENTIALS",
      });
      return;
    }

    if (!gate.isActive) {
      res.status(403).json({
        success: false,
        error: "Gate is inactive",
        code: "GATE_INACTIVE",
      });
      return;
    }

    // Attach gate info to request
    (req as any).gate = { id: gate.gateId, name: gate.name, gender: gate.gender };
    next();
  } catch (err) {
    console.error("Gate auth error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

/**
 * Error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Error:", error);

  res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}
