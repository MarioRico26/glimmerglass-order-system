-- AlterTable
ALTER TABLE "public"."Dealer" ADD COLUMN     "onboarding" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "taxDocUrl" TEXT;
