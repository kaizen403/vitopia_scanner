import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Undo the test scan we just did
await client.query(`
  UPDATE orders SET checked_in = false, checked_in_at = NULL, checked_in_by = NULL, checked_in_gate = NULL, updated_at = $1
  WHERE order_id = 'ORD-20260218182007-6107'
`, [BigInt(Date.now())]);

// Also remove the scan log for it
await client.query(`
  DELETE FROM scan_logs WHERE order_id = 'ORD-20260218182007-6107' AND scan_result = 'success'
`);

console.log("Test order reset to unchecked.");
await client.end();
