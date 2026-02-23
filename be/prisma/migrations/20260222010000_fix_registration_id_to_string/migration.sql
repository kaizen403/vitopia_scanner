-- Fix: registration_id was incorrectly changed back to INTEGER by remove_convex_ids migration.
-- The Prisma schema declares it as String?, so convert it back to TEXT.
DROP INDEX IF EXISTS "orders_registration_id_idx";
ALTER TABLE "orders" ALTER COLUMN "registration_id" TYPE TEXT USING ("registration_id"::TEXT);
CREATE INDEX "orders_registration_id_idx" ON "orders"("registration_id");
