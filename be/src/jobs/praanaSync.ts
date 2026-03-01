import cron from 'node-cron';
import axios from 'axios';
import crypto from 'crypto';
import { prisma as basePrisma } from '../db/prisma.js';
import type { PrismaClient } from '../../generated/prisma/client.js';

const prisma = basePrisma as unknown as PrismaClient;

/**
 * Access tokens for system mapping. Should match the `accessToken` in the `Event` table.
 */
type AccessToken = 'PRANAV' | 'UDAYA' | 'PROSHOW3' | 'DAY_1' | 'DAY_2' | 'DAY_3' | 'TSHIRT';

/** 
 * Mapping configuration for keyword-based parsing of registration data.
 */
const SYNC_CONFIG: Record<AccessToken, { terms: string[]; displayName: string }> = {
  PRANAV: { terms: ['pranav'], displayName: 'Pranav Sharma' },
  UDAYA: { terms: ['uday', 'sarat', 'udaya'], displayName: 'Sarat Raja Uday' },
  PROSHOW3: { terms: ['day-3', 'day 3', 'day3'], displayName: 'Day 3 Proshow' },
  DAY_1: { terms: ['day-1', 'day 1', 'day1', '22nd feb'], displayName: 'Day 1' },
  DAY_2: { terms: ['day-2', 'day 2', 'day2', '23rd feb'], displayName: 'Day 2' },
  DAY_3: { terms: ['day-3', 'day 3', 'day3'], displayName: 'Day 3' },
  TSHIRT: { terms: ['t-shirt', 'tshirt'], displayName: 'T-Shirt' },
};

/**
 * Helper to generate a deterministic QR token for a given order ID.
 */
function generateQrToken(orderId: string): string {
  const secret = process.env.JWT_SECRET || "Salt123";
  return crypto.createHmac("sha256", secret).update(orderId).digest("hex").toUpperCase().substring(0, 16);
}

/**
 * Handles the logic for extracting system-ready data from raw API registration objects.
 */
class RegistrationParser {
  private raw: any;
  private metaLower: string;

  constructor(registration: any) {
    this.raw = registration;
    this.metaLower = (registration.product_meta || '').toLowerCase();
  }

  /**
   * Determines which access tokens (privileges) this registration should grant.
   */
  getAccessTokens(): AccessToken[] {
    const tokens = new Set<AccessToken>();

    // 1. Basic keyword matching from SYNC_CONFIG
    for (const [token, config] of Object.entries(SYNC_CONFIG)) {
      if (config.terms.some(term => this.metaLower.includes(term))) {
        tokens.add(token as AccessToken);
      }
    }

    // 2. Event-specific business logic: Event ID 421 (Slot verification)
    const eventId = String(this.raw.event_id);
    if (eventId === '421') {
      const fieldValues = JSON.stringify(this.raw.field_values || '').toLowerCase();
      const hasSlotMatch = ['day 3', 'day3', '1500', '1600'].some(s => fieldValues.includes(s));

      if (hasSlotMatch) {
        tokens.add('PROSHOW3');
      }
    }

    // 3. Special privilege logic: "All Prime Events"
    if (this.metaLower.includes('all prime events')) {
      tokens.add('PRANAV');
      tokens.add('UDAYA');
    }

    return Array.from(tokens);
  }

  /**
   * Generates a readable summary of the products/tickets in this registration.
   */
  getCleanName(tokens: AccessToken[]): string {
    if (tokens.length > 0) {
      const names = tokens.map(t => SYNC_CONFIG[t]?.displayName || t);
      // Unique names only
      return Array.from(new Set(names)).join(' + ');
    }

    const raw = this.raw.product_meta || 'Unknown';
    return raw.includes('Ticket:') ? raw.split('Ticket:')[1].trim() : raw;
  }

  /**
   * Picks the "Main Event" associated with this order based on token priority.
   */
  getPrimaryToken(tokens: AccessToken[]): AccessToken {
    const priority: AccessToken[] = ['PROSHOW3', 'DAY_3', 'DAY_2', 'DAY_1', 'PRANAV', 'UDAYA', 'TSHIRT'];
    for (const p of priority) {
      if (tokens.includes(p)) return p;
    }
    return 'PROSHOW3';
  }
}

let isSyncRunning = false;

/**
 * Main synchronization loop. Fetches data from external API and updates local database.
 */
