import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router: Router = Router();

const AUTH_SECRET = process.env.AUTH_SECRET || "opus-fest-auth-secret-2026";
const AUTH_COOKIE_NAME = "opus-session";

const VALID_USERNAME = "admin";
const VALID_PASSWORD = "SIBI123";

router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: "Username and password are required" });
    return;
  }

  if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ role: "admin" }, AUTH_SECRET, { expiresIn: "7d" });

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.json({ success: true });
});

export default router;
