import crypto from "crypto";
import { prisma as basePrisma } from "../src/db/prisma.js";
import type { PrismaClient } from "../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;

const JWT_SECRET = process.env.JWT_SECRET || "Salt123";
const API_URL = process.env.API_URL || "http://localhost:3001";

function generateQRToken(orderId: string): string {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(orderId)
    .digest("hex")
    .toUpperCase()
    .substring(0, 16);
}

async function testQRValidation() {
  console.log("=== QR Validation Test ===\n");
  console.log(`Testing ${200} records from database...\n`);

  // Get 200 orders from DB
  const orders = await prisma.order.findMany({
    take: 200,
    include: {
      user: true,
      event: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`Retrieved ${orders.length} orders from database\n`);

  let passed = 0;
  let failed = 0;
  let qrMatchPassed = 0;
  let qrMatchFailed = 0;

  const results: Array<{
    orderId: string;
    email: string | null;
    dbQrToken: string | null;
    computedQrToken: string;
    qrMatch: boolean;
    eventName: string | null;
  }> = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    
    // Compute QR token using same algorithm as server
    const computedQrToken = generateQRToken(order.orderId);
    
    // Check if computed QR matches stored QR
    const dbQrToken = order.qrToken;
    const qrMatch = dbQrToken === computedQrToken;
    
    if (qrMatch) {
      qrMatchPassed++;
    } else {
      qrMatchFailed++;
    }

    results.push({
      orderId: order.orderId,
      email: order.user?.email || null,
      dbQrToken,
      computedQrToken,
      qrMatch,
      eventName: order.event?.name || null,
    });

    // Progress every 50 records
    if ((i + 1) % 50 === 0) {
      console.log(`  Processed ${i + 1}/${orders.length} records...`);
    }
  }

  console.log("\n=== QR Token Generation Test Results ===\n");
  console.log(`Total Records Tested: ${orders.length}`);
  console.log(`QR Tokens Match: ${qrMatchPassed} ✅`);
  console.log(`QR Tokens Mismatch: ${qrMatchFailed} ❌`);
  console.log(`Success Rate: ${((qrMatchPassed / orders.length) * 100).toFixed(2)}%`);

  // Show failed cases if any
  if (qrMatchFailed > 0) {
    console.log("\n=== Failed QR Token Matches ===\n");
    const failedCases = results.filter(r => !r.qrMatch);
    failedCases.slice(0, 10).forEach((r, i) => {
      console.log(`${i + 1}. Order: ${r.orderId}`);
      console.log(`   Email: ${r.email}`);
      console.log(`   DB QR: ${r.dbQrToken}`);
      console.log(`   Computed QR: ${r.computedQrToken}`);
      console.log("---");
    });
    if (failedCases.length > 10) {
      console.log(`... and ${failedCases.length - 10} more`);
    }
  }

  // Test API validation for first 50 records
  console.log("\n=== Testing API Validation (First 50 Records) ===\n");
  
  let apiPassed = 0;
  let apiFailed = 0;
  const apiResults: Array<{
    orderId: string;
    email: string | null;
    qrToken: string;
    apiResponse: any;
    success: boolean;
  }> = [];

  // Get a valid gate for testing
  const gate = await prisma.gate.findFirst({
    where: { isActive: true },
  });

  if (!gate) {
    console.log("❌ No active gate found for testing");
    process.exit(1);
  }

  const GATE_SECRET = gate.secret || "v2026";
  console.log(`Using gate: ${gate.gateId} for validation\n`);

  for (let i = 0; i < Math.min(50, orders.length); i++) {
    const order = orders[i];
    const qrToken = order.qrToken || generateQRToken(order.orderId);

    try {
      // Call the validate endpoint (not check-in, just validate)
      const response = await fetch(`${API_URL}/api/scan/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gate-Id": gate.gateId,
          "X-Gate-Secret": GATE_SECRET,
        },
        body: JSON.stringify({
          qrCode: qrToken,
          eventId: order.eventId,
        }),
      });

      const data = await response.json();
      const success = data.success === true && data.code === "VALID";

      if (success) {
        apiPassed++;
      } else {
        apiFailed++;
      }

      apiResults.push({
        orderId: order.orderId,
        email: order.user?.email || null,
        qrToken,
        apiResponse: data,
        success,
      });

      if (!success) {
        console.log(`❌ ${order.orderId} - ${data.code || data.error || "Unknown error"}`);
      }

    } catch (error: any) {
      apiFailed++;
      console.log(`❌ ${order.orderId} - API Error: ${error.message}`);
      apiResults.push({
        orderId: order.orderId,
        email: order.user?.email || null,
        qrToken,
        apiResponse: { error: error.message },
        success: false,
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log("\n=== API Validation Test Results ===\n");
  console.log(`Total API Tests: 50`);
  console.log(`API Validations Passed: ${apiPassed} ✅`);
  console.log(`API Validations Failed: ${apiFailed} ❌`);
  console.log(`Success Rate: ${((apiPassed / 50) * 100).toFixed(2)}%`);

  // Show failed API validations
  if (apiFailed > 0) {
    console.log("\n=== Failed API Validations ===\n");
    const failedApiCases = apiResults.filter(r => !r.success);
    failedApiCases.forEach((r, i) => {
      console.log(`${i + 1}. Order: ${r.orderId}`);
      console.log(`   Email: ${r.email}`);
      console.log(`   QR Token: ${r.qrToken}`);
      console.log(`   Response: ${JSON.stringify(r.apiResponse)}`);
      console.log("---");
    });
  }

  // Sample successful validations
  console.log("\n=== Sample Successful Validations ===\n");
  const successfulCases = apiResults.filter(r => r.success).slice(0, 5);
  successfulCases.forEach((r, i) => {
    console.log(`${i + 1}. Order: ${r.orderId}`);
    console.log(`   Email: ${r.email}`);
    console.log(`   QR Token: ${r.qrToken}`);
    console.log("---");
  });

  console.log("\n=== Overall Test Summary ===\n");
  console.log(`QR Token Generation: ${qrMatchPassed}/${orders.length} passed (${((qrMatchPassed / orders.length) * 100).toFixed(2)}%)`);
  console.log(`API Validation: ${apiPassed}/50 passed (${((apiPassed / 50) * 100).toFixed(2)}%)`);
  
  const overallSuccess = qrMatchFailed === 0 && apiFailed === 0;
  console.log(`\nOverall Result: ${overallSuccess ? "✅ ALL TESTS PASSED" : "⚠️ SOME TESTS FAILED"}`);

  process.exit(overallSuccess ? 0 : 1);
}

testQRValidation().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
