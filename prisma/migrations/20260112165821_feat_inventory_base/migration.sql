-- CreateEnum
CREATE TYPE "InventoryLocationType" AS ENUM ('WAREHOUSE', 'FACTORY', 'TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryLocationType" NOT NULL DEFAULT 'WAREHOUSE',
    "factoryLocationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTxn" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "InventoryTxnType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "notes" TEXT,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "orderId" TEXT,

    CONSTRAINT "InventoryTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_name_key" ON "InventoryLocation"("name");

-- CreateIndex
CREATE INDEX "InventoryLocation_factoryLocationId_idx" ON "InventoryLocation"("factoryLocationId");

-- CreateIndex
CREATE INDEX "InventoryLocation_type_idx" ON "InventoryLocation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryStock_locationId_idx" ON "InventoryStock"("locationId");

-- CreateIndex
CREATE INDEX "InventoryStock_itemId_idx" ON "InventoryStock"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStock_itemId_locationId_key" ON "InventoryStock"("itemId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryTxn_createdAt_idx" ON "InventoryTxn"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryTxn_itemId_idx" ON "InventoryTxn"("itemId");

-- CreateIndex
CREATE INDEX "InventoryTxn_locationId_idx" ON "InventoryTxn"("locationId");

-- CreateIndex
CREATE INDEX "InventoryTxn_orderId_idx" ON "InventoryTxn"("orderId");

-- CreateIndex
CREATE INDEX "InventoryTxn_actorUserId_idx" ON "InventoryTxn"("actorUserId");

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_factoryLocationId_fkey" FOREIGN KEY ("factoryLocationId") REFERENCES "FactoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTxn" ADD CONSTRAINT "InventoryTxn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTxn" ADD CONSTRAINT "InventoryTxn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTxn" ADD CONSTRAINT "InventoryTxn_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTxn" ADD CONSTRAINT "InventoryTxn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
