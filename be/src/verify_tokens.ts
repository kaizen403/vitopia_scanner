import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from './db/prisma.js';

async function verify() {
    const secret = process.env.JWT_SECRET || "Salt123";
    const orders = await (prisma as any).order.findMany({ take: 10 });

    for (const order of orders) {
        const expected = crypto
            .createHmac("sha256", secret)
            .update(order.orderId)
            .digest("hex")
            .toUpperCase()
            .substring(0, 16);

        console.log(`Order: ${order.orderId}`);
        console.log(`DB Token: ${order.qrToken}`);
        console.log(`Expected: ${expected}`);
        console.log(`Match: ${order.qrToken === expected}`);
        console.log('---');
    }
}

verify().catch(console.error);
