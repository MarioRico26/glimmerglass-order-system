ALTER TABLE "Order"
ADD COLUMN "allocatedPoolStockId" TEXT;

CREATE INDEX "Order_allocatedPoolStockId_idx"
ON "Order"("allocatedPoolStockId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_allocatedPoolStockId_fkey"
FOREIGN KEY ("allocatedPoolStockId") REFERENCES "PoolStock"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
