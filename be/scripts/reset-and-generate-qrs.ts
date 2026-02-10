import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { mkdirSync, rmSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QR_DIR = path.resolve(__dirname, "../../QRs");

const CONVEX_URL = "https://honorable-nightingale-182.convex.cloud";
const JWT_SECRET = "your_super_secret_jwt_key_change_in_production";

const convex = new ConvexHttpClient(CONVEX_URL);

function generateQRToken(data: {
  orderId: string;
  eventId: string;
  userId: string;
  quantity: number;
}): string {
  const payload = {
    ...data,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
}

async function main() {
  console.log("=== Step 1: Clearing all data ===");
  const clearResult = await convex.mutation(api.orders.clearAllData, {});
  console.log(
    `Deleted: ${clearResult.deletedOrders} orders, ${clearResult.deletedScanLogs} scanLogs, ${clearResult.deletedUsers} users`
  );

  console.log("\n=== Step 2: Seeding fresh data ===");
  const seedResult = await convex.mutation(api.users.seedVitopia, {});
  console.log(
    `Seeded: ${seedResult.day1Orders} Day1 orders, ${seedResult.day2Orders} Day2 orders`
  );
  console.log(`Day1 event: ${seedResult.day1EventId}`);
  console.log(`Day2 event: ${seedResult.day2EventId}`);

  console.log("\n=== Step 3: Fetching Day1 orders ===");
  const day1Data = await convex.query(api.orders.listDay1Orders, {});
  console.log(`Found ${day1Data.day1Orders.length} Day1 orders`);

  console.log("\n=== Step 4: Generating QR codes ===");

  if (existsSync(QR_DIR)) {
    rmSync(QR_DIR, { recursive: true });
  }
  mkdirSync(path.join(QR_DIR, "unscanned"), { recursive: true });

  let generated = 0;
  for (const order of day1Data.day1Orders) {
    const token = generateQRToken({
      orderId: order.orderId,
      eventId: order.eventId,
      userId: order.userId,
      quantity: order.quantity,
    });

    const verified = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as any;
    if (verified.orderId !== order.orderId) {
      console.error(`VERIFICATION FAILED for ${order.orderId}`);
      continue;
    }

    const filename = `${order.orderId}.png`;
    const filepath = path.join(QR_DIR, "unscanned", filename);

    await QRCode.toFile(filepath, token, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 400,
      color: { dark: "#000000", light: "#ffffff" },
    });

    generated++;
  }

  console.log(`Generated ${generated} QR codes in ${QR_DIR}/unscanned/`);
  console.log("\n=== Done! ===");
  console.log("Send the QR PNGs from QRs/unscanned/ to your phone to test scanning.");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
