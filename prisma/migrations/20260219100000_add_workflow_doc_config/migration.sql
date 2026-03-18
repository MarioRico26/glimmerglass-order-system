-- CreateTable
CREATE TABLE "WorkflowDocConfig" (
    "id" TEXT NOT NULL,
    "docType" "OrderDocType" NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDocConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDocConfig_docType_key" ON "WorkflowDocConfig"("docType");
