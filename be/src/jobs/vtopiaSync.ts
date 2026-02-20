import cron from 'node-cron';
import axios from 'axios';
import { prisma as basePrisma } from '../db/prisma.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const prisma = basePrisma as unknown as PrismaClient;

// A flag to prevent the cron job from overlapping with itself
let isSyncRunning = false;

export async function syncRegistrations() {
  if (isSyncRunning) {
    console.log('[VTOPIA Sync] Previous sync is still running. Skipping this cycle.');
    return;
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

    const allRegistrations = response.data;
    
    if (!Array.isArray(allRegistrations)) {
      throw new Error("API did not return an array. Check the response format or authentication.");
    }

    // 3. Filter for NEW registrations only
    const newRegistrations = allRegistrations.filter(
      (reg: any) => reg.registration_id && !existingIds.has(parseInt(reg.registration_id, 10))
    );

    console.log(`[VTOPIA Sync] Fetched ${allRegistrations.length} total. Found ${newRegistrations.length} new records.`);

    // 4. Upsert the new registrations
    if (newRegistrations.length > 0) {
      console.log(`[VTOPIA Sync] Processing ${newRegistrations.length} new registrations...`);
      
      let successCount = 0;
      let errorCount = 0;

      for (const reg of newRegistrations) {
        try {
          // Find Event by sourceEventCode (VTOPIA event_id)
          const eventIdFromApi = typeof reg.event_id === 'number' ? reg.event_id : parseInt(reg.event_id, 10);
          if (isNaN(eventIdFromApi)) {
            console.warn(`[VTOPIA Sync] Invalid event_id for registration ${reg.registration_id}`);
            errorCount++;
            continue;
          }

          let event = await prisma.event.findUnique({
            where: { sourceEventCode: eventIdFromApi }
          });

          // Create event if missing based on product name
          if (!event) {
             event = await prisma.event.create({
                data: {
                   name: reg.product || `VTOPIA Event ${eventIdFromApi}`,
                   description: "Imported from VTOPIA API",
                   date: BigInt(Date.now()), // Or parsed from event_date
                   venue: "TBD",
                   capacity: 10000,
                   price: 0,
                   isActive: true,
                   category: 'day',
                   sourceEventCode: eventIdFromApi,
                   createdAt: BigInt(Date.now())
                }
             })
             console.log(`[VTOPIA Sync] Created missing event: ${reg.product}`);
          }

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
          const totalAmount = reg.total ? Math.round(parseFloat(reg.total)) : 0; 
          
          await prisma.order.upsert({
            where: { orderId: reg.order_id || `VTOPIA-${reg.registration_id}` },
            update: {},
            create: {
              registrationId: parseInt(reg.registration_id, 10),
              orderId: reg.order_id || `VTOPIA-${reg.registration_id}`,
              receiptId: reg.receipt_id,
              invoiceNumber: reg.invoice_number,
              productMeta: reg.product_meta,
              fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
              totalAmount: totalAmount,
              quantity: 1,
              paymentStatus: 'paid' as any,
              sourceEventCode: eventIdFromApi,
              userId: user.id,
              eventId: event.id,
              checkedIn: false,
              createdAt: paymentTimestamp,
              updatedAt: BigInt(Date.now())
            }
          });

          successCount++;
        } catch (err: any) {
          console.error(`[VTOPIA Sync] Error inserting registration ${reg.registration_id}:`, err.message);
          errorCount++;
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
}

export function startVtopiaCronJob() {
  cron.schedule('*/2 * * * *', () => {
    syncRegistrations();
  });

  console.log('🚀 VTOPIA Registration sync cron job scheduled (every 2 minutes).');
}
