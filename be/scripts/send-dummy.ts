import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

async function main() {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0a0a0a,#1a1a1a);padding:40px 32px;border-bottom:1px solid #222;">
          <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">PRAANA <span style="color:#9AE600;">'26</span></h1>
          <p style="margin:8px 0 0;color:#666;font-size:14px;">Your ticket is ready</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Hey <strong>Rishi</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#999;">
            Your registration for <strong style="color:#fff;">Pro Show - Day 1</strong> is confirmed.
            Show the attached QR code at the gate for entry.
          </p>
          <table cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #222;border-radius:12px;width:100%;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #1a1a1a;">
              <span style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Order ID</span>
              <div style="color:#9AE600;font-family:monospace;font-size:14px;margin-top:4px;">ORD-TEST-DUMMY-001</div>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <span style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tickets</span>
              <div style="color:#fff;font-size:14px;margin-top:4px;">1 × Pro Show - Day 1</div>
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">This is a test email. No real ticket is attached.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#0a0a0a;border-top:1px solid #1a1a1a;">
          <p style="margin:0;font-size:12px;color:#444;text-align:center;">PIMS University · Amaravati, AP · pims.ac.in</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    console.log("Sending test email to rishi.23bce8982@pimsstudent.ac.in...");

    const { data, error } = await resend.emails.send({
        from: "PRAANA '26 <tickets@pims.ac.in>",
        to: ["rishi.23bce8982@pimsstudent.ac.in"],
        subject: "Your PRAANA '26 Ticket — Pro Show - Day 1 (TEST)",
        html,
    });

    if (error) {
        console.error("Failed:", JSON.stringify(error, null, 2));
    } else {
        console.log("Sent!", JSON.stringify(data, null, 2));
    }
}

main();
