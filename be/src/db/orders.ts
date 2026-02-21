import crypto from "crypto";
import { prisma as basePrisma } from "./prisma.js";
import type {
  Event,
  Order,
  PaymentStatus,
  Prisma,
  PrismaClient,
  User,
} from "../../generated/prisma/client.js";

const prisma = basePrisma as unknown as PrismaClient;


export interface MappedOrderUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  college: string | null;
  createdAt: number;
}

export interface MappedOrderEvent {
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

export interface MappedOrder {
  qrToken: string | null;
  id: string;
  orderId: string;
  receiptId: string | null;
  productMeta: string | null;
  invoiceNumber: string | null;
  sourceEventCode: number | null;
  registrationId: string | null;
  fieldValues: unknown;
  accessTokens: string[];
  tshirtEligible: boolean;
  tshirtSize: string | null;
  tshirtColor: string | null;
  userId: string;
  eventId: string;
  quantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  checkedIn: boolean;
  checkedInAt: number | null;
  checkedInBy: string | null;
  checkedInGate: string | null;
  mailed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MappedOrderWithRelations extends MappedOrder {
  user: MappedOrderUser | null;
  event: MappedOrderEvent | null;
}


function generateQrToken(orderId: string): string {
  const secret = process.env.JWT_SECRET || "Salt123";
  return crypto.createHmac("sha256", secret).update(orderId).digest("hex").toUpperCase().substring(0, 16);
}

function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

function mapUser(dbUser: User): MappedOrderUser {
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    phone: dbUser.phone,
    college: dbUser.college,
    createdAt: Number(dbUser.createdAt),
  };
}

function mapEvent(dbEvent: Event): MappedOrderEvent {
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
    scanOrder: dbEvent.scanOrder,
    createdAt: Number(dbEvent.createdAt),
  };
}

function mapOrder(
  dbOrder: Order
): MappedOrder {
  return {
    id: dbOrder.id,
    orderId: dbOrder.orderId,
    qrToken: dbOrder.qrToken,
    receiptId: dbOrder.receiptId,
    productMeta: dbOrder.productMeta,
    invoiceNumber: dbOrder.invoiceNumber,
    sourceEventCode: dbOrder.sourceEventCode,
    registrationId: dbOrder.registrationId ?? null,
    fieldValues: dbOrder.fieldValues,
    accessTokens: dbOrder.accessTokens,
    tshirtEligible: dbOrder.tshirtEligible,
    tshirtSize: dbOrder.tshirtSize,
    tshirtColor: dbOrder.tshirtColor,
    userId: dbOrder.userId,
    eventId: dbOrder.eventId,
    quantity: dbOrder.quantity,
    totalAmount: dbOrder.totalAmount,
    paymentStatus: dbOrder.paymentStatus,
    checkedIn: dbOrder.checkedIn,
    checkedInAt: dbOrder.checkedInAt ? Number(dbOrder.checkedInAt) : null,
    checkedInBy: dbOrder.checkedInBy,
    checkedInGate: dbOrder.checkedInGate,
    mailed: dbOrder.mailed,
    createdAt: Number(dbOrder.createdAt),
    updatedAt: Number(dbOrder.updatedAt),
  };
}


export async function create(data: {
  orderId?: string;
  userId: string;
  eventId: string;
  quantity: number;
  receiptId?: string;
  productMeta?: string;
  invoiceNumber?: string;
  sourceEventCode?: number;
  registrationId?: string;
  fieldValues?: unknown;
  accessTokens?: string[];
  tshirtEligible?: boolean;
  tshirtSize?: string;
  tshirtColor?: string;
}): Promise<{ id: string; orderId: string; totalAmount: number }> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: data.eventId } });
    if (!event) {
      throw new Error("Event not found");
    }

    await tx.$queryRawUnsafe("SELECT id FROM events WHERE id = $1 FOR UPDATE", event.id);

    if (!event.isActive) {
      throw new Error("Event is not active");
    }

    const user = await tx.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      throw new Error("User not found");
    }

    const reserved = await tx.order.aggregate({
      where: {
        eventId: event.id,
        paymentStatus: {
          in: ["pending", "paid"],
        },
      },
      _sum: { quantity: true },
    });

    const reservedQuantity = reserved._sum.quantity ?? 0;
    if (reservedQuantity + data.quantity > event.capacity) {
      throw new Error("Not enough tickets available");
    }

    const now = BigInt(Date.now());
    const fieldValues = data.fieldValues as Prisma.InputJsonValue | undefined;
    const accessTokens =
      data.accessTokens && data.accessTokens.length > 0
        ? Array.from(new Set(data.accessTokens))
        : event.accessToken
        ? [event.accessToken]
        : [];

    const newOrderId = data.orderId || generateOrderId();
    const order = await tx.order.create({
      data: {
        orderId: newOrderId,
        qrToken: generateQrToken(newOrderId),
        receiptId: data.receiptId,
        productMeta: data.productMeta,
        invoiceNumber: data.invoiceNumber,
        sourceEventCode: data.sourceEventCode,
        registrationId: data.registrationId ?? undefined,
        fieldValues,
        accessTokens,
        tshirtEligible: data.tshirtEligible ?? false,
        tshirtSize: data.tshirtSize,
        tshirtColor: data.tshirtColor,
        userId: user.id,
        eventId: event.id,
        quantity: data.quantity,
        totalAmount: event.price * data.quantity,
        paymentStatus: "pending",
        checkedIn: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      id: order.id,
      orderId: order.orderId,
      totalAmount: order.totalAmount,
    };
  });
}

