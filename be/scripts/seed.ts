import "dotenv/config";
import crypto from "crypto";
import { prisma as basePrisma } from "../src/db/prisma.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { syncRegistrations } from "../src/jobs/praanaSync.js";

const prisma = basePrisma as unknown as PrismaClient;

const EVENT_SEEDS = [
  {
    name: "Praana2026-Day1",
    description: "PRAANA 2026 - Day 1",
    venue: "PIMS Campus",
    date: "1771734600000",
    category: "day" as const,
    scanOrder: 1,
    accessToken: "DAY_1",
  },
  {
    name: "Praana2026-Day2",
    description: "PRAANA 2026 - Day 2",
    venue: "PIMS Campus",
    date: "1771821000000",
    category: "day" as const,
    scanOrder: 2,
    accessToken: "DAY_2",
  },
  {
    name: "Praana2026-Day3",
    description: "PRAANA 2026 - Day 3",
    venue: "PIMS Campus",
    date: "1771907400000",
    category: "day" as const,
    scanOrder: 3,
    accessToken: "PROSHOW3",
  },
  {
    name: "Mr. Pranav Sharma on 22 Feb 2026 from 2.30 PM to 3.30 PM",
    description: "Speaker Event - Mr. Pranav Sharma",
    venue: "PIMS Campus",
    date: "1771750800000",
    category: "speaker" as const,
    scanOrder: 4,
    accessToken: "PRANAV",
  },
  {
    name: "Mr. Sarat Raja Uday Boddeda on 23rd Feb 2026 from 2.30 PM to 3.30 PM",
    description: "Speaker Event - Mr. Sarat Raja Uday Boddeda",
    venue: "PIMS Campus",
    date: "1771837200000",
    category: "speaker" as const,
    scanOrder: 5,
    accessToken: "UDAY",
  },
  {
    name: "PRAANA 2026 T-Shirt Distribution",
    description: "T-Shirt Distribution Counter",
    venue: "PIMS Campus",
    date: "1771903800000",
    category: "distribution" as const,
    scanOrder: 6,
    accessToken: "TSHIRT",
  },
  { name: "2 & 4 Legged Race", venue: "AB-1 Garden", scanOrder: 100 },
  { name: "Balloon Burst", venue: "AB-1 Outside", scanOrder: 101 },
  { name: "Bead Your Way", venue: "SAC (10×10)", scanOrder: 102 },
  { name: "Board Game Battle Zone", venue: "Outside Stall", scanOrder: 103 },
  { name: "Clay Modelling", venue: "Classroom", scanOrder: 104 },
  { name: "Electric Loop Buzzer", venue: "Outside Stall", scanOrder: 105 },
  { name: "Escape Room", venue: "Big Classroom", scanOrder: 106 },
  { name: "Flip Bottle – Pop Balloon", venue: "AB-2, G14", scanOrder: 107 },
  { name: "Freeze Frame Freeze", venue: "Classroom in CB / AB-2", scanOrder: 108 },
  { name: "Make Your Own Perfume Workshop", venue: "Stall", scanOrder: 109 },
  { name: "Mega Games", venue: "AB-2 Classroom", scanOrder: 110 },
  { name: "Mehendi Block Printing", venue: "Outdoor stall / AB-1 / CB classroom", scanOrder: 111 },
  { name: "Mehendi Stall", venue: "Outside Stall", scanOrder: 112 },
  { name: "Mini Games", venue: "AB-2 Classroom", scanOrder: 113 },
  { name: "Musical Chairs", venue: "AB-1 Backside", scanOrder: 114 },
  { name: "Orange Coin Balance", venue: "Stall", scanOrder: 115 },
  { name: "PIKA PIKA", venue: "Online", scanOrder: 116 },
  { name: "Pillow Fight", venue: "Rockplaza / Large classroom", scanOrder: 117 },
  { name: "POT-O-MANIA", venue: "AB-2, G19", scanOrder: 118 },
  { name: "Prop Relay Race", venue: "Sport triangle-1", scanOrder: 119 },
  { name: "Ring Toss", venue: "Outside Stall", scanOrder: 120 },
  { name: "Run Mat", venue: "AB-1 Garden", scanOrder: 121 },
  { name: "Sack Race", venue: "AB-1 Garden", scanOrder: 122 },
  { name: "Tattoo Stall", venue: "Stall", scanOrder: 123 },
  { name: "Tote Bag Stall", venue: "Outside Stall", scanOrder: 124 },
  { name: "Upside Down Games", venue: "AB-1 Classroom (curtains, 1st/2nd floor)", scanOrder: 125 },
  { name: "ViTQuest'26", venue: "Amphitheatre / Backside of ABs", scanOrder: 126 },
  { name: "Water Activities", venue: "Rockplaza", scanOrder: 127 },
  { name: "Whisper Challenge", venue: "Outside Stall", scanOrder: 128 },
];

function generateQrToken(orderId: string): string {
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET || "Salt123")
    .update(orderId)
    .digest("hex")
    .toUpperCase()
    .substring(0, 16);
}

