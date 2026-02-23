import fs from "fs";
import path from "path";
import crypto from "crypto";

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
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "VITopia '26 <tickets@vitap.ac.in>";

import { generateQRCode } from "../src/utils/qr-code.js";
import { generateStyledQRImage } from "../src/utils/qr-image.js";
import { buildEmailHtml } from "../src/utils/mail.js";

async function run() {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const logoPath = path.join(path.resolve(process.cwd(), "src"), "assets/vitopia-small.png");
    let logoBuffer: Buffer | null = null;
    try { logoBuffer = fs.readFileSync(logoPath); } catch { }

    const testEmail = "suryathejadhommalapati@gmail.com";
    const testOrderId = "ORD-TEST-" + Date.now().toString().slice(-6);

    const formattedDate = new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const qrToken = generateQRCode({ orderId: testOrderId });
    const qrBuffer = await generateStyledQRImage(qrToken);

    const attachments: any[] = [
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

    const payload = {
        from: MAIL_FROM,
        to: [testEmail],
        subject: `Your VITopia '26 Ticket — Pro Show (Day 1)`,
        html: buildEmailHtml({
            name: "Surya Theja (Test)",
            orderId: testOrderId,
            eventName: "Pro Show (Day 1)",
            quantity: 1,
            date: formattedDate,
            venue: "VIT-AP Campus",
            email: testEmail,
        }),
        attachments,
    };

    console.log(`[send] Sending test email to ${testEmail}...`);
    const { data, error } = await resend.emails.send(payload);

    if (error) {
        console.error("[-] Failed:", error);
    } else {
        console.log("[+] Sent! Data:", data);
    }

    process.exit(0);
}

run().catch(console.error);
