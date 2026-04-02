CREATE TYPE "BuildMaterialCategory" AS ENUM ('GEL_COAT', 'SKIN_RESIN', 'BUILD_UP_RESIN', 'CHOP', 'OIL');

CREATE TABLE "OrderBuildRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dateBuilt" TIMESTAMP(3),
    "gelGunOperator" TEXT,
    "chopGunOperator" TEXT,
    "outsideTemp" TEXT,
    "moldTemp" TEXT,
    "buildTeam" TEXT,
    "shellWeight" DOUBLE PRECISION,
    "buildHours" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderBuildRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderBuildMaterialUsage" (
    "id" TEXT NOT NULL,
    "buildRecordId" TEXT NOT NULL,
    "category" "BuildMaterialCategory" NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "startWeight" DOUBLE PRECISION,
    "finishWeight" DOUBLE PRECISION,
    "netWeight" DOUBLE PRECISION,
    "totalWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderBuildMaterialUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderBuildRecord_orderId_key" ON "OrderBuildRecord"("orderId");
CREATE INDEX "OrderBuildMaterialUsage_buildRecordId_category_sortOrder_idx" ON "OrderBuildMaterialUsage"("buildRecordId", "category", "sortOrder");

ALTER TABLE "OrderBuildRecord"
ADD CONSTRAINT "OrderBuildRecord_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderBuildMaterialUsage"
ADD CONSTRAINT "OrderBuildMaterialUsage_buildRecordId_fkey"
FOREIGN KEY ("buildRecordId") REFERENCES "OrderBuildRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
