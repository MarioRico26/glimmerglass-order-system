DO $$
BEGIN
  CREATE TYPE "AdminModule" AS ENUM (
    'DASHBOARD',
    'ORDER_LIST',
    'NEW_ORDER',
    'PRODUCTION_SCHEDULE',
    'SHIP_SCHEDULE',
    'POOL_STOCK',
    'POOL_CATALOG',
    'WORKFLOW_REQUIREMENTS',
    'INVENTORY',
    'DEALERS',
    'USERS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ModuleAccessLevel" AS ENUM ('VIEW', 'EDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserFactoryAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "factoryLocationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserFactoryAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserModuleAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "module" "AdminModule" NOT NULL,
  "accessLevel" "ModuleAccessLevel" NOT NULL DEFAULT 'VIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserModuleAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserFactoryAccess_userId_factoryLocationId_key"
  ON "UserFactoryAccess"("userId", "factoryLocationId");
CREATE INDEX IF NOT EXISTS "UserFactoryAccess_userId_idx"
  ON "UserFactoryAccess"("userId");
CREATE INDEX IF NOT EXISTS "UserFactoryAccess_factoryLocationId_idx"
  ON "UserFactoryAccess"("factoryLocationId");

CREATE UNIQUE INDEX IF NOT EXISTS "UserModuleAccess_userId_module_key"
  ON "UserModuleAccess"("userId", "module");
CREATE INDEX IF NOT EXISTS "UserModuleAccess_userId_idx"
  ON "UserModuleAccess"("userId");
CREATE INDEX IF NOT EXISTS "UserModuleAccess_module_idx"
  ON "UserModuleAccess"("module");

DO $$
BEGIN
  ALTER TABLE "UserFactoryAccess"
    ADD CONSTRAINT "UserFactoryAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserFactoryAccess"
    ADD CONSTRAINT "UserFactoryAccess_factoryLocationId_fkey"
    FOREIGN KEY ("factoryLocationId") REFERENCES "FactoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserModuleAccess"
    ADD CONSTRAINT "UserModuleAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
