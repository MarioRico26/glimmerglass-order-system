/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Color` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Color" ADD COLUMN     "swatchUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Color_name_key" ON "public"."Color"("name");
