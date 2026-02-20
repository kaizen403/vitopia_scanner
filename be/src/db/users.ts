import { prisma as basePrisma } from "./prisma.js";
import type { PrismaClient, User } from "../../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;

export interface MappedUser {
  _id: string;
  _creationTime: number;
  email: string;
  name: string;
  phone?: string | null;
  college?: string | null;
  id: string;
  convexId: string | null;
  createdAt: number;
}

function mapUser(dbUser: User): MappedUser {
  return {
    _id: dbUser.convexId ?? dbUser.id,
    _creationTime: Number(dbUser.createdAt),
    email: dbUser.email,
    name: dbUser.name,
    phone: dbUser.phone,
    college: dbUser.college,
    id: dbUser.id,
    convexId: dbUser.convexId,
    createdAt: Number(dbUser.createdAt),
  };
}

export async function createOrGet(data: {
  email: string;
  name: string;
  phone?: string;
  college?: string;
}): Promise<string> {
  if (!data.email || data.email.trim() === "") {
    throw new Error("Email is required");
  }

  const existing = await prisma.user.findFirst({
    where: { email: data.email },
  });

  if (existing) {
    return existing.convexId ?? existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      phone: data.phone,
      college: data.college,
      createdAt: BigInt(Date.now()),
    },
  });

  return user.convexId ?? user.id;
}

export async function getByEmail(email: string): Promise<MappedUser | null> {
  const user = await prisma.user.findFirst({
    where: { email },
  });
  return user ? mapUser(user) : null;
}

export async function getById(id: string): Promise<MappedUser | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const user = await prisma.user.findFirst({
    where: isUuid
      ? { OR: [{ id }, { convexId: id }] }
      : { convexId: id },
  });

  return user ? mapUser(user) : null;
}

export async function getOrders(userId: string): Promise<any[]> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  const user = await prisma.user.findFirst({
    where: isUuid
      ? { OR: [{ id: userId }, { convexId: userId }] }
      : { convexId: userId },
  });

  if (!user) {
    return [];
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => {
    const { event, ...orderData } = order;
    
    const mappedOrder = {
      ...orderData,
      _id: orderData.convexId ?? orderData.id,
      _creationTime: Number(orderData.createdAt),
      createdAt: Number(orderData.createdAt),
      updatedAt: Number(orderData.updatedAt),
      checkedInAt: orderData.checkedInAt ? Number(orderData.checkedInAt) : null,
    };

    const mappedEvent = event ? {
      ...event,
      _id: event.convexId ?? event.id,
      _creationTime: Number(event.createdAt),
      date: Number(event.date),
      createdAt: Number(event.createdAt),
    } : null;

    return {
      ...mappedOrder,
      event: mappedEvent,
    };
  });
}