export async function markAsPaid(orderId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { orderId },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    await tx.$queryRawUnsafe("SELECT id FROM orders WHERE id = $1 FOR UPDATE", order.id);

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "paid",
        updatedAt: BigInt(Date.now()),
      },
    });

    return order.id;
  });
}

export async function getByOrderId(
  orderId: string
): Promise<MappedOrderWithRelations | null> {
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

  const mappedUser = order.user ? mapUser(order.user) : null;
  const mappedEvent = order.event ? mapEvent(order.event) : null;

  return {
    ...mapOrder(order),
    user: mappedUser,
    event: mappedEvent,
  };
}

export type OrderPaymentStatus = PaymentStatus;

export const ORDER_PAYMENT_STATUSES: Readonly<OrderPaymentStatus[]> = [
  "pending",
  "paid",
  "failed",
  "refunded",
] as const;


function buildOrderWhereClause(filters: {
  search?: string;
  paymentStatus?: string;
  eventId?: string;
  mailed?: string;
  checkedIn?: string;
  dateFrom?: string;
  dateTo?: string;
}): any {
  const where: any = {};

  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus;
  }

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.mailed === "true") {
    where.mailed = true;
  } else if (filters.mailed === "false") {
    where.mailed = false;
  }

  if (filters.checkedIn === "true") {
    where.checkedIn = true;
  } else if (filters.checkedIn === "false") {
    where.checkedIn = false;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = BigInt(new Date(filters.dateFrom).getTime());
    }
    if (filters.dateTo) {
      // End of the selected day
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = BigInt(endDate.getTime());
    }
  }

  if (filters.search) {
    where.OR = [
      { orderId: { contains: filters.search, mode: 'insensitive' } },
      { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } }
    ];
  }

  return where;
}

export async function listOrders(filters: {
  search?: string;
  paymentStatus?: string;
  eventId?: string;
  mailed?: string;
  checkedIn?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const skip = (page - 1) * limit;

  const where = buildOrderWhereClause(filters);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: true,
        event: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where })
  ]);

  return {
    orders: orders.map(order => {
      const mappedUser = order.user ? mapUser(order.user) : null;
      const mappedEvent = order.event ? mapEvent(order.event) : null;
      return {
        ...mapOrder(order),
        user: mappedUser,
        event: mappedEvent,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

export async function listOrderIds(filters: {
  search?: string;
  paymentStatus?: string;
  eventId?: string;
  mailed?: string;
  checkedIn?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where = buildOrderWhereClause(filters);

  const orders = await prisma.order.findMany({
    where,
    select: { orderId: true },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(o => o.orderId);
}


export async function updateOrder(orderId: string, data: any) {
  const order = await prisma.order.findFirst({ where: { orderId } });
  if (!order) throw new Error("Order not found");

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: data.paymentStatus !== undefined ? data.paymentStatus : order.paymentStatus,
      checkedIn: data.checkedIn !== undefined ? data.checkedIn : order.checkedIn,
      quantity: data.quantity !== undefined ? data.quantity : order.quantity,
      mailed: data.mailed !== undefined ? data.mailed : order.mailed,
      updatedAt: BigInt(Date.now())
    },
    include: { user: true, event: true }
  });

  const mappedUser = updated.user ? mapUser(updated.user) : null;
  const mappedEvent = updated.event ? mapEvent(updated.event) : null;

  return {
    ...mapOrder(updated),
    user: mappedUser,
    event: mappedEvent
  };
}

export async function deleteOrder(orderId: string) {
  const order = await prisma.order.findFirst({ where: { orderId } });
  if (!order) throw new Error("Order not found");

  await prisma.order.delete({
    where: { id: order.id }
  });
  return { success: true };
}

export async function markOrdersMailed(orderIds: string[]) {
  const result = await prisma.order.updateMany({
    where: { orderId: { in: orderIds } },
    data: { mailed: true, updatedAt: BigInt(Date.now()) },
  });
  return { updated: result.count };
}
