-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 9999;

-- CreateIndex
CREATE INDEX "InventoryItem_sortOrder_idx" ON "InventoryItem"("sortOrder");
