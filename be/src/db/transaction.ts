import type { PrismaTransactionClientLike } from "./prisma.js";
import { prisma } from "./prisma.js";

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: string;
};

export const runInTransaction = async <T>(
  operation: (tx: PrismaTransactionClientLike) => Promise<T>,
  options?: TransactionOptions
): Promise<T> => {
  return prisma.$transaction((tx) => operation(tx), options);
};
