import "dotenv/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import { prisma } from "../src/db/prisma.ts";
import type { PrismaClient } from "../generated/prisma/client.js";
import { generateQRCode } from "../src/utils/qr-code.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QR_DIR = path.resolve(__dirname, "../../QRs");

type EventSeedDefinition = {
  token: string;
  name: string;
  description: string;
  venue: string;
  date: string;
  category: "day" | "speaker" | "distribution";
  scanOrder: number;
  folderName: string | null; // null = skip QR generation for this event
};

const EVENT_SEEDS: EventSeedDefinition[] = [
  {
    token: "DAY_1",
    name: "Vitopia2026-Day1",
    description: "VITopia 2026 - Day 1",
    venue: "VIT-AP Campus",
    date: "2026-02-22T10:00:00+05:30",
    category: "day",
    scanOrder: 1,
    folderName: "Day 1",
  },
  {
    token: "DAY_2",
    name: "Vitopia2026-Day2",
    description: "VITopia 2026 - Day 2",
    venue: "VIT-AP Campus",
    date: "2026-02-23T10:00:00+05:30",
    category: "day",
    scanOrder: 2,
    folderName: "Day 2",
  },
  {
    token: "DAY_3",
    name: "Vitopia2026-Day3",
    description: "VITopia 2026 - Day 3",
    venue: "VIT-AP Campus",
    date: "2026-02-24T10:00:00+05:30",
    category: "day",
    scanOrder: 3,
    folderName: "Day 3",
  },
  {
    token: "PRANAV",
    name: "Mr. Pranav Sharma on 22 Feb 2026 from 2.30 PM to 3.30 PM",
    description: "Speaker Event - Mr. Pranav Sharma",
    venue: "VIT-AP Campus",
    date: "2026-02-22T14:30:00+05:30",
    category: "speaker",
    scanOrder: 4,
    folderName: "Pranav Sharma",
  },
  {
    token: "UDAYA",
    name: "Mr. Sarat Raja Uday Boddeda on 23rd Feb 2026 from 2.30 PM to 3.30 PM",
    description: "Speaker Event - Mr. Sarat Raja Uday Boddeda",
    venue: "VIT-AP Campus",
    date: "2026-02-23T14:30:00+05:30",
    category: "speaker",
    scanOrder: 5,
    folderName: "Uday",
  },
  {
    token: "TSHIRT",
    name: "VITopia 2026 T-Shirt Distribution",
    description: "T-Shirt Distribution Counter",
    venue: "VIT-AP Campus",
    date: "2026-02-24T09:00:00+05:30",
    category: "distribution",
    scanOrder: 6,
    folderName: null, // user didn't ask for tshirt QRs
  },
];

const ORDERS_PER_EVENT = 50;

function generateOrderId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg1 = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const seg2 = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `ORD-${seg1}-${seg2}`;
}

function generateEmail(index: number, eventToken: string): string {
  const prefix = eventToken.toLowerCase().replace(/_/g, "");
  return `participant${index + 1}.${prefix}@vitapstudent.ac.in`;
}

function generateName(index: number): string {
  const firstNames = [
    "Aarav", "Aditi", "Aisha", "Akash", "Ananya", "Arjun", "Bhavya", "Chetan",
    "Deepa", "Divya", "Esha", "Farhan", "Gauri", "Harsh", "Isha", "Jai",
    "Kavya", "Krishna", "Lakshmi", "Manish", "Neha", "Om", "Priya", "Rahul",
    "Sakshi", "Tanvi", "Uday", "Varun", "Yash", "Zara", "Rohan", "Sneha",
    "Vikram", "Pooja", "Nikhil", "Megha", "Siddharth", "Riya", "Karan", "Anjali",
    "Dev", "Shruti", "Aditya", "Nisha", "Pranav", "Tanya", "Vishal", "Swati",
    "Amit", "Komal",
  ];
  const lastNames = [
    "Sharma", "Patel", "Reddy", "Kumar", "Singh", "Gupta", "Nair", "Joshi",
    "Verma", "Rao", "Das", "Mehta", "Iyer", "Pillai", "Shah", "Chopra",
    "Malhotra", "Bhat", "Kaur", "Saxena", "Agarwal", "Mishra", "Pandey", "Desai",
    "Banerjee", "Choudhury", "Mukherjee", "Kapoor", "Sinha", "Thakur", "Dubey", "Tiwari",
    "Chatterjee", "Roy", "Sen", "Bose", "Ghosh", "Dutta", "Kulkarni", "Patil",
    "Jain", "Sethi", "Khanna", "Arora", "Bhatia", "Bajaj", "Goswami", "Rathore",
    "Chauhan", "Yadav",
  ];
  return `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`;
}

