/*
  Warnings:

  - A unique constraint covering the columns `[convex_id]` on the table `gates` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "gates" ADD COLUMN     "convex_id" TEXT,
ADD COLUMN     "gender" TEXT NOT NULL DEFAULT 'M',
ADD COLUMN     "secret" TEXT NOT NULL DEFAULT 'vitopia2026';

-- CreateIndex
CREATE UNIQUE INDEX "gates_convex_id_key" ON "gates"("convex_id");
