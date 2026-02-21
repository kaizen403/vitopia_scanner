import { Router, Request, Response } from "express";
import { Resend } from "resend";
import * as ordersRepo from "../db/orders.js";
import { generateQRCode } from "../utils/qr-code.js";
import { generateStyledQRImage } from "../utils/qr-image.js";

const router: Router = Router();

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  }
  return _resend;
}

const FROM_EMAIL = process.env.MAIL_FROM || "VITopia '26 <tickets@vitopia.vitap.ac.in>";

router.post("/send", async (req: Request, res: Response) => {
  const { orderIds } = req.body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    res.status(400).json({ success: false, error: "orderIds array is required" });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    res.status(500).json({ success: false, error: "RESEND_API_KEY is not configured" });
    return;
  }

  const results: { orderId: string; status: "sent" | "failed"; error?: string }[] = [];

  for (const orderId of orderIds) {
    try {
      const order = await ordersRepo.getByOrderId(orderId);
      if (!order) {
        results.push({ orderId, status: "failed", error: "Order not found" });
        continue;
      }

      if (!order.user?.email) {
        results.push({ orderId, status: "failed", error: "No email on order" });
        continue;
      }

      const qrToken = generateQRCode({ orderId: order.orderId });
      const qrBuffer = await generateStyledQRImage(qrToken);
      const qrBase64 = qrBuffer.toString("base64");

      const { error: sendError } = await getResend().emails.send({
        from: FROM_EMAIL,
        to: [order.user.email],
        subject: `Your VITopia '26 Ticket — ${order.event?.name || "Event"}`,
        html: buildEmailHtml({
          name: order.user.name,
          orderId: order.orderId,
          eventName: order.event?.name || "Event",
          quantity: order.quantity,
        }),
        attachments: [
          {
            filename: `ticket-${order.orderId}.png`,
            content: qrBase64,
            contentType: "image/png",
          },
        ],
      });

      if (sendError) {
        results.push({ orderId, status: "failed", error: sendError.message });
        continue;
      }

      await ordersRepo.updateOrder(orderId, { mailed: true });
      results.push({ orderId, status: "sent" });
    } catch (err: any) {
      results.push({ orderId, status: "failed", error: err.message || "Unknown error" });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  res.json({ success: true, data: { sent, failed, results } });
});

function buildEmailHtml(data: {
  name: string;
  orderId: string;
  eventName: string;
  quantity: number;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0a0a0a,#1a1a1a);padding:40px 32px;border-bottom:1px solid #222;">
              <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                VITopia <span style="color:#9AE600;">'26</span>
              </h1>
              <p style="margin:8px 0 0;color:#666;font-size:14px;">Your ticket is ready</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
                Hey <strong>${data.name}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#999;">
                Your registration for <strong style="color:#fff;">${data.eventName}</strong> is confirmed.
                Show the attached QR code at the gate for entry.
              </p>
              <table cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #222;border-radius:12px;width:100%;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #1a1a1a;">
                    <span style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Order ID</span>
                    <div style="color:#9AE600;font-family:monospace;font-size:14px;margin-top:4px;">${data.orderId}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tickets</span>
                    <div style="color:#fff;font-size:14px;margin-top:4px;">${data.quantity} × ${data.eventName}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">
                QR code is attached as an image. Keep it handy on your phone for quick entry.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#0a0a0a;border-top:1px solid #1a1a1a;">
              <p style="margin:0;font-size:12px;color:#444;text-align:center;">
                VIT-AP University · Amaravati, AP · vitopia.vitap.ac.in
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export default router;
