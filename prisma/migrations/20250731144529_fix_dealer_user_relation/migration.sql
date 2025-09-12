/*
  Warnings:

  - You are about to drop the column `approved` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Dealer` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'DEALER');

-- DropIndex
DROP INDEX "public"."Dealer_email_key";

-- AlterTable
ALTER TABLE "public"."Dealer" DROP COLUMN "approved",
DROP COLUMN "email",
DROP COLUMN "password";

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "dealerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_dealerId_key" ON "public"."User"("dealerId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "public"."Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
