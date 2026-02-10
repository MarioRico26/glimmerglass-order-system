-- AlterTable
ALTER TABLE "PoolModel" ADD COLUMN     "defaultFactoryLocationId" TEXT;

-- CreateIndex
CREATE INDEX "PoolModel_defaultFactoryLocationId_idx" ON "PoolModel"("defaultFactoryLocationId");

-- AddForeignKey
ALTER TABLE "PoolModel" ADD CONSTRAINT "PoolModel_defaultFactoryLocationId_fkey" FOREIGN KEY ("defaultFactoryLocationId") REFERENCES "FactoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
