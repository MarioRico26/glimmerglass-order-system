ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "scheduledShipDate" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_scheduledShipDate_idx" ON "Order"("scheduledShipDate");
