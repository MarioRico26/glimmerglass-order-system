-- 2.1 Asegura que la columna exista
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "orderId" TEXT;

-- 2.2 Si ya existía como UUID, cámbiala a TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Notification'
      AND column_name = 'orderId'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE "Notification"
      ALTER COLUMN "orderId" TYPE TEXT USING "orderId"::text;
  END IF;
END$$;

-- 2.3 Borra el FK previo si se llegó a crear (por si acaso)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'Notification'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'Notification_orderId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      DROP CONSTRAINT "Notification_orderId_fkey";
  END IF;
END$$;

-- 2.4 Crea el FK con tipos compatibles (TEXT → TEXT)
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2.5 (Opcional) índice útil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'Notification_dealerId_createdAt_idx'
  ) THEN
    CREATE INDEX "Notification_dealerId_createdAt_idx"
    ON "Notification" ("dealerId", "createdAt" DESC);
  END IF;
END$$;