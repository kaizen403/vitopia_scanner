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

console.log("Fetching all orders with null qr_token...");
const { rows } = await client.query<{ order_id: string }>(
  `SELECT order_id FROM orders WHERE qr_token IS NULL`
);
console.log(`Found ${rows.length} orders to backfill.`);

if (rows.length === 0) {
  console.log("Nothing to do!");
  await client.end();
  process.exit(0);
}

// Build a massive VALUES list for one big UPDATE
// Use multiple batches of 1000 to avoid huge queries
const BATCH_SIZE = 1000;
let totalUpdated = 0;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  
  // Build: UPDATE orders SET qr_token = CASE WHEN order_id = $1 THEN $2 ... END WHERE order_id IN (...)
  const valuesList = batch.map(({ order_id }) => `('${order_id.replace(/'/g, "''")}', '${generateQrToken(order_id)}')`).join(',');
  
  await client.query(`
    UPDATE orders SET qr_token = v.qr_token
    FROM (VALUES ${valuesList}) AS v(order_id, qr_token)
    WHERE orders.order_id = v.order_id
  `);
  
  totalUpdated += batch.length;
  console.log(`  Updated ${totalUpdated}/${rows.length}...`);
}

console.log(`\nBackfill complete! Updated ${totalUpdated} orders.`);

// Verify
const { rows: check } = await client.query(
  `SELECT COUNT(*) FILTER (WHERE qr_token IS NULL) as remaining_null, COUNT(*) as total FROM orders`
);
console.log("Remaining null qr_tokens:", check[0].remaining_null, "/ Total:", check[0].total);

await client.end();
