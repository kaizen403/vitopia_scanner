import { Resend } from "resend";
import * as ordersRepo from "../db/orders.js";
import { generateQRCode } from "./qr-code.js";
import { generateStyledQRImage } from "./qr-image.js";

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
    qrBase64: string;
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Inter',sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:60px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #2a2a2a;border-radius:24px;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,0.5);">
          
          <!-- Header Area -->
          <tr>
            <td style="padding:48px 40px;text-align:center;border-bottom:1px solid #2a2a2a;background:linear-gradient(180deg, #1f1f1f 0%, #141414 100%);">
              <div style="font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#9AE600;margin-bottom:16px;">VIT-AP University Presents</div>
              <h1 style="margin:0;font-size:42px;font-weight:800;letter-spacing:-1.5px;color:#ffffff;">
                VITopia <span style="color:#9AE600;">'26</span>
              </h1>
              <div style="margin-top:16px;display:inline-block;padding:8px 16px;background-color:rgba(154, 230, 0, 0.1);border-radius:100px;border:1px solid rgba(154, 230, 0, 0.2);">
                <span style="font-size:14px;font-weight:600;color:#9AE600;">Official Ticket</span>
              </div>
            </td>
          </tr>

          <!-- Content Area -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;">
                Hi ${data.name},
              </p>
              <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#a0a0a0;">
                You're officially on the list. We've attached your QR code below—this is your exclusive pass to the event. Keep it safe and have it ready at the gate.
              </p>
              
              <!-- Details Box -->
              <table cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;border:1px solid #2a2a2a;border-radius:16px;width:100%;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;border-bottom:1px solid #1f1f1f;">
                    <div style="margin-bottom:20px;">
                      <span style="display:block;color:#666666;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Event Access</span>
                      <span style="display:block;color:#ffffff;font-size:18px;font-weight:600;">${data.eventName}</span>
                    </div>
                    <div style="display:inline-block;margin-right:48px;">
                      <span style="display:block;color:#666666;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Quantity</span>
                      <span style="display:block;color:#ffffff;font-size:16px;font-weight:500;">${data.quantity} Pass${data.quantity > 1 ? 'es' : ''}</span>
                    </div>
                    <div style="display:inline-block;">
                      <span style="display:block;color:#666666;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Order Ref</span>
                      <span style="display:block;color:#9AE600;font-family:'Courier New',monospace;font-size:14px;font-weight:600;">${data.orderId}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;text-align:center;background-color:#ffffff;border-bottom-left-radius:16px;border-bottom-right-radius:16px;">
                    <!-- Base64 inline image -->
                    <img src="data:image/png;base64,${data.qrBase64}" alt="Your Ticket QR Code" style="width:200px;height:200px;display:block;margin:0 auto;" />
                    <p style="margin:16px 0 0;font-size:13px;font-weight:500;color:#666666;">Scan at the entry gate</p>
                  </td>
                </tr>
              </table>

              <div style="background-color:rgba(255,255,255,0.03);border-radius:12px;padding:20px;">
                <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#ffffff;">Need to know</h3>
                <ul style="margin:0;padding-left:20px;color:#a0a0a0;font-size:14px;line-height:1.6;">
                  <li style="margin-bottom:8px;">Have your brightness up when scanning.</li>
                  <li style="margin-bottom:8px;">Valid ID required at entry.</li>
                  <li>Please arrive early to avoid the rush.</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px;text-align:center;border-top:1px solid #2a2a2a;background-color:#0a0a0a;">
              <p style="margin:0;font-size:14px;font-weight:500;color:#666666;">
                VIT-AP University Campus<br />
                <span style="color:#444444;">Amaravati, Andhra Pradesh</span>
              </p>
              <div style="margin-top:24px;padding-top:24px;border-top:1px solid #1f1f1f;">
                <a href="https://vitopia.vitap.ac.in" style="color:#9AE600;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.5px;">vitopia.vitap.ac.in</a>
              </div>
            </td>
          </tr>
        </table>
        
        <p style="margin:32px 0 0;font-size:12px;color:#444444;text-align:center;">
          This is an automated message. Please do not reply.
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

    const recipientEmail = emailOverride || order.user?.email;
    if (!recipientEmail) {
        throw new Error(`No recipient email for order: ${orderId}`);
    }

    const qrToken = generateQRCode({ orderId: order.orderId });
    const qrBuffer = await generateStyledQRImage(qrToken);
    const qrBase64 = qrBuffer.toString("base64");

    const { data, error } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: [recipientEmail],
        subject: `Your VITopia '26 Ticket — ${order.event?.name || "Event"}`,
        html: buildEmailHtml({
            name: order.user?.name || "Attendee",
            orderId: order.orderId,
            eventName: order.event?.name || "Event",
            quantity: order.quantity,
            qrBase64: qrBase64,
        }),
        attachments: [
            {
                filename: `ticket-${order.orderId}.png`,
                content: qrBase64,
                contentType: "image/png",
            },
        ],
    });

    if (error) {
        throw new Error(`Resend error: ${error.message}`);
    }

    // Update order as mailed
    await ordersRepo.updateOrder(orderId, { mailed: true });

    return { success: true, data };
}
