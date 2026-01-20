-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReorderSheet" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryReorderSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReorderLine" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyToOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryReorderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");

-- CreateIndex
CREATE INDEX "InventoryReorderSheet_date_idx" ON "InventoryReorderSheet"("date");

-- CreateIndex
CREATE INDEX "InventoryReorderSheet_locationId_idx" ON "InventoryReorderSheet"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReorderSheet_locationId_date_key" ON "InventoryReorderSheet"("locationId", "date");

-- CreateIndex
CREATE INDEX "InventoryReorderLine_itemId_idx" ON "InventoryReorderLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReorderLine_sheetId_itemId_key" ON "InventoryReorderLine"("sheetId", "itemId");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReorderSheet" ADD CONSTRAINT "InventoryReorderSheet_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReorderLine" ADD CONSTRAINT "InventoryReorderLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "InventoryReorderSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReorderLine" ADD CONSTRAINT "InventoryReorderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
