DO $$ BEGIN
  CREATE TYPE "PoolModelProductType" AS ENUM ('POOL', 'SPA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderJobRole" AS ENUM ('PRIMARY', 'LINKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderJobItemType" AS ENUM ('POOL', 'SPA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "PoolModel"
ADD COLUMN IF NOT EXISTS "productType" "PoolModelProductType" NOT NULL DEFAULT 'POOL';

CREATE TABLE IF NOT EXISTS "OrderJob" (
  "id" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "jobId" TEXT,
ADD COLUMN IF NOT EXISTS "jobRole" "OrderJobRole",
ADD COLUMN IF NOT EXISTS "jobItemType" "OrderJobItemType";

CREATE INDEX IF NOT EXISTS "Order_jobId_idx" ON "Order"("jobId");
CREATE INDEX IF NOT EXISTS "PoolModel_productType_idx" ON "PoolModel"("productType");

DO $$ BEGIN
  ALTER TABLE "Order"
  ADD CONSTRAINT "Order_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "OrderJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
