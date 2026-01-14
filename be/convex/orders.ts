// @ts-nocheck
// NOTE: Type checking is disabled until `npx convex dev` is run to generate types
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate unique order ID
function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

// Create a new order
export const create = mutation({
  args: {
    userId: v.id("users"),
    eventId: v.id("events"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    if (!event.isActive) {
      throw new Error("Event is not active");
    }

    // Check capacity
    const existingOrders = await ctx.db
      .query("orders")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();

    const soldTickets = existingOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + o.quantity, 0);

    if (soldTickets + args.quantity > event.capacity) {
      throw new Error("Not enough tickets available");
    }

    const orderId = generateOrderId();
    const totalAmount = event.price * args.quantity;

    const id = await ctx.db.insert("orders", {
      orderId,
      userId: args.userId,
      eventId: args.eventId,
      quantity: args.quantity,
      totalAmount,
      paymentStatus: "pending",
      checkedIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id, orderId, totalAmount };
  },
});

// Mark order as paid (simulated payment)
export const markAsPaid = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(order._id, {
      paymentStatus: "paid",
      updatedAt: Date.now(),
    });

    return order._id;
  },
});

// Get order by orderId
export const getByOrderId = query({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) return null;

    const event = await ctx.db.get(order.eventId);
    const user = await ctx.db.get(order.userId);

    return { ...order, event, user };
  },
});

// Get order by ID
export const getById = query({
  args: { id: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) return null;

    const event = await ctx.db.get(order.eventId);
    const user = await ctx.db.get(order.userId);

    return { ...order, event, user };
  },
});

// Check-in order (called after Redis lock acquired)
export const checkIn = mutation({
  args: {
    orderId: v.string(),
    scannedBy: v.string(),
    gate: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) {
      return { success: false, reason: "not_found" };
    }

    if (order.paymentStatus !== "paid") {
      return { success: false, reason: "not_paid" };
    }

    if (order.checkedIn) {
      return {
        success: false,
        reason: "already_used",
        checkedInAt: order.checkedInAt,
        checkedInBy: order.checkedInBy,
      };
    }

    // Perform check-in
    await ctx.db.patch(order._id, {
      checkedIn: true,
      checkedInAt: Date.now(),
      checkedInBy: args.scannedBy,
      updatedAt: Date.now(),
    });

    // Get user and event for response
    const user = await ctx.db.get(order.userId);
    const event = await ctx.db.get(order.eventId);

    return {
      success: true,
      reason: "success",
      order: {
        orderId: order.orderId,
        quantity: order.quantity,
      },
      user: user ? { name: user.name, email: user.email } : null,
      event: event ? { name: event.name, venue: event.venue } : null,
    };
  },
});

// Validate order without checking in
export const validate = query({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) {
      return { valid: false, reason: "not_found" };
    }

    if (order.paymentStatus !== "paid") {
      return { valid: false, reason: "not_paid" };
    }

    if (order.checkedIn) {
      return {
        valid: false,
        reason: "already_used",
        checkedInAt: order.checkedInAt,
      };
    }

    const event = await ctx.db.get(order.eventId);
    const user = await ctx.db.get(order.userId);

    return {
      valid: true,
      reason: "valid",
      order: {
        orderId: order.orderId,
        quantity: order.quantity,
        eventId: order.eventId,
      },
      user: user ? { name: user.name } : null,
      event: event ? { name: event.name } : null,
    };
  },
});

// Log a scan attempt
export const logScan = mutation({
  args: {
    orderId: v.string(),
    eventId: v.id("events"),
    scanResult: v.union(
      v.literal("success"),
      v.literal("already_used"),
      v.literal("invalid"),
      v.literal("not_found"),
      v.literal("wrong_event"),
      v.literal("not_paid")
    ),
    scannedBy: v.string(),
    gate: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("scanLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Get recent scan logs for an event
export const getScanLogs = query({
  args: {
    eventId: v.id("events"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("scanLogs")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .take(args.limit ?? 100);

    return logs;
  },
});

// List Day1 orders with check-in status
export const listDay1Orders = query({
  args: {},
  handler: async (ctx) => {
    const day1Event = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("name"), "Vitopia2026-Day1"))
      .first();

    if (!day1Event) {
      throw new Error("Vitopia Day 1 event not found");
    }

    const day1Orders = await ctx.db
      .query("orders")
      .withIndex("by_eventId", (q) => q.eq("eventId", day1Event._id))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      day1Orders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        return {
          orderId: order.orderId,
          eventId: order.eventId,
          userId: order.userId,
          quantity: order.quantity,
          checkedIn: order.checkedIn,
          checkedInAt: order.checkedInAt,
          name: user?.name || "",
          email: user?.email || "",
        };
      })
    );

    return { day1EventId: day1Event._id, day1Orders: enriched };
  },
});

// Reset Day1 check-in status (make all unscanned)
export const resetDay1Checkins = mutation({
  args: {},
  handler: async (ctx) => {
    const day1Event = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("name"), "Vitopia2026-Day1"))
      .first();

    if (!day1Event) {
      throw new Error("Vitopia Day 1 event not found");
    }

    const day1Orders = await ctx.db
      .query("orders")
      .withIndex("by_eventId", (q) => q.eq("eventId", day1Event._id))
      .collect();

    for (const order of day1Orders) {
      await ctx.db.patch(order._id, {
        checkedIn: false,
        checkedInAt: undefined,
        checkedInBy: undefined,
        updatedAt: Date.now(),
      });
    }

    return { resetCount: day1Orders.length };
  },
});

// Adjust Vitopia seed data and return Day1 orders
export const adjustVitopiaSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const day1Name = "Vitopia2026-Day1";
    const day2Name = "Vitopia2026-Day2";

    const day1Event = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("name"), day1Name))
      .first();
    const day2Event = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("name"), day2Name))
      .first();

    if (!day1Event || !day2Event) {
      throw new Error("Vitopia events not found");
    }

    // Update event prices
    await ctx.db.patch(day1Event._id, { price: 700 });
    await ctx.db.patch(day2Event._id, { price: 700 });

    const updateOrdersForEvent = async (eventId, shouldCheckIn) => {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect();

      for (const order of orders) {
        const patch = {
          totalAmount: 700,
          paymentStatus: "paid",
          updatedAt: Date.now(),
        };

        if (shouldCheckIn) {
          patch.checkedIn = true;
          patch.checkedInAt = Date.now();
          patch.checkedInBy = "seed";
        }

        const { _id, _creationTime, checkedInGate, ...rest } = order;
        await ctx.db.replace(_id, {
          ...rest,
          ...patch,
        });
      }
    };

    await updateOrdersForEvent(day1Event._id, true);
    await updateOrdersForEvent(day2Event._id, false);

    // Remove college field for all VIT-AP seeded users
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.email.endsWith("@vitapstudent.ac.in")) {
        const { _id, _creationTime, college, phone, ...rest } = user;
        await ctx.db.replace(_id, rest);
      }
    }

    // Return first 50 day1 orders with user info
    const day1Orders = await ctx.db
      .query("orders")
      .withIndex("by_eventId", (q) => q.eq("eventId", day1Event._id))
      .order("desc")
      .take(50);

    const enriched = await Promise.all(
      day1Orders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        return {
          orderId: order.orderId,
          eventId: order.eventId,
          userId: order.userId,
          quantity: order.quantity,
          name: user?.name || "",
          email: user?.email || "",
        };
      })
    );

    return {
      day1EventId: day1Event._id,
      day2EventId: day2Event._id,
      day1Orders: enriched,
    };
  },
});
