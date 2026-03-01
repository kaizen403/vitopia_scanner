import { Router, Request, Response } from "express";
import { sendTicketEmail } from "../utils/mail.js";
import { apiKeyAuthMiddleware } from "../middleware/auth.js";

const router: Router = Router();
router.use(apiKeyAuthMiddleware);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendEmailsForOrderIds(
  orderIds: string[]
): Promise<{ sent: number; failed: number; results: { orderId: string; status: "sent" | "failed"; error?: string }[] }> {
  // Resend rate limit: ~2-10 emails/sec depending on plan.
  // Send 2 concurrently with 1s gap between chunks to stay safe.
  const CHUNK_SIZE = 2;
  const CHUNK_DELAY_MS = 1000;
  const results: { orderId: string; status: "sent" | "failed"; error?: string }[] = [];

  for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
    const chunk = orderIds.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async (orderId) => {
        try {
          await sendTicketEmail(orderId);
          return { orderId, status: "sent" as const };
        } catch (err: any) {
          return { orderId, status: "failed" as const, error: err.message || "Unknown error" };
        }
      })
    );
    results.push(...chunkResults);

    if (i + CHUNK_SIZE < orderIds.length) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  // Retry failed ones once
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0 && failed.length < orderIds.length) {
    console.log(`[Mail] Retrying ${failed.length} failed emails...`);
    await sleep(3000);

    for (const entry of failed) {
      try {
        await sendTicketEmail(entry.orderId);
        entry.status = "sent";
        delete entry.error;
      } catch (err: any) {
        entry.error = err.message || "Retry failed";
      }
      await sleep(CHUNK_DELAY_MS);
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  return { sent, failed: failedCount, results };
}

/**
 * POST /api/mail/send
 * Send ticket emails for an explicit list of order IDs.
 */
router.post("/send", async (req: Request, res: Response) => {
  const { orderIds } = req.body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    res.status(400).json({ success: false, error: "orderIds array is required" });
    return;
  }

  const result = await sendEmailsForOrderIds(orderIds);
  res.json({ success: true, data: result });
});

/**
 * POST /api/mail/send-filtered
 * Accepts filter params (eventId, mailed, etc.), resolves matching order IDs
 * server-side, then sends ticket emails — the filter is always enforced here.
 */
router.post("/send-filtered", async (req: Request, res: Response) => {
  const { search, paymentStatus, eventId, mailed, checkedIn, dateFrom, dateTo } = req.body;

  const { listOrderIds } = await import("../db/orders.js");

  const orderIds = await listOrderIds({
    search,
    paymentStatus,
    eventId,
    mailed,
    checkedIn,
    dateFrom,
    dateTo,
  });

  if (orderIds.length === 0) {
    res.json({ success: true, data: { sent: 0, failed: 0, results: [] } });
    return;
  }

  console.log(
    `[Mail] send-filtered: ${orderIds.length} orders match filter (eventId=${eventId ?? "all"})`
  );

  const result = await sendEmailsForOrderIds(orderIds);
  res.json({ success: true, data: result });
});

/**
 * POST /api/mail/send-by-emails
 * Accepts a list of emails and an eventId, resolves matching order IDs
 * and sends emails to them.
 */
router.post("/send-by-emails", async (req: Request, res: Response) => {
  const { emails, eventId } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    res.status(400).json({ success: false, error: "emails array is required" });
    return;
  }
  if (!eventId) {
    res.status(400).json({ success: false, error: "eventId is required" });
    return;
  }

  const { prisma } = await import("../db/prisma.js");

  const orders = await (prisma as any).order.findMany({
    where: {
      eventId,
      user: {
        email: { in: emails },
      },
    },
    select: { orderId: true },
  });

  const orderIds = orders.map((o) => o.orderId);

  if (orderIds.length === 0) {
    res.json({ success: true, data: { sent: 0, failed: 0, results: [] } });
    return;
  }

  console.log(
    `[Mail] send-by-emails: ${orderIds.length} orders match ${emails.length} emails for eventId: ${eventId}`
  );

  const result = await sendEmailsForOrderIds(orderIds);
  res.json({ success: true, data: result });
});

export default router;
