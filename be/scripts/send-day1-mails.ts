/**
 * send-day1-mails.mjs
 *
 * Sends QR ticket emails for all Day 1 (Pro Show) orders that have NOT been
 * mailed yet. Processes in batches of 30, logs every send to the console.
 *
 * Usage:
 *   node be/scripts/send-day1-mails.mjs [--dry-run] [--batch-size=N]
 *
 * Flags:
 *   --dry-run        List matched orders, but do NOT actually send any email.
 *   --batch-size=N   Override batch size (default: 30).
 *   --include-mailed Also include already-mailed orders (re-send).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ── 1. Bootstrap .env ─────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), "../.env");
if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
    console.log(`[env] Loaded variables from ${envPath}`);
} else {
    console.warn(`[env] No .env found at ${envPath} — relying on existing env`);
}

// ── 2. Validate env ───────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "Salt123";
const MAIL_FROM = process.env.MAIL_FROM || "VITopia '26 <tickets@vitap.ac.in>";

if (!RESEND_API_KEY) {
    console.error("[fatal] RESEND_API_KEY is not set. Aborting.");
    process.exit(1);
}
if (!DATABASE_URL) {
    console.error("[fatal] DATABASE_URL is not set. Aborting.");
    process.exit(1);
}

// ── 3. Parse CLI flags ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const INCLUDE_MAILED = args.includes("--include-mailed");
const batchArg = args.find((a) => a.startsWith("--batch-size="));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split("=")[1], 10) : 30;

console.log(`[config] dry-run=${DRY_RUN}  batch-size=${BATCH_SIZE}  include-mailed=${INCLUDE_MAILED}`);

// ── 4. Load TS backend modules ─────────────────────────────────────
import { prisma } from "../src/db/prisma.js";
import { generateQRCode } from "../src/utils/qr-code.js";
import { generateStyledQRImage } from "../src/utils/qr-image.js";
import { buildEmailHtml } from "../src/utils/mail.js";

// ── 5. Bootstrap Resend ───────────────────────────────────────────────────────
const { Resend } = await import("resend");
const resend = new Resend(RESEND_API_KEY);

// Logo (optional – same path the mail util uses)
const logoPath = path.join(path.resolve(process.cwd(), "src"), "assets/vitopia-small.png");
let logoBuffer: Buffer | null = null;
try { logoBuffer = fs.readFileSync(logoPath); } catch { }

// ── 6. Fetch Day-1 orders from DB ─────────────────────────────────────────────
console.log("\n[db] Querying Day 1 (Pro Show) orders…");

const where: any = {
    productMeta: { contains: "Day 1" },
    paymentStatus: "paid",
};
if (!INCLUDE_MAILED) {
    where.mailed = false;
}

const orders = await (prisma as any).order.findMany({
    where,
    include: { user: true, event: true },
    orderBy: { createdAt: "asc" },
});

console.log(`[db] Found ${orders.length} order(s) matching filter (mailed=${INCLUDE_MAILED ? "any" : "false"}, paymentStatus=paid, productMeta~Day 1)`);

if (orders.length === 0) {
    console.log("[done] Nothing to send. Exiting.");
    await prisma.$disconnect();
    process.exit(0);
}

if (DRY_RUN) {
    console.log("\n[dry-run] Orders that WOULD be mailed:");
    for (const o of orders) {
        console.log(`  • ${o.orderId}  →  ${o.user?.email ?? "(no email)"}  [${o.user?.name ?? "?"}]`);
    }
    console.log("\n[dry-run] No emails sent.");
    await prisma.$disconnect();
    process.exit(0);
}

// ── 7. Send in batches ────────────────────────────────────────────────────────
const CHUNK_DELAY_MS = 1100; // stay under Resend's rate limit
let totalSent = 0;
let totalFailed = 0;
const failures: any[] = [];

const totalBatches = Math.ceil(orders.length / BATCH_SIZE);
console.log(`\n[send] Sending ${orders.length} emails in ${totalBatches} batch(es) of ≤${BATCH_SIZE}…\n`);

for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batch = orders.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    const batchLabel = `Batch ${batchIdx + 1}/${totalBatches}`;

    console.log(`[${batchLabel}] Preparing ${batch.length} email(s)…`);

    // Build payloads
    const payloads: any[] = [];
    const validOrders: any[] = [];

    await Promise.all(
        batch.map(async (order: any) => {
            const email = order.user?.email;
            if (!email) {
                console.warn(`  [skip] ${order.orderId} — no email address`);
                totalFailed++;
                failures.push({ orderId: order.orderId, error: "No email address" });
                return;
            }

            try {
                const eventDate = order.event?.date
                    ? new Date(Number(order.event.date))
                    : new Date();
                const formattedDate = eventDate.toLocaleDateString("en-IN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                });

                const qrToken = generateQRCode({ orderId: order.orderId });
                const qrBuffer = await generateStyledQRImage(qrToken);

                const attachments = [
                    {
                        filename: "ticket.png",
                        content: qrBuffer,
                        contentType: "image/png",
                        contentId: "qrcode",
                        contentDisposition: "inline",
                    },
                ];
                if (logoBuffer) {
                    attachments.push({
                        filename: "logo.png",
                        content: logoBuffer,
                        contentType: "image/png",
                        contentId: "logo",
                        contentDisposition: "inline",
                    });
                }

                payloads.push({
                    from: MAIL_FROM,
                    to: [email],
                    subject: `Your VITopia '26 Ticket — ${order.event?.name ?? "Pro Show"}`,
                    html: buildEmailHtml({
                        name: order.user?.name ?? "Attendee",
                        orderId: order.orderId,
                        eventName: order.event?.name ?? "Pro Show (Day 1)",
                        quantity: order.quantity,
                        date: formattedDate,
                        venue: order.event?.venue ?? "VIT-AP Campus",
                        email,
                    }),
                    attachments,
                });
                validOrders.push(order);
            } catch (err) {
                console.error(`  [error] ${order.orderId} payload build failed: ${err.message}`);
                totalFailed++;
                failures.push({ orderId: order.orderId, error: `Payload: ${err.message}` });
            }
        })
    );

    if (payloads.length === 0) {
        console.log(`  [${batchLabel}] No valid payloads. Skipping.\n`);
        continue;
    }

    // Send the batch via Resend batch API
    console.log(`  [${batchLabel}] Sending ${payloads.length} email(s) via Resend…`);
    const { data, error } = await resend.batch.send(payloads);

    if (error) {
        console.error(`  [${batchLabel}] Resend batch error: ${error.message}`);
        for (const o of validOrders) {
            totalFailed++;
            failures.push({ orderId: o.orderId, error: error.message });
            console.log(`    ✗  ${o.orderId}  →  ${o.user?.email}`);
        }
    } else {
        // Mark all as mailed
        const sentIds = validOrders.map((o) => o.orderId);
        await (prisma as any).order.updateMany({
            where: { orderId: { in: sentIds } },
            data: { mailed: true, updatedAt: BigInt(Date.now()) },
        });
        totalSent += validOrders.length;
        for (const o of validOrders) {
            console.log(`    ✓  ${o.orderId}  →  ${o.user?.email}  [${o.user?.name}]`);
        }
    }

    // Rate-limit gap between batches
    if (batchIdx < totalBatches - 1) {
        console.log(`  [${batchLabel}] Waiting ${CHUNK_DELAY_MS}ms before next batch…\n`);
        await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
}

// ── 8. Summary ────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log(`  ✅  Sent    : ${totalSent}`);
console.log(`  ❌  Failed  : ${totalFailed}`);
console.log(`  📦  Total   : ${orders.length}`);
console.log("══════════════════════════════════════════");

if (failures.length > 0) {
    console.log("\n[failures]");
    for (const f of failures) {
        console.log(`  • ${f.orderId}: ${f.error}`);
    }
}

await prisma.$disconnect();
console.log("\n[done] Script complete.");
