import { PrismaClient } from "../../generated/prisma/client.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaClientLike = {
  $disconnect: () => Promise<void>;
  $connect: () => Promise<void>;
  $queryRawUnsafe: (query: string) => Promise<unknown>;
  $transaction: <T>(
    fn: (tx: PrismaTransactionClientLike) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: string }
  ) => Promise<T>;
};

export type PrismaTransactionClientLike = Omit<
  PrismaClientLike,
  "$connect" | "$disconnect" | "$transaction"
>;

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient__: PrismaClientLike | undefined;
}

const PrismaClientCtor = PrismaClient;

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  return new PrismaClientCtor({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

const getOrCreatePrismaClient = (): PrismaClientLike => {
  if (!globalThis.__prismaClient__) {
    globalThis.__prismaClient__ = createPrismaClient() as unknown as PrismaClientLike;
  }
  return globalThis.__prismaClient__;
};

export const prisma: PrismaClientLike = new Proxy({} as PrismaClientLike, {
  get(_target, prop) {
    const client = getOrCreatePrismaClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export type { PrismaClientLike };
