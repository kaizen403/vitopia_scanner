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


function parseProductMeta(rawMeta: string | null) {
  if (!rawMeta) return { cleanName: "Unknown", tokens: [] };
  
  const tokens: string[] = [];
  const displayNames: string[] = [];
  const metaLower = rawMeta.toLowerCase();

  // Parsing Special Events
  const isPranav = metaLower.includes('pranav');
  const isUday = metaLower.includes('uday') || metaLower.includes('sarat');

  if (isPranav) {
    tokens.push('PRANAV');
    displayNames.push('Pranav Sharma Show');
  }
  if (isUday) {
    tokens.push('UDAY');
    displayNames.push('Sarat Raja Uday Boddeda Show');
  }

  // Parsing Days
  if (metaLower.includes('day-1') || metaLower.includes('day 1') || metaLower.includes('day1') || metaLower.includes('22nd feb event')) {
    tokens.push('DAY_1');
    displayNames.push('Day 1');
  }
  
  if (metaLower.includes('day-2') || metaLower.includes('day 2') || metaLower.includes('day2') || metaLower.includes('23rd feb event')) {
    tokens.push('DAY_2');
    displayNames.push('Day 2');
  }
  
  if (metaLower.includes('day-3') || metaLower.includes('day 3') || metaLower.includes('day3') || metaLower.includes('valedictory')) {
    tokens.push('DAY_3');
    displayNames.push('Day 3');
  }

  if (metaLower.includes('t-shirt') || metaLower.includes('tshirt')) {
    tokens.push('TSHIRT');
    displayNames.push('T-Shirt');
  }

  // All Prime events 
  if (metaLower.includes('all prime events')) {
    displayNames.push('All Prime Events');
    if (!tokens.includes('DAY_1')) tokens.push('DAY_1');
    if (!tokens.includes('DAY_2')) tokens.push('DAY_2');
    if (!tokens.includes('DAY_3')) tokens.push('DAY_3');
  }

  // Create clean name
  let cleanName = '';
  if (displayNames.length > 0) {
    cleanName = displayNames.join(' + ');
  } else if (rawMeta.includes('Ticket:')) {
    cleanName = rawMeta.split('Ticket:')[1].trim();
  } else {
    cleanName = rawMeta;
  }

  return { cleanName, tokens };
}

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

    const validRegistrations = allRegistrations.filter(
      (reg: any) => !!reg.registration_id
    );
    const newCount = validRegistrations.filter((reg: any) => !existingIds.has(String(reg.registration_id))).length;

    console.log(`[VTOPIA Sync] Fetched ${allRegistrations.length} total. ${validRegistrations.length} valid, ${newCount} new, ${validRegistrations.length - newCount} to re-sync.`);

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
          const totalAmount = reg.total ? Math.round(parseFloat(reg.total)) : 0; 
          
          const parsedMeta = parseProductMeta(reg.product_meta);

          const targetRegistrationId = String(reg.registration_id);
          const existingOrder = await prisma.order.findFirst({
            where: { registrationId: targetRegistrationId }
          });
          
          const targetOrderId = existingOrder?.orderId || reg.order_id || `VTOPIA-${reg.registration_id}`;

          let primaryToken = 'DAY_1';
          if (parsedMeta.tokens.includes('PRANAV')) primaryToken = 'PRANAV';
          else if (parsedMeta.tokens.includes('UDAY')) primaryToken = 'UDAY';
          else if (parsedMeta.tokens.includes('DAY_1')) primaryToken = 'DAY_1';
          else if (parsedMeta.tokens.includes('DAY_2')) primaryToken = 'DAY_2';
          else if (parsedMeta.tokens.includes('DAY_3')) primaryToken = 'DAY_3';
          else if (parsedMeta.tokens.includes('TSHIRT')) primaryToken = 'TSHIRT';

          let event = await prisma.event.findFirst({
            where: { accessToken: primaryToken }
          });

          if (!event) {
             event = await prisma.event.findFirst({ where: { accessToken: "DAY_1" }});
             if (!event) throw new Error("DAY_1 event not found");
          }

          const eventIdFromApi = typeof reg.event_id === 'number' ? reg.event_id : parseInt(reg.event_id, 10);

          await prisma.order.upsert({
            where: { orderId: targetOrderId },
            update: {
              receiptId: reg.receipt_id || null,
              invoiceNumber: reg.invoice_number || null,
              productMeta: parsedMeta.cleanName,
              accessTokens: parsedMeta.tokens,
              fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
              totalAmount: totalAmount,
              paymentStatus: 'paid' as any,
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
              productMeta: parsedMeta.cleanName,
              accessTokens: parsedMeta.tokens,
              fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
              totalAmount: totalAmount,
              quantity: 1,
              paymentStatus: 'paid' as any,
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
