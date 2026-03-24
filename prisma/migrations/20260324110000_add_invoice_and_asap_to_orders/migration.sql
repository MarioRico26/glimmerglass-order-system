ALTER TABLE "Order"
ADD COLUMN "requestedShipAsap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoiceNumber" TEXT;
