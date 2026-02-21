import { prisma as basePrisma } from "./prisma.js";
import type {
  Event,
  Prisma,
  PrismaClient,
  ScanResult as PrismaScanResult,
} from "../../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { user: true; event: true };
}>;

export type ScanResultTaxonomy = PrismaScanResult;

export const SCAN_RESULT_TAXONOMY: Readonly<ScanResultTaxonomy[]> = [
  "success",
  "already_used",
  "invalid",
  "not_found",
  "wrong_event",
  "not_paid",
] as const;

export interface ScanTshirtContext {
  eligible: boolean;
  size: string | null;
  color: string | null;
}

export interface ScanOrderContext {
  orderId: string;
  quantity: number;
  receiptId: string | null;
  invoiceNumber: string | null;
  registrationId: string | null;
  productMeta: string | null;
  accessTokens: string[];
  tshirt: ScanTshirtContext;
}

export interface ScanUserContext {
  name: string;
  email: string;
}

export interface ScanEventContext {
  name: string;
  venue: string;
  accessToken: string | null;
  category: string;
}

type ScanFailureReason = "already_used" | "not_paid" | "not_found" | "wrong_event";

export interface CheckInSuccess {
  success: true;
  reason: "success";
  eventId: string;
  order: ScanOrderContext;
  user: ScanUserContext | null;
  event: ScanEventContext | null;
}

export interface CheckInFailure {
  success: false;
  reason: ScanFailureReason;
  eventId?: string;
  checkedInAt?: number | null;
  checkedInBy?: string | null;
  checkedInByName?: string | null;
  order?: ScanOrderContext;
  user?: ScanUserContext | null;
  event?: ScanEventContext | null;
}

export type CheckInResult = CheckInSuccess | CheckInFailure;

export interface ValidateSuccess {
  valid: true;
  reason: "valid";
  order: {
    orderId: string;
    quantity: number;
    eventId: string;
    accessTokens: string[];
    tshirt: ScanTshirtContext;
  };
  user: { name: string; email?: string } | null;
  event: { name: string; venue?: string } | null;
}

export interface ValidateFailure {
  valid: false;
  reason: "already_used" | "not_paid" | "not_found" | "wrong_event";
  checkedInAt?: number | null;
  checkedInBy?: string | null;
  checkedInByName?: string | null;
}

export type ValidateResult = ValidateSuccess | ValidateFailure;

export interface LogScanInput {
  orderId: string;
  eventId: string;
  scanResult: ScanResultTaxonomy;
  scannedBy: string;
  gate: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: number;
}

export interface LogScanResult {
  persisted: boolean;
}

export interface PurchasedEventSummary {
  id: string;
  name: string;
  accessToken: string | null;
  category: string;
}

export interface ScanHistoryEntry {
  scanResult: ScanResultTaxonomy;
  scannedBy: string;
  gate: string;
  timestamp: number;
  event: PurchasedEventSummary | null;
}

export interface ScanHistoryResult {
  orderId: string;
  user: ScanUserContext | null;
  purchasedEvents: PurchasedEventSummary[];
  lastScannedAt: number | null;
  scanHistory: ScanHistoryEntry[];
}

export interface MappedScanStatsEvent {
  id: string;
  name: string;
  description: string;
  date: number;
  venue: string;
  capacity: number;
  price: number;
  isActive: boolean;
  accessToken: string | null;
  category: string;
  scanOrder: number;
  createdAt: number;
}

export interface ScanStats {
  event: MappedScanStatsEvent;
  totalTicketsSold: number;
  totalCheckedIn: number;
  totalRevenue: number;
  capacityRemaining: number;
}

function mapEvent(event: Event): MappedScanStatsEvent {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    date: Number(event.date),
    venue: event.venue,
    capacity: event.capacity,
    price: event.price,
    isActive: event.isActive,
    accessToken: event.accessToken,
    category: event.category,
    scanOrder: event.scanOrder,
    createdAt: Number(event.createdAt),
  };
}

function mapEventContext(event: Event | null): ScanEventContext | null {
  if (!event) return null;

  return {
    name: event.name,
    venue: event.venue,
    accessToken: event.accessToken,
    category: event.category,
  };
}

function mapOrderContext(order: OrderWithRelations): ScanOrderContext {
  return {
    orderId: order.orderId,
    quantity: order.quantity,
    receiptId: order.receiptId,
    invoiceNumber: order.invoiceNumber,
    registrationId: order.registrationId ?? null,
    productMeta: order.productMeta,
    accessTokens: order.accessTokens,
    tshirt: {
      eligible: order.tshirtEligible,
      size: order.tshirtSize,
      color: order.tshirtColor,
    },
  };
}

