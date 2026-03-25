CREATE TABLE "WorkflowProfile" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowProfileRequirementTemplate" (
  "id" TEXT NOT NULL,
  "workflowProfileId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "requiredDocs" "OrderDocType"[] DEFAULT ARRAY[]::"OrderDocType"[],
  "requiredFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowProfileRequirementTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Dealer"
ADD COLUMN "workflowProfileId" TEXT;

CREATE UNIQUE INDEX "WorkflowProfile_slug_key" ON "WorkflowProfile"("slug");
CREATE UNIQUE INDEX "WorkflowProfile_name_key" ON "WorkflowProfile"("name");
CREATE UNIQUE INDEX "WorkflowProfileRequirementTemplate_workflowProfileId_status_key"
ON "WorkflowProfileRequirementTemplate"("workflowProfileId", "status");
CREATE INDEX "WorkflowProfileRequirementTemplate_workflowProfileId_idx"
ON "WorkflowProfileRequirementTemplate"("workflowProfileId");
CREATE INDEX "Dealer_workflowProfileId_idx" ON "Dealer"("workflowProfileId");

ALTER TABLE "WorkflowProfileRequirementTemplate"
ADD CONSTRAINT "WorkflowProfileRequirementTemplate_workflowProfileId_fkey"
FOREIGN KEY ("workflowProfileId") REFERENCES "WorkflowProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Dealer"
ADD CONSTRAINT "Dealer_workflowProfileId_fkey"
FOREIGN KEY ("workflowProfileId") REFERENCES "WorkflowProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "WorkflowProfile" ("id", "slug", "name", "active")
VALUES
  (gen_random_uuid()::text, 'kline-bros', 'Kline Bros', true),
  (gen_random_uuid()::text, 'baystate', 'Baystate', true),
  (gen_random_uuid()::text, 'imperial', 'Imperial', true),
  (gen_random_uuid()::text, 'heritage', 'Heritage', true);
