import { Resend } from "resend";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import * as ordersRepo from "../db/orders.js";
import { generateQRCode } from "./qr-code.js";
import { generateStyledQRImage } from "./qr-image.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  }
  return _resend;
}

const FROM_EMAIL = process.env.MAIL_FROM || "VITopia '26 <tickets@vitap.ac.in>";

export interface TicketEmailData {
  name: string;
  orderId: string;
  eventName: string;
  quantity: number;
  date: string;
  venue: string;
  email: string;
}

export function buildEmailHtml(data: TicketEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:'Inter',sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#050505;padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111111;border:1px solid #222222;border-radius:28px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,0.8);">
          
          <!-- Branding Header -->
          <tr>
            <td style="padding:48px 40px 32px;text-align:center;background:linear-gradient(180deg, #181818 0%, #111111 100%);">
              <div style="font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#9AE600;margin-bottom:20px;opacity:0.9;">VIT-AP University Presents</div>
              <img src="cid:logo" alt="VITopia '26" style="width:170px;height:auto;display:block;margin:0 auto;" />
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="padding:0 40px 40px;">
              <div style="text-align:center;padding:32px;background:rgba(154,230,0,0.03);border:1px dashed rgba(154,230,0,0.2);border-radius:24px;">
                <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Registration Confirmed</h2>
                <p style="margin:0;font-size:15px;color:#a0a0a0;line-height:1.5;">Hi ${data.name}, you're all set! Below is your official pass to the event. Please present this at the entry gate.</p>
              </div>
            </td>
          </tr>

          <!-- Ticket Information -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;border:1px solid #222222;border-radius:20px;overflow:hidden;">
                <!-- Event Details Header -->
                <tr>
                  <td style="padding:28px 28px 20px;border-bottom:1px solid #1a1a1a;">
                    <span style="display:block;color:#666666;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Accessing Event</span>
                    <h3 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${data.eventName}</h3>
                  </td>
                </tr>
                
                <!-- Meta Grid -->
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="55%" style="padding-bottom:24px;">
                          <span style="display:block;color:#666666;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Date & Time</span>
                          <span style="display:block;color:#ffffff;font-size:14px;font-weight:500;">${data.date}</span>
                        </td>
                        <td width="45%" style="padding-bottom:24px;">
                          <span style="display:block;color:#666666;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Venue</span>
                          <span style="display:block;color:#ffffff;font-size:14px;font-weight:500;">${data.venue}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:8px;">
                          <span style="display:block;color:#666666;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Attendee</span>
                          <span style="display:block;color:#ffffff;font-size:14px;font-weight:500;">${data.name}</span>
                          <span style="display:block;color:#666666;font-size:12px;">${data.email}</span>
                        </td>
                        <td style="padding-bottom:8px;">
                          <span style="display:block;color:#666666;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Tickets</span>
                          <span style="display:block;color:#ffffff;font-size:15px;font-weight:600;">${data.quantity} Entry Pass${data.quantity > 1 ? 'es' : ''}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- QR Section -->
                <tr>
                  <td style="padding:32px;background-color:#ffffff;text-align:center;">
                    <img src="cid:qrcode" alt="QR Code" style="width:220px;height:220px;display:block;margin:0 auto;" />
                    <div style="margin-top:20px;padding-top:20px;border-top:1px solid #f0f0f0;">
                      <span style="display:block;color:#999999;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Order Reference</span>
                      <span style="display:block;color:#000000;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;">${data.orderId.toUpperCase()}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security & Rules -->
          <tr>
            <td style="padding:0 40px 48px;">
              <h4 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#9AE600;text-transform:uppercase;letter-spacing:1px;">Security & Guidelines</h4>
              <table width="100%" cellpadding="0" cellspacing="0" style="color:#888888;font-size:13px;line-height:1.6;">
                <tr>
                  <td style="padding-bottom:12px;vertical-align:top;width:20px;color:#ff4444;">•</td>
                  <td style="padding-bottom:12px;"><strong style="color:#ff4444;">DO NOT SHARE:</strong> Strictly do not share this QR code. If found duplicated, both the original and shared holder will be denied entry.</td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;vertical-align:top;width:20px;">•</td>
                  <td style="padding-bottom:12px;"><strong>Valid ID Required:</strong> University ID or Govt ID is mandatory at entry along with this ticket.</td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;vertical-align:top;width:20px;">•</td>
                  <td style="padding-bottom:12px;"><strong>Strict Access:</strong> One pass per entry. Management reserves the right to frisk attendees for security.</td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;vertical-align:top;width:20px;">•</td>
                  <td style="padding-bottom:12px;"><strong>No Re-entry:</strong> Once you exit the venue perimeter, re-entry is not permitted.</td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;vertical-align:top;width:20px;">•</td>
                  <td style="padding-bottom:12px;"><strong>Prohibited items:</strong> Alcohol, tobacco, illegal substances, dangerous objects, or external food/drinks.</td>
                </tr>
                <tr>
                  <td style="vertical-align:top;width:20px;">•</td>
                  <td><strong>Arrival:</strong> Please arrive at least 30 minutes before the event starts to avoid the rush.</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer Branding -->
          <tr>
            <td style="padding:40px;text-align:center;border-top:1px solid #1a1a1a;background-color:#0a0a0a;">
              <p style="margin:0;font-size:13px;color:#555555;">
                VIT-AP University · Amaravati, Andhra Pradesh · 522237<br />
                Questions? Visit <a href="https://vitopia.vitap.ac.in" style="color:#9AE600;text-decoration:none;">vitopia.vitap.ac.in</a>
              </p>
            </td>
          </tr>
        </table>
        
        <p style="margin:32px 0 0;font-size:11px;color:#333333;text-align:center;letter-spacing:0.5px;">
          THIS IS AN AUTOMATED MESSAGE. PLEASE DO NOT REPLY TO THIS EMAIL.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Sends a ticket email to the user for a specific order.
 * @param orderId Internal order ID
 * @param emailOverride Optional email to send the ticket to (instead of the user's email)
 */
export async function sendTicketEmail(orderId: string, emailOverride?: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const order = await ordersRepo.getByOrderId(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const recipientEmail = emailOverride || order.user?.email || "";
  if (!recipientEmail) {
    throw new Error(`No recipient email for order: ${orderId}`);
  }

  // Format the date nicely
  const eventDate = order.event?.date ? new Date(Number(order.event.date)) : new Date();
  const formattedDate = eventDate.toLocaleDateString("en-IN", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const qrToken = generateQRCode({ orderId: order.orderId });
  const qrBuffer = await generateStyledQRImage(qrToken);

  // Load logo
  const logoPath = path.join(__dirname, "../assets/vitopia.png");
  let logoBuffer: Buffer | null = null;
  try {
    logoBuffer = fs.readFileSync(logoPath);
  } catch (e) {
    console.warn("Could not read vitopia.png logo for email", e);
  }

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

  const { data, error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: [recipientEmail],
    subject: `Your VITopia '26 Ticket — ${order.event?.name || "Event"}`,
    html: buildEmailHtml({
      name: order.user?.name || "Attendee",
      orderId: order.orderId,
      eventName: order.event?.name || "Event",
      quantity: order.quantity,
      date: formattedDate,
      venue: order.event?.venue || "VIT-AP Campus",
      email: recipientEmail,
    }),
    attachments,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  // Update order as mailed
  await ordersRepo.updateOrder(orderId, { mailed: true });

  return { success: true, data };
}