async function main() {
  const db = prisma as unknown as PrismaClient;
  const now = BigInt(Date.now());

  console.log("=== Step 1: Clearing existing data ===");
  await db.scanLog.deleteMany({});
  await db.order.deleteMany({});
  await db.gate.deleteMany({});
  await db.event.deleteMany({});
  await db.user.deleteMany({});

  console.log("=== Step 2: Creating events & gates ===");
  const eventByToken = new Map<string, { id: string; name: string; accessToken: string | null }>();

  for (const def of EVENT_SEEDS) {
    const created = await db.event.create({
      data: {
        name: def.name,
        description: def.description,
        date: BigInt(new Date(def.date).getTime()),
        venue: def.venue,
        capacity: 10000,
        price: 0,
        isActive: true,
        accessToken: def.token,
        category: def.category,
        scanOrder: def.scanOrder,
        createdAt: now,
      },
    });

    eventByToken.set(def.token, {
      id: created.id,
      name: created.name,
      accessToken: created.accessToken,
    });

    await db.gate.create({
      data: {
        name: `${def.name} Gate`,
        eventId: created.id,
        gateId: `gate-${def.token.toLowerCase()}`,
        isActive: true,
        createdAt: now,
      },
    });

    console.log(`  Created event: ${def.name} (${def.token})`);
  }

  console.log("=== Step 2b: Seeding 40 scanner accounts (20M/20F) ===");
  const day1Event = eventByToken.get("DAY_1");
  if (day1Event) {
    // Seed Male Scanners
    for (let i = 1; i <= 20; i++) {
      const gateId = `SCAN-M-${i.toString().padStart(3, "0")}`;
      const name = `Male Scanner ${i}`;
      const secret = `vitopia-m-${i.toString().padStart(3, "0")}`;

      await db.gate.create({
        data: {
          gateId,
          name,
          secret,
          gender: "M",
          eventId: day1Event.id,
          isActive: true,
          createdAt: now,
        },
      });
    }

    // Seed Female Scanners
    for (let i = 1; i <= 20; i++) {
      const gateId = `SCAN-F-${i.toString().padStart(3, "0")}`;
      const name = `Female Scanner ${i}`;
      const secret = `vitopia-f-${i.toString().padStart(3, "0")}`;

      await db.gate.create({
        data: {
          gateId,
          name,
          secret,
          gender: "F",
          eventId: day1Event.id,
          isActive: true,
          createdAt: now,
        },
      });
    }
    console.log("  Created 40 scanner accounts.");
  }

  console.log("=== Step 3: Creating orders (50 per event) ===");
  if (fs.existsSync(QR_DIR)) {
    fs.rmSync(QR_DIR, { recursive: true });
  }

  const eventsWithFolders = EVENT_SEEDS.filter((def) => def.folderName !== null);
  let totalOrders = 0;
  let totalQRs = 0;

  for (const def of eventsWithFolders) {
    const event = eventByToken.get(def.token);
    if (!event) throw new Error(`Event not found for token: ${def.token}`);

    const folderPath = path.join(QR_DIR, def.folderName!);
    fs.mkdirSync(folderPath, { recursive: true });

    for (let i = 0; i < ORDERS_PER_EVENT; i++) {
      const orderId = generateOrderId();
      const email = generateEmail(i, def.token);
      const name = generateName(i);

      const user = await db.user.create({
        data: {
          email,
          name,
          college: "VIT-AP",
          createdAt: now,
        },
      });

      const accessTokens = [def.token];
      const tshirtEligible = i < 10 && def.category === "day";
      if (tshirtEligible) {
        accessTokens.push("TSHIRT");
      }

      await db.order.create({
        data: {
          orderId,
          userId: user.id,
          eventId: event.id,
          quantity: 1,
          totalAmount: 0,
          paymentStatus: "paid",
          checkedIn: false,
          accessTokens,
          tshirtEligible,
          tshirtSize: tshirtEligible ? ["S", "M", "L", "XL", "XXL"][i % 5] : null,
          tshirtColor: tshirtEligible ? ["Black", "White"][i % 2] : null,
          productMeta: `${def.name} - ${name}`,
          createdAt: now,
          updatedAt: now,
        },
      });

      const qrToken = generateQRCode({ orderId });

      const filePath = path.join(folderPath, `${orderId}.png`);
      await QRCode.toFile(filePath, qrToken, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 400,
        color: { dark: "#000000", light: "#ffffff" },
      });

      totalQRs++;
      totalOrders++;
    }

    console.log(`  ${def.folderName}: ${ORDERS_PER_EVENT} orders + QR codes`);
  }

  const tshirtEvent = eventByToken.get("TSHIRT");
  if (tshirtEvent) {
    console.log("  (T-Shirt event created but no QR folder — user didn't request it)");
  }

  console.log(`\n=== Done ===`);
  console.log(`Total orders created: ${totalOrders}`);
  console.log(`Total QR codes generated: ${totalQRs}`);
  console.log(`\nQR folder structure:`);

  for (const def of eventsWithFolders) {
    const folderPath = path.join(QR_DIR, def.folderName!);
    const files = fs.readdirSync(folderPath);
    console.log(`  ${QR_DIR}/${def.folderName}/ → ${files.length} files`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
