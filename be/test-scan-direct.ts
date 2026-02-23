import { prisma as prismaProxy } from './src/db/prisma.js';
import { checkIn } from './src/db/scan.js';

const prisma = prismaProxy as any;

async function main() {
  const gate = await prisma.gate.findFirst();
  if (!gate) throw new Error("No gates found");
  
  const order = await prisma.order.findFirst({
    where: { checkedIn: false, paymentStatus: 'paid' }
  });
  if (!order) throw new Error("No available tickets found");

  console.log("Testing scanning Order ID:", order.orderId, "Event ID:", order.eventId, "at Gate:", gate.gateId);

  const result = await checkIn({
    orderId: order.orderId,
    scannedBy: gate.gateId,
    gate: gate.gateId,
    expectedEventId: order.eventId
  });
  
  console.log("Check-in result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
