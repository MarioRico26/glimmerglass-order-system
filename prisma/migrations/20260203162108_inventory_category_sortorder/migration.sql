-- AlterTable
ALTER TABLE "InventoryCategory" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 9999;

-- CreateIndex
CREATE INDEX "InventoryCategory_sortOrder_idx" ON "InventoryCategory"("sortOrder");
