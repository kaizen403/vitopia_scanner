import "dotenv/config";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import { prisma } from "../src/db/prisma.ts";
import type { PrismaClient } from "../generated/prisma/client.js";
import { generateQRCode } from "../src/utils/qr-code.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QR_DIR = path.resolve(__dirname, "../../QRs");

const DEFAULT_CSV_PATH = "/home/kaizen/Downloads/vtopia_events.csv";

type CsvRow = {
  receipt_id: string;
  product_meta: string;
  email: string;
  order_id: string;
  invoice_number: string;
  event_id: string;
  registration_id: string;
  field_values: string;
  total: string;
  name: string;
};

type TshirtDetails = {
  eligible: boolean;
  size: string | null;
  color: string | null;
};

type EventSeedDefinition = {
  token: string;
  name: string;
  description: string;
  venue: string;
  date: string;
  category: "day" | "speaker" | "distribution";
  scanOrder: number;
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
  },
  {
    token: "DAY_2",
    name: "Vitopia2026-Day2",
    description: "VITopia 2026 - Day 2",
    venue: "VIT-AP Campus",
    date: "2026-02-23T10:00:00+05:30",
    category: "day",
    scanOrder: 2,
  },
  {
    token: "DAY_3",
    name: "Vitopia2026-Day3",
    description: "VITopia 2026 - Day 3",
    venue: "VIT-AP Campus",
    date: "2026-02-24T10:00:00+05:30",
    category: "day",
    scanOrder: 3,
  },
  {
    token: "PRANAV",
    name: "Mr. Pranav Sharma on 22 Feb 2026 from 2.30 PM to 3.30 PM",
    description: "Speaker Event - Mr. Pranav Sharma",
    venue: "VIT-AP Campus",
    date: "2026-02-22T14:30:00+05:30",
    category: "speaker",
    scanOrder: 4,
  },
  {
    token: "UDAYA",
    name: "Mr. Sarat Raja Uday Boddeda on 23rd Feb 2026 from 2.30 PM to 3.30 PM",
    description: "Speaker Event - Mr. Sarat Raja Uday Boddeda",
    venue: "VIT-AP Campus",
    date: "2026-02-23T14:30:00+05:30",
    category: "speaker",
    scanOrder: 5,
  },
  {
    token: "TSHIRT",
    name: "VITopia 2026 T-Shirt Distribution",
    description: "T-Shirt Distribution Counter",
    venue: "VIT-AP Campus",
    date: "2026-02-24T09:00:00+05:30",
    category: "distribution",
    scanOrder: 6,
  },
];

