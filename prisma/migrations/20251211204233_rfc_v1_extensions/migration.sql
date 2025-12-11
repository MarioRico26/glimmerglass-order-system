-- CreateEnum
CREATE TYPE "OrderDocType" AS ENUM ('PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE', 'BUILD_SHEET', 'POST_PRODUCTION_MEDIA', 'SHIPPING_CHECKLIST', 'PRE_SHIPPING_MEDIA', 'BILL_OF_LADING', 'PROOF_OF_FINAL_PAYMENT', 'PAID_INVOICE');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PRE_SHIPPING';

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_factoryLocationId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productionPriority" INTEGER,
ADD COLUMN     "requestedShipDate" TIMESTAMP(3),
ADD COLUMN     "serialNumber" TEXT,
ALTER COLUMN "factoryLocationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderMedia" ADD COLUMN     "docType" "OrderDocType",
ADD COLUMN     "visibleToDealer" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_factoryLocationId_fkey" FOREIGN KEY ("factoryLocationId") REFERENCES "FactoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
