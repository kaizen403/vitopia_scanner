import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");

dotenv.config({ path: path.resolve("/home/kaizen/opus-fest/be/.env") });

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

const outputDir = "/home/kaizen/opus-fest/QRs";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Fetching Day1 orders via Convex CLI...");

const result = execSync('npx convex run orders:listDay1Orders \'{}\'', {
  cwd: '/home/kaizen/opus-fest/be',
  encoding: 'utf-8',
  timeout: 60000
});

const data = JSON.parse(result);
const orders = data.day1Orders;

const scannedDir = path.join(outputDir, "scanned");
const unscannedDir = path.join(outputDir, "unscanned");

if (!fs.existsSync(scannedDir)) {
  fs.mkdirSync(scannedDir, { recursive: true });
}
if (!fs.existsSync(unscannedDir)) {
  fs.mkdirSync(unscannedDir, { recursive: true });
}

console.log(`Found ${orders.length} Day1 orders`);
console.log("Generating QR codes...\n");

let count = 0;
for (const order of orders) {
  const payload = {
    orderId: order.orderId,
    eventId: order.eventId,
    userId: order.userId,
    quantity: order.quantity,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };

  const token = jwt.sign(payload, jwtSecret, { algorithm: "HS256" });
  const targetDir = order.checkedIn ? scannedDir : unscannedDir;
  const filename = path.join(targetDir, `${order.orderId}.png`);
  await QRCode.toFile(filename, token, { width: 512, margin: 2 });
  count++;
  process.stdout.write(`\rGenerated ${count}/${orders.length} QR codes`);
}

console.log(`\n\nDone! Generated ${count} QR codes in ${outputDir}`);
console.log(`Scanned: ${scannedDir}`);
console.log(`Unscanned: ${unscannedDir}`);
