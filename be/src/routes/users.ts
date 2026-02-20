import { Router, Request, Response } from "express";
import * as usersRepo from "../db/users.js";

const router: Router = Router();

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
    const userId = await usersRepo.createOrGet({
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
    const user = await usersRepo.getByEmail(req.params.email);
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
    const user = await usersRepo.getById(req.params.id);
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
    const orders = await usersRepo.getOrders(req.params.id);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user orders" });
  }
});

export default router;
