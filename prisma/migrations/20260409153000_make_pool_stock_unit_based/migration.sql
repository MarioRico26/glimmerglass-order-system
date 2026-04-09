ALTER TABLE "PoolStock"
ALTER COLUMN "quantity" SET DEFAULT 1;

DROP INDEX IF EXISTS "PoolStock_factoryId_poolModelId_colorKey_status_key";

CREATE INDEX IF NOT EXISTS "PoolStock_factoryId_poolModelId_colorKey_status_idx"
ON "PoolStock"("factoryId", "poolModelId", "colorKey", "status");

CREATE TEMP TABLE "_pool_stock_split_source" AS
SELECT
  id,
  "factoryId",
  "poolModelId",
  "colorId",
  "colorKey",
  status,
  quantity,
  eta,
  "productionDate",
  "serialNumber",
  notes,
  "imageUrl",
  "createdAt",
  "updatedAt"
FROM "PoolStock"
WHERE quantity > 1;

CREATE TEMP TABLE "_pool_stock_split_units" AS
SELECT
  gen_random_uuid()::text AS id,
  src.id AS "sourceId",
  src."factoryId",
  src."poolModelId",
  src."colorId",
  src."colorKey",
  src.status,
  src.eta,
  src."productionDate",
  src.notes,
  src."createdAt",
  src."updatedAt",
  series.n AS "unitNo"
FROM "_pool_stock_split_source" src
JOIN LATERAL generate_series(1, src.quantity - 1) AS series(n) ON true;

INSERT INTO "PoolStock" (
  id,
  "factoryId",
  "poolModelId",
  "colorId",
  "colorKey",
  status,
  quantity,
  eta,
  "productionDate",
  "serialNumber",
  notes,
  "imageUrl",
  "createdAt",
  "updatedAt"
)
SELECT
  units.id,
  units."factoryId",
  units."poolModelId",
  units."colorId",
  units."colorKey",
  units.status,
  1,
  units.eta,
  units."productionDate",
  NULL,
  CASE
    WHEN units.notes IS NULL OR btrim(units.notes) = '' THEN CONCAT('Split from legacy aggregated stock row ', units."sourceId")
    ELSE CONCAT(units.notes, ' | Split from legacy aggregated stock row ', units."sourceId")
  END,
  NULL,
  units."createdAt",
  units."updatedAt"
FROM "_pool_stock_split_units" units;

UPDATE "PoolStock" stock
SET
  quantity = 1,
  notes = CASE
    WHEN stock.notes IS NULL OR btrim(stock.notes) = '' THEN 'Legacy aggregated stock row converted to unit-based stock'
    ELSE CONCAT(stock.notes, ' | Legacy aggregated stock row converted to unit-based stock')
  END
FROM "_pool_stock_split_source" src
WHERE stock.id = src.id;

INSERT INTO "PoolStockTxn" (
  id,
  "stockId",
  type,
  quantity,
  "referenceOrderId",
  notes,
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  src.id,
  'ADJUST',
  -(src.quantity - 1),
  NULL,
  'Legacy aggregated stock row split into independent units',
  now()
FROM "_pool_stock_split_source" src;

INSERT INTO "PoolStockTxn" (
  id,
  "stockId",
  type,
  quantity,
  "referenceOrderId",
  notes,
  "createdAt"
)
SELECT
  gen_random_uuid()::text,
  units.id,
  'ADD',
  1,
  NULL,
  CONCAT('Created from legacy aggregated stock row ', units."sourceId"),
  now()
FROM "_pool_stock_split_units" units;

DROP TABLE "_pool_stock_split_units";
DROP TABLE "_pool_stock_split_source";
