ALTER TABLE "InventoryItem"
ALTER COLUMN "minStock" TYPE NUMERIC(12,2) USING "minStock"::numeric,
ALTER COLUMN "minStock" SET DEFAULT 0;

ALTER TABLE "InventoryStock"
ALTER COLUMN "onHand" TYPE NUMERIC(12,2) USING "onHand"::numeric,
ALTER COLUMN "onHand" SET DEFAULT 0;

ALTER TABLE "InventoryTxn"
ALTER COLUMN "qty" TYPE NUMERIC(12,2) USING "qty"::numeric;

ALTER TABLE "InventoryReorderLine"
ALTER COLUMN "onHand" TYPE NUMERIC(12,2) USING "onHand"::numeric,
ALTER COLUMN "onHand" SET DEFAULT 0,
ALTER COLUMN "qtyToOrder" TYPE NUMERIC(12,2) USING "qtyToOrder"::numeric,
ALTER COLUMN "qtyToOrder" SET DEFAULT 0;