const PRIMARY_TOKEN_PRIORITY = ["PRANAV", "UDAYA", "DAY_1", "DAY_2", "DAY_3", "TSHIRT"];

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((entry) => entry.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((entry) => entry.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function toCsvRows(csvPath: string): CsvRow[] {
  const raw = fs.readFileSync(csvPath, "utf8");
  const [headerRow, ...dataRows] = parseCsv(raw);
  const index = new Map(headerRow.map((key, idx) => [key.trim(), idx]));

  const required = [
    "receipt_id",
    "product_meta",
    "email",
    "order_id",
    "invoice_number",
    "event_id",
    "registration_id",
    "field_values",
    "total",
    "name",
  ];

  for (const key of required) {
    if (!index.has(key)) {
      throw new Error(`Missing expected CSV header: ${key}`);
    }
  }

  return dataRows
    .filter((row) => row.length >= headerRow.length)
    .map((row) => ({
      receipt_id: row[index.get("receipt_id") ?? -1] ?? "",
      product_meta: row[index.get("product_meta") ?? -1] ?? "",
      email: row[index.get("email") ?? -1] ?? "",
      order_id: row[index.get("order_id") ?? -1] ?? "",
      invoice_number: row[index.get("invoice_number") ?? -1] ?? "",
      event_id: row[index.get("event_id") ?? -1] ?? "",
      registration_id: row[index.get("registration_id") ?? -1] ?? "",
      field_values: row[index.get("field_values") ?? -1] ?? "[]",
      total: row[index.get("total") ?? -1] ?? "0",
      name: row[index.get("name") ?? -1] ?? "",
    }));
}

function parseFieldValues(rawFieldValues: string): Array<{ field_name?: string; field_value?: string }> {
  if (!rawFieldValues || rawFieldValues.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(rawFieldValues);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeTshirtValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NA") return null;
  return trimmed;
}

function extractTshirtDetails(productMeta: string, fields: Array<{ field_name?: string; field_value?: string }>): TshirtDetails {
  const sizeField = fields.find((field) => (field.field_name ?? "").toLowerCase().includes("t-shirt size"));
  const colorField = fields.find((field) => (field.field_name ?? "").toLowerCase().includes("t-shirt color"));

  const size = sanitizeTshirtValue(sizeField?.field_value);
  const color = sanitizeTshirtValue(colorField?.field_value);
  const mentionsTshirt = /t-shirt/i.test(productMeta);
  const eligible = mentionsTshirt || !!size || !!color;

  return { eligible, size, color };
}

function extractAccessTokens(productMeta: string, tshirt: TshirtDetails): string[] {
  const normalized = productMeta.toLowerCase();
  const tokens = new Set<string>();

  if (/mr\.\s*pranav\s+sharma/i.test(productMeta)) tokens.add("PRANAV");
  if (/sarat\s+raja\s+uday\s+boddeda/i.test(productMeta) || /mr\.\s*sarat\s+raja\s+uday/i.test(productMeta)) {
    tokens.add("UDAYA");
  }

  if (/(^|\W)day-1(\W|$)/i.test(normalized)) tokens.add("DAY_1");
  if (/(^|\W)day-2(\W|$)/i.test(normalized)) tokens.add("DAY_2");
  if (/(^|\W)day-3(\W|$)/i.test(normalized)) tokens.add("DAY_3");

  if (tshirt.eligible) tokens.add("TSHIRT");

  return Array.from(tokens);
}

function pickPrimaryToken(tokens: string[]): string {
  for (const token of PRIMARY_TOKEN_PRIORITY) {
    if (tokens.includes(token)) return token;
  }
  return "DAY_1";
}

function parseTotalAmount(total: string): number {
  const amount = Number.parseFloat(total);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

async function main() {
  const csvPath = process.argv[2] || process.env.VTOPIA_CSV_PATH || DEFAULT_CSV_PATH;
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const rows = toCsvRows(csvPath);
  if (rows.length === 0) {
    throw new Error("CSV has no data rows");
  }

  const db = prisma as unknown as PrismaClient;
  const now = BigInt(Date.now());

  console.log("=== Step 1: Clearing existing data ===");
  await db.scanLog.deleteMany({});
  await db.order.deleteMany({});
  await db.gate.deleteMany({});
  await db.event.deleteMany({});
  await db.user.deleteMany({});

  console.log("=== Step 2: Seeding users and events ===");
  const admin = await db.user.create({
    data: {
      name: "Admin User",
      email: "admin@vitapstudent.ac.in",
      college: "VIT-AP",
      createdAt: now,
    },
  });

  const scanner = await db.user.create({
    data: {
      name: "Scanner Volunteer",
      email: "scanner@vitapstudent.ac.in",
      college: "VIT-AP",
      createdAt: now,
    },
  });

  const eventByToken = new Map<string, { id: string; name: string; accessToken: string | null }>();
  for (const definition of EVENT_SEEDS) {
    const created = await db.event.create({
      data: {
        name: definition.name,
        description: definition.description,
        date: BigInt(new Date(definition.date).getTime()),
        venue: definition.venue,
        capacity: 10000,
        price: 0,
        isActive: true,
        accessToken: definition.token,
        category: definition.category,
        scanOrder: definition.scanOrder,
        createdAt: now,
      },
    });

    eventByToken.set(definition.token, {
      id: created.id,
      name: created.name,
      accessToken: created.accessToken,
    });

    await db.gate.create({
      data: {
        name: `${definition.name} Gate`,
        eventId: created.id,
        gateId: `gate-${definition.token.toLowerCase()}`,
        isActive: true,
        createdAt: now,
      },
    });
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
    console.log("Seeded 40 scanner accounts.");
  }

  console.log("=== Step 3: Importing CSV registrations ===");
  const usersByEmail = new Map<string, { id: string }>();
  let imported = 0;

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || !row.order_id.trim()) {
      continue;
    }

    let user = usersByEmail.get(email);
    if (!user) {
      const createdUser = await db.user.create({
        data: {
          email,
          name: row.name.trim() || email,
          college: "VIT-AP",
          createdAt: now,
        },
      });
      user = { id: createdUser.id };
      usersByEmail.set(email, user);
    }

    const fieldValues = parseFieldValues(row.field_values);
    const tshirt = extractTshirtDetails(row.product_meta, fieldValues);
    const accessTokens = extractAccessTokens(row.product_meta, tshirt);
    const primaryToken = pickPrimaryToken(accessTokens);
    const primaryEvent = eventByToken.get(primaryToken) ?? eventByToken.get("DAY_1");

    if (!primaryEvent) {
      throw new Error("Primary event resolution failed");
    }

    const sourceEventCode = Number.parseInt(row.event_id, 10);

    const orderPayload = {
      receiptId: row.receipt_id.trim() || null,
      productMeta: row.product_meta.trim() || null,
      invoiceNumber: row.invoice_number.trim() || null,
      sourceEventCode: Number.isNaN(sourceEventCode) ? null : sourceEventCode,
      registrationId: row.registration_id.trim() || null,
      fieldValues,
      accessTokens,
      tshirtEligible: tshirt.eligible,
      tshirtSize: tshirt.size,
      tshirtColor: tshirt.color,
      userId: user.id,
      eventId: primaryEvent.id,
      quantity: 1,
      totalAmount: parseTotalAmount(row.total),
      paymentStatus: "paid" as const,
      checkedIn: false,
      updatedAt: now,
    };

    await db.order.upsert({
      where: { orderId: row.order_id.trim() },
      update: orderPayload,
      create: {
        orderId: row.order_id.trim(),
        qrToken: require("crypto").createHmac("sha256", process.env.JWT_SECRET || "Salt123").update(row.order_id.trim()).digest("hex").toUpperCase().substring(0, 16),
        createdAt: now,
        ...orderPayload,
      },
    });

    imported += 1;
  }

  console.log(`Imported ${imported} registrations from ${csvPath}`);
  console.log(`Admin user: ${admin.email}`);
  console.log(`Scanner user: ${scanner.email}`);

  console.log("=== Step 4: Generating QR images ===");
  if (fs.existsSync(QR_DIR)) {
    fs.rmSync(QR_DIR, { recursive: true });
  }
  fs.mkdirSync(path.join(QR_DIR, "unscanned"), { recursive: true });

  const orders = await db.order.findMany({
    select: { orderId: true },
  });

  let generated = 0;
  for (const order of orders) {
    const token = generateQRCode({ orderId: order.orderId });
    // verify token is 32 chars
    if (token.length !== 16) {
      continue;
    }

    const filePath = path.join(QR_DIR, "unscanned", `${order.orderId}.png`);
    await QRCode.toFile(filePath, token, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 400,
      color: { dark: "#000000", light: "#ffffff" },
    });
    generated += 1;
  }

  console.log(`Generated ${generated} QR files in ${QR_DIR}/unscanned/`);
  console.log("=== Done ===");
}

main()
  .catch((error) => {
    console.error("Seed/import failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
