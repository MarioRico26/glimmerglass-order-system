/*
  Warnings:

  - You are about to drop the column `factoryFinal` on the `Order` table. All the data in the column will be lost.
  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `factoryLocationId` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING_PAYMENT_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "factoryFinal",
DROP COLUMN "status",
ADD COLUMN     "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT_APPROVAL',
ALTER COLUMN "factoryLocationId" SET NOT NULL,
ALTER COLUMN "deliveryAddress" DROP NOT NULL;

-- DropEnum
DROP TYPE "public"."FactoryLocation";

-- CreateTable
CREATE TABLE "public"."FactoryLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FactoryLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_factoryLocationId_fkey" FOREIGN KEY ("factoryLocationId") REFERENCES "public"."FactoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
