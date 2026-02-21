import { prisma as basePrisma } from "./prisma.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;

export interface EventAnalytics {
  eventId: string;
  eventName: string;
  sold: number;
  checkedIn: number;
  remaining: number;
  capacity: number;
}

export interface EnrichedScanLog {
  orderId: string;
  scanResult: string;
  scannedBy: string;
  gate: string;
  timestamp: number;
  eventName: string;
  userName: string;
  userEmail: string;
}

export interface DashboardData {
  analytics: {
    totalTicketsSold: number;
    totalCheckedIn: number;
    totalRemaining: number;
    events: EventAnalytics[];
  };
  scanLogs: EnrichedScanLog[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const events = await prisma.event.findMany({
    where: {
      name: {
        notIn: ["Event Registration", "VITopia 2026", "IGNORE_ME_ARCHIVED"]
      },
      isActive: true
    }
  });

  const eventAnalytics = await Promise.all(
    events.map(async (event) => {
      const orderWhere = event.accessToken
        ? {
            accessTokens: { has: event.accessToken },
          }
        : {
            eventId: event.id,
          };

      const [orders, successfulScans] = await Promise.all([
        prisma.order.findMany({ where: orderWhere }),
        prisma.scanLog.findMany({
          where: { eventId: event.id, scanResult: "success" },
          include: { order: true },
        }),
      ]);

      const sold = orders.reduce((sum, order) => sum + order.quantity, 0);
      const checkedInCount = successfulScans.reduce(
        (sum, scan) => sum + (scan.order?.quantity ?? 1),
        0
      );

      return {
        eventId: event.id,
        eventName: event.name,
        sold,
        checkedIn: checkedInCount,
        remaining: sold - checkedInCount,
        capacity: event.capacity,
      };
    })
  );

  const activeEventAnalytics = eventAnalytics.filter(
    (e) => e.sold > 0 || e.checkedIn > 0
  );

  const totalSold = activeEventAnalytics.reduce((s, e) => s + e.sold, 0);
  const totalChecked = activeEventAnalytics.reduce((s, e) => s + e.checkedIn, 0);

  const logs = await prisma.scanLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 500,
    include: {
      event: true,
      order: {
        include: {
          user: true,
        }
      }
    }
  });

  const enrichedLogs = logs.map((log) => ({
    orderId: log.orderId,
    scanResult: log.scanResult,
    scannedBy: log.scannedBy,
    gate: log.gate,
    timestamp: Number(log.timestamp),
    eventName: log.event?.name || "",
    userName: log.order?.user?.name || "",
    userEmail: log.order?.user?.email || "",
  }));

  return {
    analytics: {
      totalTicketsSold: totalSold,
      totalCheckedIn: totalChecked,
      totalRemaining: totalSold - totalChecked,
      events: activeEventAnalytics,
    },
    scanLogs: enrichedLogs,
  };
}
