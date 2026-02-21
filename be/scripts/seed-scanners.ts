import { prisma } from "../src/db/prisma.js";

async function seed() {
    const eventId = "660e8400-e29b-41d4-a716-446655440000"; // Test Event
    const now = BigInt(Date.now());

    console.log("Seeding scanners...");

    // Seed Male Scanners
    for (let i = 1; i <= 20; i++) {
        const gateId = `SCAN-M-${i.toString().padStart(3, "0")}`;
        const name = `Male Scanner ${i}`;
        const secret = `vitopia-m-${i.toString().padStart(3, "0")}`;

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
                eventId,
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
                eventId,
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
    });
