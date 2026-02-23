import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const gateRes = await client.query('SELECT gate_id, secret FROM gates WHERE is_active = true LIMIT 1');
const gate = gateRes.rows[0];
console.log("Gate:", gate?.gate_id, "| Secret:", gate?.secret);

const orderRes = await client.query(`
  SELECT o.order_id, o.event_id, o.qr_token, e.name as event_name
  FROM orders o JOIN events e ON e.id = o.event_id
  WHERE o.checked_in = false AND o.payment_status = 'paid' AND o.qr_token IS NOT NULL LIMIT 1
`);
const order = orderRes.rows[0];
if (!order) { console.log("No valid orders found!"); await client.end(); process.exit(0); }
console.log("Order:", order.order_id, "| Event:", order.event_name, "| QR:", order.qr_token);

const resp = await fetch("http://localhost:5001/api/scan/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Gate-Id": gate.gate_id, "X-Gate-Secret": gate.secret },
  body: JSON.stringify({ qrCode: order.qr_token, eventId: order.event_id })
});
const result = await resp.json();
console.log("Scan result:", JSON.stringify(result, null, 2));
await client.end();
