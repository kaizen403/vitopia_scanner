import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const statsRes = await client.query(`
  SELECT 
    COUNT(*) FILTER (WHERE qr_token IS NULL) as null_qr,
    COUNT(*) FILTER (WHERE qr_token IS NOT NULL) as has_qr,
    COUNT(*) as total
  FROM orders WHERE payment_status = 'paid'
`);
console.log("QR Token stats for paid orders:", statsRes.rows[0]);

const nullRes = await client.query(`
  SELECT order_id, payment_status, checked_in, qr_token FROM orders 
  WHERE payment_status = 'paid' LIMIT 5
`);
console.log("Sample paid orders:", nullRes.rows);

await client.end();
