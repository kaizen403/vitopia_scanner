import crypto from 'crypto';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "Salt123";

function generateQrToken(orderId: string): string {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(orderId)
    .digest("hex")
    .toUpperCase()
    .substring(0, 16);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Get all orders with null qr_token
const { rows } = await client.query<{ order_id: string }>(
  `SELECT order_id FROM orders WHERE qr_token IS NULL`
);
console.log(`Found ${rows.length} orders with null qr_token. Backfilling...`);

let updated = 0;
let errors = 0;

for (const { order_id } of rows) {
  try {
    const qrToken = generateQrToken(order_id);
    await client.query(
      `UPDATE orders SET qr_token = $1 WHERE order_id = $2`,
      [qrToken, order_id]
    );
    updated++;
    if (updated % 500 === 0) console.log(`  Updated ${updated}/${rows.length}...`);
  } catch (e) {
    errors++;
    console.error(`  Error for ${order_id}:`, e);
  }
}

console.log(`\nDone! Updated ${updated} orders, ${errors} errors.`);

// Verify
const { rows: check } = await client.query(
  `SELECT COUNT(*) FILTER (WHERE qr_token IS NULL) as remaining_null FROM orders`
);
console.log("Remaining null qr_tokens:", check[0].remaining_null);

await client.end();
