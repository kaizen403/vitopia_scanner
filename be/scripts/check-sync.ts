import 'dotenv/config';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const syncOrders = await (prisma as any).order.findMany({
    where: { registrationId: { not: null } },
    take: 10
  });
  console.log("Newly Synced Orders from PRAANA:");
  syncOrders.forEach((o: any) => {
    console.log(`- Reg ID: ${o.registrationId} | Total: ${o.totalAmount} | Receipt: ${o.receiptId} | Invoice: ${o.invoiceNumber}`);
  });
}

main().catch(console.error).finally(() => (prisma as any).$disconnect());