function mapCheckInContext(
  order: OrderWithRelations,
  scannedEvent: Event | null
): {
  eventId: string;
  order: ScanOrderContext;
  user: ScanUserContext | null;
  event: ScanEventContext | null;
} {
  const fallbackEvent = order.event;
  // If entry is denied or even if it passes, we want to show what the user ACTUALLY bought (fallbackEvent)
  // rather than the gate they are currently trying to enter (scannedEvent).
  const effectiveEvent = fallbackEvent;

  return {
    eventId: effectiveEvent.id,
    order: mapOrderContext(order),
    user: order.user
      ? {
        name: order.user.name,
        email: order.user.email,
      }
      : null,
    event: mapEventContext(effectiveEvent),
  };
}

function hasEventAccess(order: OrderWithRelations, event: Event): boolean {
  if (event.accessToken) {
    return order.accessTokens.includes(event.accessToken);
  }

  return event.id === order.event.id;
}

async function resolveEventById(
  tx: Pick<PrismaClient, "event">,
  eventId: string
): Promise<Event | null> {
  return tx.event.findUnique({ where: { id: eventId } });
}

export async function checkIn(input: {
  orderId: string;
  scannedBy: string;
  gate: string;
  expectedEventId?: string;
}): Promise<CheckInResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { orderId: input.orderId },
      include: {
        user: true,
        event: true,
      },
    });

    if (!order) {
      return { success: false, reason: "not_found", eventId: undefined };
    }

    const expectedEvent = input.expectedEventId
      ? await resolveEventById(tx, input.expectedEventId)
      : null;

    if (input.expectedEventId && !expectedEvent) {
      return {
        success: false,
        reason: "wrong_event",
      };
    }

    const context = mapCheckInContext(order, expectedEvent);

    if (expectedEvent && !hasEventAccess(order, expectedEvent)) {
      return {
        success: false,
        reason: "wrong_event",
        ...context,
      };
    }

    if (expectedEvent) {
      const existingSuccess = await tx.scanLog.findFirst({
        where: {
          orderId: order.orderId,
          eventId: expectedEvent.id,
          scanResult: "success",
        },
        orderBy: { timestamp: "desc" },
      });

      if (existingSuccess) {
        const scannerGate = await tx.gate.findUnique({
          where: { gateId: existingSuccess.scannedBy },
          select: { name: true },
        });

        return {
          success: false,
          reason: "already_used",
          checkedInAt: Number(existingSuccess.timestamp),
          checkedInBy: existingSuccess.scannedBy,
          checkedInByName: scannerGate?.name || existingSuccess.scannedBy,
          ...context,
        };
      }
    } else if (order.checkedIn) {
      const scannerGate = order.checkedInBy
        ? await tx.gate.findUnique({
          where: { gateId: order.checkedInBy },
          select: { name: true },
        })
        : null;

      return {
        success: false,
        reason: "already_used",
        checkedInAt: order.checkedInAt ? Number(order.checkedInAt) : null,
        checkedInBy: order.checkedInBy,
        checkedInByName: scannerGate?.name || order.checkedInBy,
        ...context,
      };
    }

    const now = BigInt(Date.now());
    if (!order.checkedIn) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          checkedIn: true,
          checkedInAt: now,
          checkedInBy: input.scannedBy,
          checkedInGate: input.gate,
          updatedAt: now,
        },
      });
    } else {
      await tx.order.update({
        where: { id: order.id },
        data: { updatedAt: now },
      });
    }

    return {
      success: true,
      reason: "success",
      ...context,
    };
  });
}

export async function validate(
  orderId: string,
  expectedEventId?: string
): Promise<ValidateResult> {
  const order = await prisma.order.findFirst({
    where: { orderId },
    include: {
      user: true,
      event: true,
    },
  });

  if (!order) {
    return { valid: false, reason: "not_found" };
  }

  const expectedEvent = expectedEventId
    ? await resolveEventById(prisma, expectedEventId)
    : null;

  if (expectedEventId && !expectedEvent) {
    return { valid: false, reason: "wrong_event" };
  }

  if (expectedEvent && !hasEventAccess(order, expectedEvent)) {
    return { valid: false, reason: "wrong_event" };
  }

  if (expectedEvent) {
    const existingSuccess = await prisma.scanLog.findFirst({
      where: {
        orderId: order.orderId,
        eventId: expectedEvent.id,
        scanResult: "success",
      },
      orderBy: { timestamp: "desc" },
    });

    if (existingSuccess) {
      const scannerGate = await prisma.gate.findUnique({
        where: { gateId: existingSuccess.scannedBy },
        select: { name: true },
      });

      return {
        valid: false,
        reason: "already_used",
        checkedInAt: Number(existingSuccess.timestamp),
        checkedInBy: existingSuccess.scannedBy,
        checkedInByName: scannerGate?.name || existingSuccess.scannedBy,
      };
    }
  } else if (order.checkedIn) {
    const scannerGate = order.checkedInBy
      ? await prisma.gate.findUnique({
        where: { gateId: order.checkedInBy },
        select: { name: true },
      })
      : null;

    return {
      valid: false,
      reason: "already_used",
      checkedInAt: order.checkedInAt ? Number(order.checkedInAt) : null,
      checkedInBy: order.checkedInBy,
      checkedInByName: scannerGate?.name || order.checkedInBy,
    };
  }

  const resolvedEvent = expectedEvent ?? order.event;

  return {
    valid: true,
    reason: "valid",
    order: {
      orderId: order.orderId,
      quantity: order.quantity,
      eventId: resolvedEvent.id,
      accessTokens: order.accessTokens,
      tshirt: {
        eligible: order.tshirtEligible,
        size: order.tshirtSize,
        color: order.tshirtColor,
      },
    },
    user: order.user
      ? {
        name: order.user.name,
        email: order.user.email,
      }
      : null,
    event: resolvedEvent
      ? {
        name: resolvedEvent.name,
        venue: resolvedEvent.venue,
      }
      : null,
  };
}