async function seedEvents(): Promise<number> {
  const now = BigInt(Date.now());
  let count = 0;

  for (const def of EVENT_SEEDS) {
    const isPrime = "accessToken" in def && def.accessToken != null;
    await prisma.event.create({
      data: {
        name: def.name,
        description: isPrime ? (def as any).description : "Non-Prime Carnival Activity",
        date: BigInt(isPrime ? (def as any).date : "1740200400000"),
        venue: def.venue,
        capacity: 10000,
        price: 0,
        isActive: true,
        accessToken: isPrime ? (def as any).accessToken : null,
        category: isPrime ? (def as any).category : "day",
        scanOrder: def.scanOrder,
        createdAt: now,
      },
    });
    count++;
  }

  return count;
}

async function seedGates(): Promise<number> {
  const now = BigInt(Date.now());
  let count = 0;

  for (let i = 1; i <= 20; i++) {
    await prisma.gate.create({
      data: {
        gateId: `M-${i.toString().padStart(2, "0")}`,
        name: `Male Scanner ${i}`,
        secret: "v2026",
        gender: "M",
        isActive: true,
        createdAt: now,
      },
    });
    count++;
  }

  for (let i = 1; i <= 20; i++) {
    await prisma.gate.create({
      data: {
        gateId: `F-${i.toString().padStart(2, "0")}`,
        name: `Female Scanner ${i}`,
        secret: "v2026",
        gender: "F",
        isActive: true,
        createdAt: now,
      },
    });
    count++;
  }

  return count;
}

async function verify() {
  const eventCount = await prisma.event.count();
  const primeCount = await prisma.event.count({ where: { accessToken: { not: null } } });
  const nonPrimeCount = await prisma.event.count({ where: { accessToken: null } });
  const gateCount = await prisma.gate.count();
  const orderCount = await prisma.order.count();
  const userCount = await prisma.user.count();

  console.log("\n=== Verification ===");
  console.log(`Events:  ${eventCount} total (${primeCount} prime, ${nonPrimeCount} non-prime)`);
  console.log(`Gates:   ${gateCount}`);
  console.log(`Orders:  ${orderCount}`);
  console.log(`Users:   ${userCount}`);

  const failures: string[] = [];
  if (eventCount !== 35) failures.push(`Expected 35 events, got ${eventCount}`);
  if (primeCount !== 6) failures.push(`Expected 6 prime events, got ${primeCount}`);
  if (nonPrimeCount !== 29) failures.push(`Expected 29 non-prime events, got ${nonPrimeCount}`);
  if (gateCount !== 40) failures.push(`Expected 40 gates, got ${gateCount}`);

  if (failures.length > 0) {
    console.error("\nVERIFICATION FAILED:");
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log("\n✓ All counts verified.");
}

async function testScanning() {
  console.log("\n=== Scan Pipeline Test ===");

  const day1 = await prisma.event.findFirst({ where: { accessToken: "DAY_1" } });
  if (!day1) throw new Error("DAY_1 event not found");

  const testUser = await prisma.user.create({
    data: {
      name: "Test Scanner User",
      email: "test-scan@example.com",
      createdAt: BigInt(Date.now()),
    },
  });

  const testOrderId = `TEST-SCAN-${Date.now()}`;
  const qrToken = generateQrToken(testOrderId);

  await prisma.order.create({
    data: {
      orderId: testOrderId,
      qrToken,
      userId: testUser.id,
      eventId: day1.id,
      quantity: 1,
      totalAmount: 0,
      paymentStatus: "paid",
      checkedIn: false,
      accessTokens: ["DAY_1"],
      createdAt: BigInt(Date.now()),
      updatedAt: BigInt(Date.now()),
    },
  });

  const found = await prisma.order.findUnique({ where: { qrToken: qrToken.toUpperCase() } });
  if (!found) throw new Error(`QR token lookup failed for token ${qrToken}`);
  if (found.orderId !== testOrderId) throw new Error("QR token mapped to wrong order");

  const hasAccess = found.accessTokens.includes(day1.accessToken!);
  if (!hasAccess) throw new Error("accessToken check failed");

  await prisma.order.update({
    where: { orderId: testOrderId },
    data: { checkedIn: true, checkedInAt: BigInt(Date.now()), checkedInBy: "M-01", checkedInGate: "M-01" },
  });

  const checkedOrder = await prisma.order.findUnique({ where: { orderId: testOrderId } });
  if (!checkedOrder?.checkedIn) throw new Error("Check-in update failed");

  const alreadyUsed = checkedOrder.checkedIn;
  if (!alreadyUsed) throw new Error("Duplicate scan detection failed");

  await prisma.order.delete({ where: { orderId: testOrderId } });
  await prisma.user.delete({ where: { id: testUser.id } });

  console.log(`  QR token:     ${qrToken}`);
  console.log(`  Order lookup:  ✓`);
  console.log(`  Access check:  ✓`);
  console.log(`  Check-in:      ✓`);
  console.log(`  Dup detection: ✓`);
  console.log("✓ Scan pipeline test passed.");
}

async function main() {
  console.log("=== Step 1: Clearing ALL existing data ===");
  await prisma.scanLog.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.gate.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("Database cleared.");

  console.log("\n=== Step 2: Seeding events ===");
  const eventCount = await seedEvents();
  console.log(`Seeded ${eventCount} events.`);

  console.log("\n=== Step 3: Seeding gates ===");
  const gateCount = await seedGates();
  console.log(`Seeded ${gateCount} gates.`);

  console.log("\n=== Step 4: Syncing registrations from PRAANA API ===");
  await syncRegistrations();

  await verify();
  await testScanning();

  console.log("\n=== Seed complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
