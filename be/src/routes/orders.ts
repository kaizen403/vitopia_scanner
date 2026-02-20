import { Router, Request, Response } from "express";
import { generateQRCode } from "../utils/qr-code.js";
import * as ordersRepo from "../db/orders.js";

const router: Router = Router();

/**
 * GET /api/orders
 * List orders with filters
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, paymentStatus, eventId, mailed, page, limit } = req.query;
    
    const result = await ordersRepo.listOrders({
      search: search as string,
      paymentStatus: paymentStatus as string,
      eventId: eventId as string,
      mailed: mailed as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error listing orders:", error);
    res.status(500).json({ success: false, error: "Failed to list orders" });
  }
});


/**
 * POST /api/orders
 * Create a new order
 */
router.post("/", async (req: Request, res: Response) => {
  const { userId, eventId, quantity, registrationId, accessTokens } = req.body;

  if (!userId || !eventId || !quantity) {
    res.status(400).json({
      success: false,
      error: "Missing required fields: userId, eventId, quantity",
    });
    return;
  }

  try {
    const result = await ordersRepo.create({
      userId,
      eventId,
      quantity,
      registrationId,
      accessTokens,
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
    // Get order details first
    const order = await ordersRepo.getByOrderId(orderId);
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    // Mark as paid
    await ordersRepo.markAsPaid(orderId);

    const qrCode = generateQRCode({
      orderId: order.orderId,
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
    const order = await ordersRepo.getByOrderId(orderId);
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    // Generate QR code if paid
    let qrCode: string | null = null;
    if (order.paymentStatus === "paid") {
      qrCode = generateQRCode({
        orderId: order.orderId,
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
    const order = await ordersRepo.getByOrderId(orderId);
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


/**
 * PUT /api/orders/:orderId
 * Update an order
 */
router.put("/:orderId", async (req: Request, res: Response) => {
  try {
    const updated = await ordersRepo.updateOrder(req.params.orderId, req.body);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error updating order:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to update order" });
  }
});

/**
 * DELETE /api/orders/:orderId
 * Delete an order
 */
router.delete("/:orderId", async (req: Request, res: Response) => {
  try {
    await ordersRepo.deleteOrder(req.params.orderId);
    res.json({ success: true, message: "Order deleted" });
  } catch (error: any) {
    console.error("Error deleting order:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to delete order" });
  }
});
