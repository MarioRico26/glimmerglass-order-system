-- Add serial tracking and production date for finished pool stock rows.
ALTER TABLE "PoolStock"
ADD COLUMN "productionDate" TIMESTAMP(3),
ADD COLUMN "serialNumber" TEXT;

CREATE INDEX "PoolStock_serialNumber_idx" ON "PoolStock"("serialNumber");