export async function syncRegistrations() {
  if (isSyncRunning) {
    console.log('[PRAANA Sync] Previous sync is still running. Skipping loop.');
    return;
  }

  isSyncRunning = true;
  const startTime = new Date();
  console.log(`[PRAANA Sync] [${startTime.toISOString()}] Starting registration sync...`);

  try {
    // 1. Initialize API and environment variables
    const PRAANA_API_URL = process.env.PRAANA_API_URL || 'https://events.pims.ac.in/events/api/praana';
    const API_KEY = process.env.PRAANA_API_KEY || 'YOUR_API_KEY_HERE';

    // 2. Fetch data from remote
    const response = await axios.get(PRAANA_API_URL, {
      headers: { 'X-API-KEY': API_KEY },
      timeout: 30000
    });

    const allRegistrations = response.data;
    if (!Array.isArray(allRegistrations)) {
      throw new Error(`Invalid API response. Expected Array, got ${typeof allRegistrations}`);
    }

    const validRegistrations = allRegistrations.filter(r => !!r.registration_id);
    console.log(`[PRAANA Sync] Fetched ${allRegistrations.length} registrations (${validRegistrations.length} valid).`);

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    // 3. Process each registration
    for (const reg of validRegistrations) {
      try {
        const parser = new RegistrationParser(reg);
        const tokens = parser.getAccessTokens();

        // FILTER: Only sync registrations with Day 3 Proshow (current business requirement)
        if (!tokens.includes('PROSHOW3')) {
          skipCount++;
          continue;
        }

        const userEmail = String(reg.email || '').toLowerCase().trim();
        if (!userEmail) {
          console.warn(`[PRAANA Sync] Skipped reg ${reg.registration_id}: Missing email`);
          errorCount++;
          continue;
        }

        // A. Ensure User exists (email is not uniquely constrained)
        let user = await prisma.user.findFirst({ where: { email: userEmail } });
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: reg.name || 'Unknown' }
          });
        } else {
          user = await prisma.user.create({
            data: {
              email: userEmail,
              name: reg.name || 'Unknown',
              createdAt: BigInt(Date.now())
            }
          });
        }

        // B. Ensure associated Event exists
        const primaryToken = parser.getPrimaryToken(tokens);
        let event = await prisma.event.findFirst({ where: { accessToken: primaryToken } });

        // Final fallback if preferred event isn't in DB
        if (!event) {
          event = await prisma.event.findFirst({ where: { accessToken: 'PROSHOW3' } });
        }

        if (!event) {
          throw new Error(`System event matching token '${primaryToken}' or 'PROSHOW3' not found in database.`);
        }

        // C. Upsert the Order
        const registrationId = String(reg.registration_id);
        const orderId = reg.order_id || `PRAANA-REG-${registrationId}`;
        const amount = reg.total ? Math.round(parseFloat(reg.total)) : 0;
        const paymentDate = reg.payment_date ? BigInt(new Date(reg.payment_date).getTime()) : BigInt(Date.now());

        await prisma.order.upsert({
          where: { orderId: orderId },
          update: {
            registrationId: registrationId,
            receiptId: reg.receipt_id || null,
            invoiceNumber: reg.invoice_number || null,
            productMeta: parser.getCleanName(tokens),
            accessTokens: tokens,
            fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
            totalAmount: amount,
            paymentStatus: 'paid',
            sourceEventCode: parseInt(reg.event_id, 10) || 0,
            eventId: event.id,
            userId: user.id,
            qrToken: generateQrToken(orderId),
            updatedAt: BigInt(Date.now())
          },
          create: {
            registrationId: registrationId,
            orderId: orderId,
            receiptId: reg.receipt_id,
            invoiceNumber: reg.invoice_number,
            productMeta: parser.getCleanName(tokens),
            accessTokens: tokens,
            fieldValues: reg.field_values ? JSON.parse(JSON.stringify(reg.field_values)) : null,
            totalAmount: amount,
            quantity: 1,
            paymentStatus: 'paid',
            sourceEventCode: parseInt(reg.event_id, 10) || 0,
            userId: user.id,
            eventId: event.id,
            qrToken: generateQrToken(orderId),
            checkedIn: false,
            createdAt: paymentDate,
            updatedAt: BigInt(Date.now())
          }
        });

        successCount++;
      } catch (err: any) {
        console.error(`[PRAANA Sync] Failed processing registration ${reg.registration_id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`[PRAANA Sync] Complete. Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skipCount}.`);

  } catch (error: any) {
    console.error(`[PRAANA Sync] Fatal error during sync:`, error.message);
  } finally {
    isSyncRunning = false;
    const duration = (new Date().getTime() - startTime.getTime()) / 1000;
    console.log(`[PRAANA Sync] Registration sync finished in ${duration}s.`);
  }
}

/**
 * Initialization function to start the scheduling.
 */
export function startPraanaCronJob() {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    syncRegistrations();
  });
  console.log('🚀 Registration sync cron scheduled (every 2 minutes).');
}
