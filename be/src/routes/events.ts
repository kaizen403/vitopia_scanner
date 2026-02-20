import { Router, Request, Response } from "express";
import * as eventsRepo from "../db/events.js";

const router: Router = Router();

/**
 * GET /api/events
 * List all active events
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const events = await eventsRepo.listActive();
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
 * Create a new event (admin only)
 */
router.post("/", async (req: Request, res: Response) => {
  const { name, description, date, venue, capacity, price, accessToken, category, scanOrder } = req.body;

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
