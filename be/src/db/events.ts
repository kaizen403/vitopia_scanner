import { prisma as basePrisma } from "./prisma.js";
import type { PrismaClient, Event, EventCategory, EventType, Slot } from "../../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;

export interface MappedSlot {
  id: string;
  eventId: string;
  startTime: number;
  endTime: number;
  capacity: number;
  createdAt: number;
}

export interface MappedEvent {
  id: string;
  name: string;
  description: string;
  date: number;
  venue: string;
  capacity: number;
  price: number;
  isActive: boolean;
  accessToken: string | null;
  category: EventCategory;
  type: EventType;
  scanOrder: number;
  createdAt: number;
  slots?: MappedSlot[];
}

function mapSlot(dbSlot: Slot): MappedSlot {
  return {
    id: dbSlot.id,
    eventId: dbSlot.eventId,
    startTime: Number(dbSlot.startTime),
    endTime: Number(dbSlot.endTime),
    capacity: dbSlot.capacity,
    createdAt: Number(dbSlot.createdAt),
  };
}

function mapEvent(dbEvent: Event & { slots?: Slot[] }): MappedEvent {
  return {
    id: dbEvent.id,
    name: dbEvent.name,
    description: dbEvent.description,
    date: Number(dbEvent.date),
    venue: dbEvent.venue,
    capacity: dbEvent.capacity,
    price: dbEvent.price,
    isActive: dbEvent.isActive,
    accessToken: dbEvent.accessToken,
    category: dbEvent.category,
    type: dbEvent.type,
    scanOrder: dbEvent.scanOrder,
    createdAt: Number(dbEvent.createdAt),
    slots: dbEvent.slots?.map(mapSlot),
  };
}

export async function listActive(type?: EventType): Promise<MappedEvent[]> {
  const events = await prisma.event.findMany({
    where: {
      isActive: true,
      ...(type ? { type } : {})
    },
    include: { slots: true },
    orderBy: [{ scanOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
  });
  return events.map(mapEvent);
}

export async function getById(eventId: string): Promise<MappedEvent | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { slots: true },
  });

  return event ? mapEvent(event) : null;
}

export async function listAll(type?: EventType): Promise<MappedEvent[]> {
  const events = await prisma.event.findMany({
    where: type ? { type } : {},
    include: { slots: true },
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
  type?: EventType;
  scanOrder?: number;
  slots?: Array<{ startTime: number; endTime: number; capacity: number }>;
}): Promise<string> {
  const now = BigInt(Date.now());
  const event = await prisma.event.create({
    data: {
      name: data.name,
      description: data.description,
      date: BigInt(data.date),
      venue: data.venue,
      capacity: data.capacity,
      price: data.price,
      accessToken: data.accessToken,
      isActive: true,
      category: data.category ?? "day",
      type: data.type ?? "EVENT",
      scanOrder: data.scanOrder ?? 0,
      createdAt: now,
      slots: data.slots ? {
        create: data.slots.map(s => ({
          startTime: BigInt(s.startTime),
          endTime: BigInt(s.endTime),
          capacity: s.capacity,
          createdAt: now,
        }))
      } : undefined
    },
  });

  return event.id;
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
    type?: EventType;
    scanOrder?: number;
  }
): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
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

  return event.id;
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
    slotStats: event.slots?.map(slot => {
      const slotOrders = orders.filter(o => o.slotId === slot.id);
      const slotSold = slotOrders.reduce((sum, o) => sum + o.quantity, 0);
      return {
        slotId: slot.id,
        startTime: Number(slot.startTime),
        endTime: Number(slot.endTime),
        sold: slotSold,
        remaining: Math.max(0, slot.capacity - slotSold)
      };
    })
  };
}
