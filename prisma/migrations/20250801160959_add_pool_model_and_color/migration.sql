-- CreateTable
CREATE TABLE "public"."PoolModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PoolModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PoolColor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PoolColor_pkey" PRIMARY KEY ("id")
);
