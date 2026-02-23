import cron from 'node-cron';
import axios from 'axios';
import crypto from 'crypto';
import { prisma as basePrisma } from '../db/prisma.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const prisma = basePrisma as unknown as PrismaClient;

function generateQrToken(orderId: string): string {
  const secret = process.env.JWT_SECRET || "Salt123";
  return crypto.createHmac("sha256", secret).update(orderId).digest("hex").toUpperCase().substring(0, 16);
}

// A flag to prevent the cron job from overlapping with itself
let isSyncRunning = false;

type VtopiaRegistration = {
  registration_id: string | number | null;
  email?: string | null;
  name?: string | null;
  payment_date?: string | null;
  total?: string | number | null;
  order_id?: string | null;
  receipt_id?: string | null;
  invoice_number?: string | null;
  product_meta?: string | null;
  field_values?: unknown;
  event_id?: string | number | null;
};

export type Day2SyncSummary = {
  totalApiRecords: number;
  totalDay2Records: number;
  newDay2Records: number;
  upserted: number;
  errors: number;
};

export async function syncRegistrations(): Promise<Day2SyncSummary> {
  const summary: Day2SyncSummary = {
    totalApiRecords: 0,
    totalDay2Records: 0,
    newDay2Records: 0,
    upserted: 0,
    errors: 0,
  };

  if (isSyncRunning) {
    console.log('[VTOPIA Sync] Previous sync is still running. Skipping this cycle.');
    return summary;
  }

  isSyncRunning = true;
  console.log(`[VTOPIA Sync] [${new Date().toISOString()}] Starting registration sync...`);

  try {
    // 1. Fetch ALL existing registration IDs from our database into a Set
    // We only select the registrationId column to make this fast and memory-efficient
    const existingOrders = await prisma.order.findMany({
      where: {
        registrationId: { not: null }
      },
      select: {
        registrationId: true
      }
    });
    
    const existingIds = new Set(existingOrders.map(o => o.registrationId));
    console.log(`[VTOPIA Sync] Found ${existingIds.size} existing registrations in local DB.`);

    // 2. Fetch the latest data from VTOPIA API
    const VTOPIA_API_URL = process.env.VTOPIA_API_URL || 'https://events.vitap.ac.in/events/api/vtopia';
    const API_KEY = process.env.VTOPIA_API_KEY || 'YOUR_API_KEY_HERE';

    const response = await axios.get(VTOPIA_API_URL, {
      headers: {
        'X-API-KEY': API_KEY,
      },
      // Timeout after 30 seconds so it doesn't hang forever
      timeout: 30000 
    });

    const allRegistrations = response.data as unknown;
    
    if (!Array.isArray(allRegistrations)) {
      throw new Error("API did not return an array. Check the response format or authentication.");
    }
    summary.totalApiRecords = allRegistrations.length;

    const validRegistrations = (allRegistrations as VtopiaRegistration[]).filter((reg) => {
      if (!reg.registration_id) return false;
      const productMeta = typeof reg.product_meta === 'string' ? reg.product_meta : '';
      return productMeta.includes('Day-2');
    });
    summary.totalDay2Records = validRegistrations.length;

    const newCount = validRegistrations.filter((reg) => !existingIds.has(String(reg.registration_id))).length;
    summary.newDay2Records = newCount;

    console.log(`[VTOPIA Sync] Fetched ${allRegistrations.length} total. ${validRegistrations.length} valid Day-2 entries, ${newCount} new, ${validRegistrations.length - newCount} to re-sync.`);
    console.log(`[VTOPIA Sync] TOTAL DAY-2 ENTRIES IN API: ${validRegistrations.length}`);

    if (validRegistrations.length > 0) {
      console.log(`[VTOPIA Sync] Processing ${validRegistrations.length} registrations...`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const reg of validRegistrations) {
        try {
          // Handle User
          const userEmail = typeof reg.email === 'string' ? reg.email.toLowerCase().trim() : null;
          if (!userEmail) {
            console.warn(`[VTOPIA Sync] Missing email for registration ${reg.registration_id}`);
            errorCount++;
            continue;
          }

          let user = await prisma.user.findFirst({
            where: { email: userEmail }
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: userEmail,
                name: reg.name || 'Unknown',
                createdAt: BigInt(Date.now())
              }
            });
          }

          // Calculate dates and amounts
          const paymentTimestamp = reg.payment_date ? BigInt(new Date(reg.payment_date).getTime()) : BigInt(Date.now());
          const totalAmount = reg.total ? Math.round(parseFloat(String(reg.total))) : 0;

          const targetRegistrationId = String(reg.registration_id);
          const existingOrder = await prisma.order.findFirst({
            where: { registrationId: targetRegistrationId }
          });
          
          const targetOrderId = existingOrder?.orderId || reg.order_id || `VTOPIA-${reg.registration_id}`;

          let event = await prisma.event.findFirst({
            where: { accessToken: "DAY_2" }
          });

          if (!event) {
             throw new Error("DAY_2 event not found");
          }

          const eventIdFromApi = typeof reg.event_id === 'number' ? reg.event_id : parseInt(String(reg.event_id ?? ''), 10);

          await prisma.order.upsert({
            where: { orderId: targetOrderId },
            update: {
              receiptId: reg.receipt_id || null,
              invoiceNumber: reg.invoice_number || null,
              productMeta: reg.product_meta || "Day-2 Pro show",
              accessTokens: ["DAY_2"],
              fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
              totalAmount: totalAmount,
              paymentStatus: 'paid',
              sourceEventCode: eventIdFromApi,
              eventId: event.id,
              userId: user.id,
              qrToken: generateQrToken(targetOrderId),
              updatedAt: BigInt(Date.now())
            },
            create: {
              registrationId: targetRegistrationId,
              orderId: targetOrderId,
              receiptId: reg.receipt_id,
              invoiceNumber: reg.invoice_number,
              productMeta: reg.product_meta || "Day-2 Pro show",
              accessTokens: ["DAY_2"],
              fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
              totalAmount: totalAmount,
              quantity: 1,
              paymentStatus: 'paid',
              sourceEventCode: eventIdFromApi,
              userId: user.id,
              eventId: event.id,
              qrToken: generateQrToken(targetOrderId),
              checkedIn: false,
              createdAt: paymentTimestamp,
              updatedAt: BigInt(Date.now())
            }
          });

          successCount++;
          summary.upserted = successCount;
        } catch (err: any) {
          console.error(`[VTOPIA Sync] Error inserting registration ${reg.registration_id}:`, err.message);
          errorCount++;
          summary.errors = errorCount;
        }
      }
      
      console.log(`[VTOPIA Sync] Successfully synced ${successCount} records. Errors: ${errorCount}`);
    }

  } catch (error: any) {
    console.error(`[VTOPIA Sync] [${new Date().toISOString()}] Error during sync:`, error.message);
  } finally {
    isSyncRunning = false;
    console.log(`[VTOPIA Sync] [${new Date().toISOString()}] Sync finished.`);
  }

  return summary;
}

export function startVtopiaCronJob() {
  cron.schedule('*/2 * * * *', () => {
    syncRegistrations();
  });

  console.log('🚀 VTOPIA Registration sync cron job scheduled (every 2 minutes).');
}
