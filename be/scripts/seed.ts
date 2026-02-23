import "dotenv/config";
import { prisma as basePrisma } from "../src/db/prisma.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { syncRegistrations } from "../src/jobs/vtopiaSync.js";

const prisma = basePrisma as unknown as PrismaClient;

const EVENT_SEEDS = [
  {
    name: "Day-2 Pro show",
    description: "Day-2 Pro show",
    venue: "VIT-AP Campus",
    date: "1771821000000",
    category: "day" as const,
    scanOrder: 1,
    accessToken: "DAY_2",
    isPrime: true,
  }
];

async function seedEvents(): Promise<number> {
  const now = BigInt(Date.now());
  let count = 0;

  for (const def of EVENT_SEEDS) {
    await prisma.event.create({
      data: {
        name: def.name,
        description: def.description,
        date: BigInt(def.date),
        venue: def.venue,
        capacity: 10000,
        price: 0,
        isActive: true,
        accessToken: def.accessToken,
        category: def.category,
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

  console.log("\n=== Step 4: Syncing registrations from VTOPIA API ===");
  const summary = await syncRegistrations();

  console.log("\n=== Day-2 Sync Summary ===");
  console.log(`Total API rows: ${summary.totalApiRecords}`);
  console.log(`Total Day-2 rows in API: ${summary.totalDay2Records}`);
  console.log(`Day-2 rows upserted: ${summary.upserted}`);
  console.log(`Day-2 sync errors: ${summary.errors}`);

  console.log("\n=== Seed complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
