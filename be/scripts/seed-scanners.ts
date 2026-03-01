import "dotenv/config";
import { prisma } from "../src/db/prisma.ts";

async function seed() {
    // 1. Find the PROSHOW3 event
    const proshow3Event = await (prisma as any).event.findFirst({
        where: { accessToken: "PROSHOW3" }
    });

    if (!proshow3Event) {
        console.error("Error: PROSHOW3 event not found in database. Please run the main seed script first.");
        process.exit(1);
    }

    const eventId = proshow3Event.id;
    const now = BigInt(Date.now());

    console.log(`Seeding scanners for event: ${proshow3Event.name} (${eventId})...`);

    // Seed Male Scanners (20)
    for (let i = 1; i <= 20; i++) {
        const idStr = i.toString().padStart(2, "0");
        const gateId = `M-${idStr}`;
        const name = `Male Scanner ${i}`;
        const secret = `praana-m-${idStr}`;

        await (prisma as any).gate.upsert({
            where: { gateId },
            update: {
                name,
                secret,
                gender: "M",
                isActive: true,
            },
            create: {
                gateId,
                name,
                secret,
                gender: "M",
                isActive: true,
                createdAt: now,
            },
        });
    }

    // Seed Female Scanners (20)
    for (let i = 1; i <= 20; i++) {
        const idStr = i.toString().padStart(2, "0");
        const gateId = `F-${idStr}`;
        const name = `Female Scanner ${i}`;
        const secret = `praana-f-${idStr}`;

        await (prisma as any).gate.upsert({
            where: { gateId },
            update: {
                name,
                secret,
                gender: "F",
                isActive: true,
            },
            create: {
                gateId,
                name,
                secret,
                gender: "F",
                isActive: true,
                createdAt: now,
            },
        });
    }

    console.log("Seeding complete! 40 scanners updated/created.");
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await (prisma as any).$disconnect();
        process.exit(0);
    });
