/**
 * add-day1-orders.mjs
 *
 * Reads emails from order.txt, creates users, and registers them for Pro Show Day 1.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// ── 1. Bootstrap .env ─────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
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
}

// ── 2. Lazy-load compiled backend modules ─────────────────────────────────────
const distRoot = path.resolve(__dirname, "../dist/src");
const { prisma } = await import(path.join(distRoot, "db/prisma.js"));
import crypto from "crypto";

function generateOrderId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD-${timestamp}-${random}`.toUpperCase();
}

function generateQrToken(orderId) {
    const secret = process.env.JWT_SECRET || "Salt123";
    return crypto.createHmac("sha256", secret).update(orderId).digest("hex").toUpperCase().substring(0, 16);
}

const randomPhone = () => {
    const prefixes = ["98", "97", "96", "95", "94", "93", "91", "90", "89", "88", "87", "86", "85", "84", "83", "82", "81", "80", "79", "78", "77", "76", "75", "74", "73", "72", "71", "70"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const rest = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
    return `${prefix}${rest}`;
};

async function run() {
    const fileText = fs.readFileSync(path.resolve(__dirname, "../../order.txt"), "utf-8");
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+.[a-zA-Z0-9._-]+)/gi;
    const emailsNum = fileText.match(emailRegex) || [];
    const emails = Array.from(new Set(emailsNum.map(m => m.toLowerCase())));

    console.log(`[+] Found ${emails.length} unique emails`);

    // Find Day 1 Event
    const day1Event = await prisma.event.findFirst({
        where: {
            OR: [
                { name: "Vitopia2026-Day1" },
                { accessToken: "DAY_1" }
            ],
            isActive: true
        }
    });

    if (!day1Event) {
        console.error("[-] ERROR: Could not find active Day 1 Event.");
        process.exit(1);
    }

    console.log(`[+] Using Event: ${day1Event.name} (${day1Event.id})`);

    let added = 0;
    let skipped = 0;
    let dberror = 0;

    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];

        try {
            // Create or find user
            let user = await prisma.user.findFirst({ where: { email } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        name: email, // use email as name, like UI does
                        phone: randomPhone(),
                        college: "VIT-AP University",
                        createdAt: BigInt(Date.now())
                    }
                });
            }

            // Check if user already has an order for this event
            const existingOrder = await prisma.order.findFirst({
                where: { userId: user.id, eventId: day1Event.id }
            });

            if (existingOrder) {
                skipped++;
                console.log(`[~] Skipped ${email} - Already has an order (${existingOrder.orderId})`);
                continue;
            }

            const orderId = generateOrderId();
            const qrToken = generateQrToken(orderId);

            await prisma.order.create({
                data: {
                    orderId,
                    qrToken,
                    userId: user.id,
                    eventId: day1Event.id,
                    quantity: 1,
                    totalAmount: day1Event.price || 0,
                    paymentStatus: "paid", // Set directly to paid!
                    checkedIn: false,
                    mailed: false,
                    productMeta: "Day 1 Ticket via Script",
                    createdAt: BigInt(Date.now()),
                    updatedAt: BigInt(Date.now())
                }
            });

            console.log(`[✓] Created order for ${email}`);
            added++;
        } catch (e: any) {
            console.error(`[x] Error for ${email}:`, e.message);
            dberror++;
        }
    }

    console.log(`\n=== DONE ===`);
    console.log(`Added  : ${added}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors : ${dberror}`);
    process.exit(0);
}

run().catch(console.error);
