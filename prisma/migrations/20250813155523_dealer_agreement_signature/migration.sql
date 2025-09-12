-- AlterTable
ALTER TABLE "public"."Dealer" ADD COLUMN     "agreementSignatureUrl" TEXT,
ADD COLUMN     "agreementSignedAt" TIMESTAMP(3);
