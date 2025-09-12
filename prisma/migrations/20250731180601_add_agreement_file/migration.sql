/*
  Warnings:

  - Added the required column `agreementUrl` to the `Dealer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Dealer" ADD COLUMN     "agreementUrl" TEXT NOT NULL;
