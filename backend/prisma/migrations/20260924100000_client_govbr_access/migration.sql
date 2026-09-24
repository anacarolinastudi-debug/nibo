ALTER TABLE "clients"
ADD COLUMN "govbrLoginEncrypted" TEXT,
ADD COLUMN "govbrPasswordEncrypted" TEXT,
ADD COLUMN "govbrAccessUpdatedAt" TIMESTAMP(3);
