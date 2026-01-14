import { Router, Request, Response } from "express";
import { ConvexHttpClient } from "convex/browser";
import { generateQRCode } from "../utils/qr-code.js";
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
 * POST /api/orders
 * Create a new order
 */
router.post("/", async (req: Request, res: Response) => {
  const { userId, eventId, quantity } = req.body;

  if (!userId || !eventId || !quantity) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: userId, eventId, quantity",
    });
    return;
  }

  try {
    const convex = getConvex();
    const api = await getApi();
    const result = await convex.mutation(api.orders.create, {
      userId: userId as any,
      eventId: eventId as any,
      quantity,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to create order",
    });
  }
});

/**
 * POST /api/orders/:orderId/pay
 * Simulate payment for an order
 */
router.post("/:orderId/pay", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  try {
    const convex = getConvex();
    const api = await getApi();
    
    // Get order details first
    const order = await convex.query(api.orders.getByOrderId, { orderId });
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    // Mark as paid
    await convex.mutation(api.orders.markAsPaid, { orderId });

    // Generate QR code
    const qrCode = generateQRCode({
      orderId: order.orderId,
      eventId: order.eventId,
      userId: order.userId,
      quantity: order.quantity,
    });

    res.json({
      success: true,
      message: "Payment successful",
      data: {
        orderId: order.orderId,
        qrCode,
      },
    });
  } catch (error: any) {
    console.error("Error processing payment:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Payment failed",
    });
  }
});

/**
 * GET /api/orders/:orderId
 * Get order by orderId
 */
router.get("/:orderId", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  try {
    const convex = getConvex();
    const api = await getApi();
    const order = await convex.query(api.orders.getByOrderId, { orderId });
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    // Generate QR code if paid
    let qrCode: string | null = null;
    if (order.paymentStatus === "paid") {
      qrCode = generateQRCode({
        orderId: order.orderId,
        eventId: order.eventId,
        userId: order.userId,
        quantity: order.quantity,
      });
    }

    res.json({
      success: true,
      data: {
        ...order,
        qrCode,
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ success: false, error: "Failed to fetch order" });
  }
});

/**
 * GET /api/orders/:orderId/qr
 * Get QR code for an order
 */
router.get("/:orderId/qr", async (req: Request, res: Response) => {
  const { orderId } = req.params;

  try {
    const convex = getConvex();
    const api = await getApi();
    const order = await convex.query(api.orders.getByOrderId, { orderId });
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    if (order.paymentStatus !== "paid") {
      res.status(400).json({
        success: false,
        error: "Order is not paid. QR code not available.",
      });
      return;
    }

    const qrCode = generateQRCode({
      orderId: order.orderId,
      eventId: order.eventId,
      userId: order.userId,
      quantity: order.quantity,
    });

    res.json({
      success: true,
      data: { qrCode },
    });
  } catch (error) {
    console.error("Error generating QR:", error);
    res.status(500).json({ success: false, error: "Failed to generate QR code" });
  }
});

export default router;
