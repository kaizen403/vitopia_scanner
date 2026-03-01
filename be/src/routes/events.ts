import { Router, Request, Response } from "express";
import * as eventsRepo from "../db/events.js";
import { apiKeyAuthMiddleware } from "../middleware/auth.js";

const router: Router = Router();

/**
 * GET /api/events
 * List all active items (Events or Workshops)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const type = req.query.type as any;
    const events = await eventsRepo.listActive(type);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

/**
 * GET /api/events/workshops
 * Explicitly list workshops
 */
router.get("/workshops", async (req: Request, res: Response) => {
  try {
    const workshops = await eventsRepo.listActive("WORKSHOP");
    res.json({ success: true, data: workshops });
  } catch (error) {
    console.error("Error fetching workshops:", error);
    res.status(500).json({ success: false, error: "Failed to fetch workshops" });
  }
});

/**
 * GET /api/events/:id
 * Get event by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const event = await eventsRepo.getById(req.params.id);
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
 * Create a new event or workshop
 * For workshops, include 'slots' in the body.
 */
router.post("/", apiKeyAuthMiddleware, async (req: Request, res: Response) => {
  const { name, description, date, venue, capacity, price, accessToken, category, scanOrder, type, slots } = req.body;

  if (!name || !description || !date || !venue || !capacity || price === undefined) {
    res.status(400).json({
      success: false,
      error: "Missing required fields",
    });
    return;
  }

  try {
    const eventId = await eventsRepo.create({
      name,
      description,
      date,
      venue,
      capacity,
      price,
      accessToken,
      category,
      scanOrder,
      type: type || "EVENT",
      slots
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
 * Get detailed stats including slots
 */
router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const stats = await eventsRepo.getStats(req.params.id);
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
