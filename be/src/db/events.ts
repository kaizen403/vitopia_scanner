import { prisma as basePrisma } from "./prisma.js";
import type { PrismaClient, Event, EventCategory } from "../../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;

export interface MappedEvent {
  _id: string;
  _creationTime: number;
  id: string;
  convexId: string | null;
  name: string;
  description: string;
  date: number;
  venue: string;
  capacity: number;
  price: number;
  isActive: boolean;
  accessToken: string | null;
  category: EventCategory;
  scanOrder: number;
  createdAt: number;
}

function mapEvent(dbEvent: Event): MappedEvent {
  return {
    _id: dbEvent.convexId ?? dbEvent.id,
    _creationTime: Number(dbEvent.createdAt),
    id: dbEvent.id,
    convexId: dbEvent.convexId,
    name: dbEvent.name,
    description: dbEvent.description,
    date: Number(dbEvent.date),
    venue: dbEvent.venue,
    capacity: dbEvent.capacity,
    price: dbEvent.price,
    isActive: dbEvent.isActive,
    accessToken: dbEvent.accessToken,
    category: dbEvent.category,
    scanOrder: dbEvent.scanOrder,
    createdAt: Number(dbEvent.createdAt),
  };
}

export async function listActive(): Promise<MappedEvent[]> {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: [{ scanOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
  });
  return events.map(mapEvent);
}

export async function getById(eventId: string): Promise<MappedEvent | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
  
  const event = await prisma.event.findFirst({
    where: isUuid
      ? { OR: [{ id: eventId }, { convexId: eventId }] }
      : { convexId: eventId },
  });

  return event ? mapEvent(event) : null;
}

export async function listAll(): Promise<MappedEvent[]> {
  const events = await prisma.event.findMany({
    orderBy: [{ scanOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
  });
  return events.map(mapEvent);
}

export async function create(data: {
  name: string;
  description: string;
  date: number;
  venue: string;
  capacity: number;
  price: number;
  accessToken?: string;
  category?: EventCategory;
  scanOrder?: number;
}): Promise<string> {
  const event = await prisma.event.create({
    data: {
      ...data,
      date: BigInt(data.date),
      isActive: true,
      category: data.category ?? "day",
      scanOrder: data.scanOrder ?? 0,
      createdAt: BigInt(Date.now()),
    },
  });

  return event.convexId ?? event.id;
}

export async function update(
  eventId: string,
  updates: {
    name?: string;
    description?: string;
    date?: number;
    venue?: string;
    capacity?: number;
    price?: number;
    isActive?: boolean;
    accessToken?: string | null;
    category?: EventCategory;
    scanOrder?: number;
  }
): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
  
  const event = await prisma.event.findFirst({
    where: isUuid
      ? { OR: [{ id: eventId }, { convexId: eventId }] }
      : { convexId: eventId },
  });

  if (!event) throw new Error("Event not found");

  const dataToUpdate: any = { ...updates };
  if (updates.date !== undefined) {
    dataToUpdate.date = BigInt(updates.date);
  }

  await prisma.event.update({
    where: { id: event.id },
    data: dataToUpdate,
  });

  return event.convexId ?? event.id;
}

export async function getStats(eventId: string) {
  const event = await getById(eventId);
  if (!event) return null;

  const orderWhere = event.accessToken
    ? {
        paymentStatus: "paid" as const,
        accessTokens: { has: event.accessToken },
      }
    : {
        paymentStatus: "paid" as const,
        eventId: event.id,
      };

  const [orders, successfulScans] = await Promise.all([
    prisma.order.findMany({ where: orderWhere }),
    prisma.scanLog.findMany({
      where: { eventId: event.id, scanResult: "success" },
      include: { order: true },
    }),
  ]);

  const totalTicketsSold = orders.reduce((sum, o) => sum + o.quantity, 0);
  const totalCheckedIn = successfulScans.reduce(
    (sum, scan) => sum + (scan.order?.quantity ?? 1),
    0
  );

  return {
    event,
    totalTicketsSold,
    totalCheckedIn,
    totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
    capacityRemaining: Math.max(0, event.capacity - totalTicketsSold),
  };
}
