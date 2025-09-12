/*
  Warnings:

  - Added the required column `depthFt` to the `PoolModel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lengthFt` to the `PoolModel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `widthFt` to the `PoolModel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Dealer" ADD COLUMN     "address" TEXT,
ADD COLUMN     "agreementUrl" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "public"."PoolModel" ADD COLUMN     "depthFt" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "lengthFt" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "shape" TEXT,
ADD COLUMN     "widthFt" DOUBLE PRECISION NOT NULL;
