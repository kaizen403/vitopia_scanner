import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";

const router: Router = Router();

const AUTH_SECRET = process.env.AUTH_SECRET || "opus-fest-auth-secret-2026";
const AUTH_COOKIE_NAME = "opus-session";

const VALID_USERNAME = "sibi";
const VALID_PASSWORD = "sibi";

import { prisma as basePrisma } from "../db/prisma.js";
const prisma = basePrisma as any;

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: "Username and password are required" });
    return;
  }

  // Check Admin first
  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    const token = jwt.sign({ role: "admin", id: "admin" }, AUTH_SECRET, { expiresIn: "7d" });

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, role: "admin" });
    return;
  }

  // Check Scanners (Gates)
  try {
    const gate = await prisma.gate.findUnique({
      where: { gateId: username },
    });

    if (gate && gate.secret === password) {
      if (!gate.isActive) {
        res.status(403).json({ success: false, error: "This scanner account is inactive" });
        return;
      }

      const token = jwt.sign(
        { role: "scanner", id: gate.gateId, gender: gate.gender, name: gate.name },
        AUTH_SECRET,
        { expiresIn: "7d" }
      );

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, role: "scanner", gateId: gate.gateId });
      return;
    }
  } catch (err) {
    console.error("Login error:", err);
  }

  res.status(401).json({ success: false, error: "Invalid credentials" });
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
