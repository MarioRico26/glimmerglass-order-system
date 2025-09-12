/*
  Warnings:

  - You are about to drop the column `color` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Order` table. All the data in the column will be lost.
  - Added the required column `colorId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poolModelId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Made the column `deliveryAddress` on table `Order` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `depth` to the `PoolModel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `length` to the `PoolModel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `PoolModel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Order" DROP COLUMN "color",
DROP COLUMN "model",
DROP COLUMN "type",
ADD COLUMN     "colorId" TEXT NOT NULL,
ADD COLUMN     "poolModelId" TEXT NOT NULL,
ALTER COLUMN "deliveryAddress" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."PoolModel" ADD COLUMN     "depth" TEXT NOT NULL,
ADD COLUMN     "length" TEXT NOT NULL,
ADD COLUMN     "width" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_poolModelId_fkey" FOREIGN KEY ("poolModelId") REFERENCES "public"."PoolModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "public"."PoolColor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
