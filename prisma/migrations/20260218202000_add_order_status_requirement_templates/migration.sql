-- CreateTable
CREATE TABLE "OrderStatusRequirementTemplate" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "requiredDocs" "OrderDocType"[] NOT NULL DEFAULT ARRAY[]::"OrderDocType"[],
    "requiredFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderStatusRequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatusRequirementTemplate_status_key" ON "OrderStatusRequirementTemplate"("status");
