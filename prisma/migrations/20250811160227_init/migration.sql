/*
  Warnings:

  - You are about to drop the column `address` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `agreementUrl` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `factoryLocationId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `OrderMedia` table. All the data in the column will be lost.
  - You are about to drop the column `depth` on the `PoolModel` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `PoolModel` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `PoolModel` table. All the data in the column will be lost.
  - You are about to drop the `FactoryLocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PoolColor` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fileUrl` to the `OrderMedia` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `OrderMedia` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('update', 'proof', 'photo', 'note');

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_colorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_factoryLocationId_fkey";

-- AlterTable
ALTER TABLE "public"."Dealer" DROP COLUMN "address",
DROP COLUMN "agreementUrl",
DROP COLUMN "city",
DROP COLUMN "password",
DROP COLUMN "phone",
DROP COLUMN "state";

-- AlterTable
ALTER TABLE "public"."Notification" ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "factoryLocationId",
DROP COLUMN "notes",
ALTER COLUMN "paymentProofUrl" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."OrderMedia" DROP COLUMN "url",
ADD COLUMN     "fileUrl" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "public"."MediaType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."PoolModel" DROP COLUMN "depth",
DROP COLUMN "length",
DROP COLUMN "width";

-- DropTable
DROP TABLE "public"."FactoryLocation";

-- DropTable
DROP TABLE "public"."PoolColor";

-- CreateTable
CREATE TABLE "public"."Color" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_dealerId_createdAt_idx" ON "public"."Notification"("dealerId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."Color"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
