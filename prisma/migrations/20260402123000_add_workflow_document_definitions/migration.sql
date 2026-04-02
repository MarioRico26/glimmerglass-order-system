ALTER TABLE "OrderMedia"
ADD COLUMN "documentDefinitionId" TEXT;

CREATE TABLE "WorkflowDocumentDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyDocType" "OrderDocType",
    "visibleToDealerDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDocumentDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderStatusRequirementDocument" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "documentDefinitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusRequirementDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowProfileRequirementDocument" (
    "id" TEXT NOT NULL,
    "workflowProfileId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "documentDefinitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowProfileRequirementDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowDocumentDefinition_key_key" ON "WorkflowDocumentDefinition"("key");
CREATE UNIQUE INDEX "WorkflowDocumentDefinition_legacyDocType_key" ON "WorkflowDocumentDefinition"("legacyDocType");
CREATE INDEX "OrderMedia_documentDefinitionId_idx" ON "OrderMedia"("documentDefinitionId");
CREATE UNIQUE INDEX "OrderStatusRequirementDocument_status_documentDefinitionId_key" ON "OrderStatusRequirementDocument"("status", "documentDefinitionId");
CREATE INDEX "OrderStatusRequirementDocument_documentDefinitionId_idx" ON "OrderStatusRequirementDocument"("documentDefinitionId");
CREATE UNIQUE INDEX "WorkflowProfileRequirementDocument_workflowProfileId_status_docume_key" ON "WorkflowProfileRequirementDocument"("workflowProfileId", "status", "documentDefinitionId");
CREATE INDEX "WorkflowProfileRequirementDocument_workflowProfileId_idx" ON "WorkflowProfileRequirementDocument"("workflowProfileId");
CREATE INDEX "WorkflowProfileRequirementDocument_documentDefinitionId_idx" ON "WorkflowProfileRequirementDocument"("documentDefinitionId");

ALTER TABLE "OrderMedia"
ADD CONSTRAINT "OrderMedia_documentDefinitionId_fkey"
FOREIGN KEY ("documentDefinitionId") REFERENCES "WorkflowDocumentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderStatusRequirementDocument"
ADD CONSTRAINT "OrderStatusRequirementDocument_documentDefinitionId_fkey"
FOREIGN KEY ("documentDefinitionId") REFERENCES "WorkflowDocumentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowProfileRequirementDocument"
ADD CONSTRAINT "WorkflowProfileRequirementDocument_workflowProfileId_fkey"
FOREIGN KEY ("workflowProfileId") REFERENCES "WorkflowProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowProfileRequirementDocument"
ADD CONSTRAINT "WorkflowProfileRequirementDocument_documentDefinitionId_fkey"
FOREIGN KEY ("documentDefinitionId") REFERENCES "WorkflowDocumentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH defaults (key, label, sort_order, legacy_doc_type, visible_to_dealer) AS (
    VALUES
      ('OTHER', 'Other', 0, 'OTHER'::"OrderDocType", true),
      ('PROOF_OF_PAYMENT', 'Proof of Deposit', 1, 'PROOF_OF_PAYMENT'::"OrderDocType", true),
      ('QUOTE', 'Order Form', 2, 'QUOTE'::"OrderDocType", true),
      ('INVOICE', 'Invoice with deposit applied', 3, 'INVOICE'::"OrderDocType", true),
      ('BUILD_SHEET', 'Build Sheet', 4, 'BUILD_SHEET'::"OrderDocType", true),
      ('POST_PRODUCTION_MEDIA', 'Post-production Photos/Video', 5, 'POST_PRODUCTION_MEDIA'::"OrderDocType", true),
      ('SHIPPING_CHECKLIST', 'Shipping Checklist', 6, 'SHIPPING_CHECKLIST'::"OrderDocType", true),
      ('PRE_SHIPPING_MEDIA', 'Pre-shipping Photos/Video', 7, 'PRE_SHIPPING_MEDIA'::"OrderDocType", true),
      ('BILL_OF_LADING', 'Bill of Lading', 8, 'BILL_OF_LADING'::"OrderDocType", true),
      ('PROOF_OF_FINAL_PAYMENT', 'Proof of Final Payment', 9, 'PROOF_OF_FINAL_PAYMENT'::"OrderDocType", true),
      ('PAID_INVOICE', 'Paid Invoice', 10, 'PAID_INVOICE'::"OrderDocType", true),
      ('WARRANTY', 'Warranty', 11, 'WARRANTY'::"OrderDocType", true),
      ('MANUAL', 'Manual', 12, 'MANUAL'::"OrderDocType", true)
)
INSERT INTO "WorkflowDocumentDefinition" (
  "id", "key", "label", "active", "sortOrder", "legacyDocType", "visibleToDealerDefault", "createdAt", "updatedAt"
)
SELECT
  'docdef-' || lower(replace(defaults.key, '_', '-')),
  defaults.key,
  COALESCE(config."label", defaults.label),
  true,
  COALESCE(config."sortOrder", defaults.sort_order),
  defaults.legacy_doc_type,
  defaults.visible_to_dealer,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM defaults
LEFT JOIN "WorkflowDocConfig" config ON config."docType" = defaults.legacy_doc_type;

UPDATE "OrderMedia" media
SET "documentDefinitionId" = definition."id"
FROM "WorkflowDocumentDefinition" definition
WHERE media."docType" = definition."legacyDocType"
  AND media."documentDefinitionId" IS NULL;
