import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const gateRes = await client.query('SELECT gate_id as "gateId", secret FROM gates LIMIT 1');
  const gateId = gateRes.rows[0]?.gateId;
  const gateSecret = gateRes.rows[0]?.secret;
  if (!gateId || !gateSecret) throw new Error("No gate found");

  const orderRes = await client.query(`
    SELECT order_id as "orderId", event_id as "eventId", qr_token as "qrToken" FROM orders 
    WHERE checked_in = false AND payment_status = 'paid' LIMIT 1
  `);
  const order = orderRes.rows[0];
  if (!order) throw new Error("No order found");

  console.log("Testing scanning Order ID:", order.orderId, "Event ID:", order.eventId, "at Gate:", gateId);

  const jwtTokenRes = await fetch("http://localhost:5001/api/dashboard/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "408012" })
  });
  const jwtPayload = await jwtTokenRes.json();

  const scanVerifyReq = await fetch("http://localhost:5001/api/scan/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gate-Id": gateId,
      "X-Gate-Secret": gateSecret,
      "Authorization": `Bearer ${jwtPayload.data}`
    },
    body: JSON.stringify({ qrCode: order.qrToken, eventId: order.eventId })
  });

  console.log("Check-in result:");
  console.log(await scanVerifyReq.json());

  await client.end();
}

main().catch(console.error);
