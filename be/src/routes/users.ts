// @ts-nocheck
import { Router, Request, Response } from "express";
import { ConvexHttpClient } from "convex/browser";
import { loadConvexApi } from "../utils/convex-api.js";

const router: Router = Router();

// Lazy-load Convex client
let _convex: ConvexHttpClient | null = null;
const getConvex = () => {
  if (!_convex) {
    const url = process.env.CONVEX_URL;
    if (!url) throw new Error("CONVEX_URL environment variable is required");
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
};

// Helper to get Convex API
const getApi = async () => loadConvexApi();

/**
 * POST /api/users
 * Create or get user
 */
router.post("/", async (req: Request, res: Response) => {
  const { email, name, phone, college } = req.body;

  if (!email || !name) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: email, name",
    });
    return;
  }

  try {
    const convex = getConvex();
    const api = await getApi();
    const userId = await convex.mutation(api.users.createOrGet, {
      email,
      name,
      phone,
      college,
    });

    res.status(201).json({
      success: true,
      data: { userId },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
});

/**
 * GET /api/users/email/:email
 * Get user by email
 */
router.get("/email/:email", async (req: Request, res: Response) => {
  try {
    const convex = getConvex();
    const api = await getApi();
    const user = await convex.query(api.users.getByEmail, {
      email: req.params.email,
    });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const convex = getConvex();
    const api = await getApi();
    const user = await convex.query(api.users.getById, {
      userId: req.params.id,
    });
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user" });
  }
});

/**
 * GET /api/users/:id/orders
 * Get user's orders with QR codes
 */
router.get("/:id/orders", async (req: Request, res: Response) => {
  try {
    const convex = getConvex();
    const api = await getApi();
    const orders = await convex.query(api.users.getOrders, {
      userId: req.params.id,
    });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user orders" });
  }
});

export default router;
