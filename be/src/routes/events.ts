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
 * GET /api/events
 * List all active events
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const convex = getConvex();
    const api = await getApi();
    const events = await convex.query(api.events.listActive, {});
    res.json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

/**
 * GET /api/events/:id
 * Get event by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const convex = getConvex();
    const api = await getApi();
    const event = await convex.query(api.events.getById, {
      eventId: req.params.id as any,
    });
    if (!event) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }
    res.json({ success: true, data: event });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event" });
  }
});

/**
 * POST /api/events
 * Create a new event (admin only)
 */
router.post("/", async (req: Request, res: Response) => {
  const { name, description, date, venue, capacity, price } = req.body;

  if (!name || !description || !date || !venue || !capacity || price === undefined) {
    res.status(400).json({
      success: false,
      error: "Missing required fields",
    });
    return;
  }

  try {
    const convex = getConvex();
    const api = await getApi();
    const eventId = await convex.mutation(api.events.create, {
      name,
      description,
      date,
      venue,
      capacity,
      price,
    });

    res.status(201).json({
      success: true,
      data: { eventId },
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, error: "Failed to create event" });
  }
});

/**
 * GET /api/events/:id/stats
 * Get event statistics
 */
router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const convex = getConvex();
    const api = await getApi();
    const stats = await convex.query(api.events.getStats, {
      eventId: req.params.id as any,
    });
    if (!stats) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

export default router;