export async function logScan(input: LogScanInput): Promise<LogScanResult> {
  const event = await resolveEventById(prisma, input.eventId);
  if (!event) {
    throw new Error("Event not found");
  }

  const order = await prisma.order.findFirst({
    where: { orderId: input.orderId },
    select: { orderId: true },
  });

  if (!order) {
    if (input.scanResult === "not_found") {
      return { persisted: false };
    }
    throw new Error("Order not found");
  }

  await prisma.scanLog.create({
    data: {
      orderId: input.orderId,
      eventId: event.id,
      scanResult: input.scanResult,
      scannedBy: input.scannedBy,
      gate: input.gate,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      timestamp: BigInt(input.timestamp ?? Date.now()),
    },
  });

  return { persisted: true };
}

export async function getScanHistoryByOrderId(
  orderId: string
): Promise<ScanHistoryResult | null> {
  const order = await prisma.order.findFirst({
    where: { orderId },
    include: {
      user: true,
      event: true,
    },
  });

  if (!order) {
    return null;
  }

  const accessTokens = Array.from(new Set(order.accessTokens.filter(Boolean)));
  const purchasedEventWhere: Prisma.EventWhereInput[] = [{ id: order.eventId }];

  if (accessTokens.length > 0) {
    purchasedEventWhere.push({ accessToken: { in: accessTokens } });
  }

  const [purchasedEventsRaw, logs] = await Promise.all([
    prisma.event.findMany({ where: { OR: purchasedEventWhere } }),
    prisma.scanLog.findMany({
      where: { orderId },
      orderBy: { timestamp: "desc" },
      include: { event: true },
    }),
  ]);

  const purchasedEventsById = new Map<string, PurchasedEventSummary>();
  for (const event of purchasedEventsRaw) {
    purchasedEventsById.set(event.id, {
      id: event.id,
      name: event.name,
      accessToken: event.accessToken,
      category: event.category,
    });
  }

  const purchasedEvents = Array.from(purchasedEventsById.values()).sort((a, b) => {
    const eventA = purchasedEventsRaw.find((event) => event.id === a.id);
    const eventB = purchasedEventsRaw.find((event) => event.id === b.id);

    const rankA = eventA?.scanOrder ?? Number.MAX_SAFE_INTEGER;
    const rankB = eventB?.scanOrder ?? Number.MAX_SAFE_INTEGER;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if ((eventA?.date ?? 0) !== (eventB?.date ?? 0)) {
      return Number(eventA?.date ?? 0) - Number(eventB?.date ?? 0);
    }

    return a.name.localeCompare(b.name);
  });

  return {
    orderId: order.orderId,
    user: order.user
      ? {
        name: order.user.name,
        email: order.user.email,
      }
      : null,
    purchasedEvents,
    lastScannedAt: logs.length > 0 ? Number(logs[0].timestamp) : null,
    scanHistory: logs.map((log) => ({
      scanResult: log.scanResult,
      scannedBy: log.scannedBy,
      gate: log.gate,
      timestamp: Number(log.timestamp),
      event: log.event
        ? {
            id: log.event.id,
            name: log.event.name,
            accessToken: log.event.accessToken,
            category: log.event.category,
          }
        : null,
    })),
  };
}

export async function getStats(eventId: string): Promise<ScanStats | null> {
  const event = await resolveEventById(prisma, eventId);
  if (!event) {
    return null;
  }

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

  const totalTicketsSold = orders.reduce((sum, order) => sum + order.quantity, 0);
  const totalCheckedIn = successfulScans.reduce(
    (sum, scan) => sum + (scan.order?.quantity ?? 1),
    0
  );

  return {
    event: mapEvent(event),
    totalTicketsSold,
    totalCheckedIn,
    totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
    capacityRemaining: Math.max(0, event.capacity - totalTicketsSold),
  };
}
