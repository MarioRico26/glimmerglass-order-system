-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "hardwareAutocover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hardwareMainDrains" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hardwareReturns" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hardwareSkimmer" BOOLEAN NOT NULL DEFAULT false;
