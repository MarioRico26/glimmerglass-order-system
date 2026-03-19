ALTER TABLE "OrderMedia"
ADD COLUMN "uploadedByUserId" TEXT,
ADD COLUMN "uploadedByRole" "Role",
ADD COLUMN "uploadedByDisplayName" TEXT,
ADD COLUMN "uploadedByEmail" TEXT;

CREATE INDEX "OrderMedia_uploadedByUserId_idx" ON "OrderMedia"("uploadedByUserId");

ALTER TABLE "OrderMedia"
ADD CONSTRAINT "OrderMedia_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
