-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('USER_LOGIN', 'DEALER_APPROVED', 'DEALER_REVOKED', 'ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'FILE_UPLOADED', 'AGREEMENT_SIGNED', 'NOTIFICATION_SENT');

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorRole" "public"."Role",
    "dealerId" TEXT,
    "orderId" TEXT,
    "action" "public"."AuditAction" NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_dealerId_idx" ON "public"."AuditLog"("dealerId");

-- CreateIndex
CREATE INDEX "AuditLog_orderId_idx" ON "public"."AuditLog"("orderId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action");
