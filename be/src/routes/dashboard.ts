import { Router, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getDashboardData } from "../db/dashboard.js";

const router: Router = Router();

const DASHBOARD_PIN = process.env.DASHBOARD_PIN || "260226";
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const rateLimitMap = new Map<string, { attempts: number; firstAttempt: number }>();
const activeTokens = new Set<string>();

function cleanupRateLimit(ip: string) {
  const entry = rateLimitMap.get(ip);
  if (entry && Date.now() - entry.firstAttempt > LOCKOUT_WINDOW_MS) {
    rateLimitMap.delete(ip);
  }
}

router.post("/auth", (req: Request, res: Response) => {
  const { pin } = req.body;
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  cleanupRateLimit(ip);

  const entry = rateLimitMap.get(ip);
  if (entry && entry.attempts >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - entry.firstAttempt;
    const retryAfter = Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 1000);
    res.status(429).json({
      success: false,
      error: "Too many attempts. Try again later.",
      retryAfter,
    });
    return;
  }

  if (!pin || typeof pin !== "string" || pin.length !== 6) {
    res.status(400).json({ success: false, error: "A 6-digit PIN is required" });
    return;
  }

  if (pin !== DASHBOARD_PIN) {
    const current = rateLimitMap.get(ip) || { attempts: 0, firstAttempt: Date.now() };
    current.attempts++;
    rateLimitMap.set(ip, current);

    const remaining = MAX_ATTEMPTS - current.attempts;
    res.status(401).json({
      success: false,
      error: "Incorrect PIN",
      attemptsRemaining: remaining,
    });
    return;
  }

  rateLimitMap.delete(ip);

  const token = crypto.randomUUID();
  activeTokens.add(token);
  setTimeout(() => activeTokens.delete(token), TOKEN_TTL_MS);

  res.json({ success: true, data: token });
});

const AUTH_SECRET = process.env.AUTH_SECRET || "opus-fest-auth-secret-2026";
const AUTH_COOKIE_NAME = "opus-session";

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function requireDashboardToken(req: Request, res: Response): boolean {
  const sessionCookie = parseCookie(req.headers.cookie, AUTH_COOKIE_NAME);
  if (sessionCookie) {
    try {
      jwt.verify(sessionCookie, AUTH_SECRET);
      return true;
    } catch {}
  }

  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (activeTokens.has(token)) return true;
  }

  res.status(401).json({ success: false, error: "Authorization required" });
  return false;
}

router.get("/data", async (req: Request, res: Response) => {
  if (!requireDashboardToken(req, res)) return;

  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ success: false, error: "Failed to load dashboard data" });
  }
});

export default router;
