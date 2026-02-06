-- CreateEnum
CREATE TYPE "PoolStockStatus" AS ENUM ('READY', 'RESERVED', 'IN_PRODUCTION', 'DAMAGED');

-- CreateEnum
CREATE TYPE "PoolStockTxnType" AS ENUM ('ADD', 'RESERVE', 'RELEASE', 'SHIP', 'ADJUST');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "blueprintMarkers" JSONB;

-- AlterTable
ALTER TABLE "PoolModel" ADD COLUMN     "blueprintUrl" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "PoolStock" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "poolModelId" TEXT NOT NULL,
    "colorId" TEXT,
    "colorKey" TEXT NOT NULL DEFAULT 'NONE',
    "status" "PoolStockStatus" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "eta" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolStockTxn" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "type" "PoolStockTxnType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceOrderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolStockTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PoolStock_factoryId_idx" ON "PoolStock"("factoryId");

-- CreateIndex
CREATE INDEX "PoolStock_poolModelId_idx" ON "PoolStock"("poolModelId");

-- CreateIndex
CREATE INDEX "PoolStock_colorId_idx" ON "PoolStock"("colorId");

-- CreateIndex
CREATE INDEX "PoolStock_status_idx" ON "PoolStock"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PoolStock_factoryId_poolModelId_colorKey_status_key" ON "PoolStock"("factoryId", "poolModelId", "colorKey", "status");

-- CreateIndex
CREATE INDEX "PoolStockTxn_createdAt_idx" ON "PoolStockTxn"("createdAt");

-- CreateIndex
CREATE INDEX "PoolStockTxn_stockId_idx" ON "PoolStockTxn"("stockId");

-- CreateIndex
CREATE INDEX "PoolStockTxn_referenceOrderId_idx" ON "PoolStockTxn"("referenceOrderId");

-- CreateIndex
CREATE INDEX "PoolStockTxn_type_idx" ON "PoolStockTxn"("type");

-- AddForeignKey
ALTER TABLE "PoolStock" ADD CONSTRAINT "PoolStock_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "FactoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolStock" ADD CONSTRAINT "PoolStock_poolModelId_fkey" FOREIGN KEY ("poolModelId") REFERENCES "PoolModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolStock" ADD CONSTRAINT "PoolStock_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolStockTxn" ADD CONSTRAINT "PoolStockTxn_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "PoolStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolStockTxn" ADD CONSTRAINT "PoolStockTxn_referenceOrderId_fkey" FOREIGN KEY ("referenceOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
