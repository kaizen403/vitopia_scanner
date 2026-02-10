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
    expectedEventId: v.optional(v.id("events")),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (!order) {
      return { success: false, reason: "not_found", eventId: undefined };
    }

    const user = await ctx.db.get(order.userId);
    const event = await ctx.db.get(order.eventId);
    const orderData = {
      orderId: order.orderId,
      quantity: order.quantity,
    };
    const userData = user ? { name: user.name, email: user.email } : null;
    const eventData = event ? { name: event.name, venue: event.venue } : null;

    if (args.expectedEventId && order.eventId !== args.expectedEventId) {
      return { success: false, reason: "wrong_event", eventId: order.eventId, order: orderData, user: userData, event: eventData };
    }

    if (order.paymentStatus !== "paid") {
      return { success: false, reason: "not_paid", eventId: order.eventId, order: orderData, user: userData, event: eventData };
    }

    if (order.checkedIn) {
      return {
        success: false,
        reason: "already_used",
        checkedInAt: order.checkedInAt,
        checkedInBy: order.checkedInBy,
        eventId: order.eventId,
        order: orderData,
        user: userData,
        event: eventData,
      };
    }

    await ctx.db.patch(order._id, {
      checkedIn: true,
      checkedInAt: Date.now(),
      checkedInBy: args.scannedBy,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      reason: "success",
      eventId: order.eventId,
      order: orderData,
      user: userData,
      event: eventData,
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

// Dashboard: analytics + enriched scan logs in a single query
export const getDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();

    const eventAnalytics = await Promise.all(
      events.map(async (event) => {
        const orders = await ctx.db
          .query("orders")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .collect();
        const paid = orders.filter((o) => o.paymentStatus === "paid");
        const checkedIn = paid.filter((o) => o.checkedIn);
        return {
          eventId: event._id,
          eventName: event.name,
          sold: paid.reduce((s, o) => s + o.quantity, 0),
          checkedIn: checkedIn.reduce((s, o) => s + o.quantity, 0),
          remaining:
            event.capacity - paid.reduce((s, o) => s + o.quantity, 0),
          capacity: event.capacity,
        };
      })
    );

    const totalSold = eventAnalytics.reduce((s, e) => s + e.sold, 0);
    const totalChecked = eventAnalytics.reduce((s, e) => s + e.checkedIn, 0);

    const logs = await ctx.db
      .query("scanLogs")
      .order("desc")
      .take(500);

    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const event = await ctx.db.get(log.eventId);
        const order = await ctx.db
          .query("orders")
          .withIndex("by_orderId", (q) => q.eq("orderId", log.orderId))
          .first();
        let userName = "";
        let userEmail = "";
        if (order) {
          const user = await ctx.db.get(order.userId);
          userName = user?.name || "";
          userEmail = user?.email || "";
        }
        return {
          orderId: log.orderId,
          scanResult: log.scanResult,
          scannedBy: log.scannedBy,
          gate: log.gate,
          timestamp: log.timestamp,
          eventName: event?.name || "",
          userName,
          userEmail,
        };
      })
    );

    return {
      analytics: {
        totalTicketsSold: totalSold,
        totalCheckedIn: totalChecked,
        totalRemaining: totalSold - totalChecked,
        events: eventAnalytics,
      },
      scanLogs: enrichedLogs,
    };
  },
});

// Clear ALL orders, scanLogs, and users from DB (destructive - use for re-seeding)
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    for (const order of orders) {
      await ctx.db.delete(order._id);
    }

    const scanLogs = await ctx.db.query("scanLogs").collect();
    for (const log of scanLogs) {
      await ctx.db.delete(log._id);
    }

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    return {
      deletedOrders: orders.length,
      deletedScanLogs: scanLogs.length,
      deletedUsers: users.length,
    };
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
