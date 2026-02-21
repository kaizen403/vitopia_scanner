import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

async function seed() {
    const eventId = "e1776439-8663-4c9a-9592-f1351eda5c70";
    const now = BigInt(Date.now());
    const commonSecret = "v2026";

    console.log("Seeding scanners...");

    // Seed Male Scanners
    for (let i = 1; i <= 20; i++) {
        const gateId = `M-${i.toString().padStart(2, "0")}`;
        const name = `Male Scanner ${i}`;

        await (prisma as any).gate.upsert({
            where: { gateId },
            update: {
                name,
                secret: commonSecret,
                gender: "M",
                isActive: true,
            },
            create: {
                gateId,
                name,
                secret: commonSecret,
                gender: "M",
                eventId,
                isActive: true,
                createdAt: now,
            },
        });
    }

    // Seed Female Scanners
    for (let i = 1; i <= 20; i++) {
        const gateId = `F-${i.toString().padStart(2, "0")}`;
        const name = `Female Scanner ${i}`;

        await (prisma as any).gate.upsert({
            where: { gateId },
            update: {
                name,
                secret: commonSecret,
                gender: "F",
                isActive: true,
            },
            create: {
                gateId,
                name,
                secret: commonSecret,
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
