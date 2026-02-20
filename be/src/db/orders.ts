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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UserResolverClient = Pick<PrismaClient, "user">;
type EventResolverClient = Pick<PrismaClient, "event">;

export interface MappedOrderUser {
  _id: string;
  _creationTime: number;
  id: string;
  convexId: string | null;
  email: string;
  name: string;
  phone: string | null;
  college: string | null;
  createdAt: number;
}

export interface MappedOrderEvent {
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
  category: string;
  scanOrder: number;
  createdAt: number;
}

export interface MappedOrder {
  _id: string;
  _creationTime: number;
  id: string;
  convexId: string | null;
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
  createdAt: number;
  updatedAt: number;
}

export interface MappedOrderWithRelations extends MappedOrder {
  user: MappedOrderUser | null;
  event: MappedOrderEvent | null;
}

function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${random}`.toUpperCase();
}

function mapUser(dbUser: User): MappedOrderUser {
  return {
    _id: dbUser.convexId ?? dbUser.id,
    _creationTime: Number(dbUser.createdAt),
    id: dbUser.id,
    convexId: dbUser.convexId,
    email: dbUser.email,
    name: dbUser.name,
    phone: dbUser.phone,
    college: dbUser.college,
    createdAt: Number(dbUser.createdAt),
  };
}

function mapEvent(dbEvent: Event): MappedOrderEvent {
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

function mapOrder(
  dbOrder: Order,
  mappedUserId?: string,
  mappedEventId?: string
): MappedOrder {
  return {
    _id: dbOrder.convexId ?? dbOrder.id,
    _creationTime: Number(dbOrder.createdAt),
    id: dbOrder.id,
    convexId: dbOrder.convexId,
    orderId: dbOrder.orderId,
    receiptId: dbOrder.receiptId,
    productMeta: dbOrder.productMeta,
    invoiceNumber: dbOrder.invoiceNumber,
    sourceEventCode: dbOrder.sourceEventCode,
    registrationId: dbOrder.registrationId,
    fieldValues: dbOrder.fieldValues,
    accessTokens: dbOrder.accessTokens,
    tshirtEligible: dbOrder.tshirtEligible,
    tshirtSize: dbOrder.tshirtSize,
    tshirtColor: dbOrder.tshirtColor,
    userId: mappedUserId ?? dbOrder.userId,
    eventId: mappedEventId ?? dbOrder.eventId,
    quantity: dbOrder.quantity,
    totalAmount: dbOrder.totalAmount,
    paymentStatus: dbOrder.paymentStatus,
    checkedIn: dbOrder.checkedIn,
    checkedInAt: dbOrder.checkedInAt ? Number(dbOrder.checkedInAt) : null,
    checkedInBy: dbOrder.checkedInBy,
    checkedInGate: dbOrder.checkedInGate,
    createdAt: Number(dbOrder.createdAt),
    updatedAt: Number(dbOrder.updatedAt),
  };
}

async function resolveUser(
  tx: UserResolverClient,
  userId: string
): Promise<User | null> {
  const isUuid = UUID_REGEX.test(userId);

  return tx.user.findFirst({
    where: isUuid ? { OR: [{ id: userId }, { convexId: userId }] } : { convexId: userId },
  });
}

async function resolveEvent(
  tx: EventResolverClient,
  eventId: string
): Promise<Event | null> {
  const isUuid = UUID_REGEX.test(eventId);

  return tx.event.findFirst({
    where: isUuid ? { OR: [{ id: eventId }, { convexId: eventId }] } : { convexId: eventId },
  });
}

export async function create(data: {
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
    const event = await resolveEvent(tx, data.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    await tx.$queryRawUnsafe("SELECT id FROM events WHERE id = $1 FOR UPDATE", event.id);

    if (!event.isActive) {
      throw new Error("Event is not active");
    }

    const user = await resolveUser(tx, data.userId);
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

    const order = await tx.order.create({
      data: {
        orderId: generateOrderId(),
        receiptId: data.receiptId,
        productMeta: data.productMeta,
        invoiceNumber: data.invoiceNumber,
        sourceEventCode: data.sourceEventCode,
        registrationId: data.registrationId,
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
      id: order.convexId ?? order.id,
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

    return order.convexId ?? order.id;
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
    ...mapOrder(
      order,
      mappedUser ? mappedUser._id : undefined,
      mappedEvent ? mappedEvent._id : undefined
    ),
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
