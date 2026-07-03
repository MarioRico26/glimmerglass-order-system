ALTER TABLE "Dealer"
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'US';

UPDATE "Dealer"
SET "country" = 'US'
WHERE "country" IS NULL OR BTRIM("country") = '';
