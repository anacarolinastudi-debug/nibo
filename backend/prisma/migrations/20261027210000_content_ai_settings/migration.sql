CREATE TABLE "content_studio_settings" (
  "accountingFirmId" TEXT NOT NULL,
  "apiKeyEncrypted" TEXT,
  "logoUrl" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_studio_settings_pkey" PRIMARY KEY ("accountingFirmId"),
  CONSTRAINT "content_studio_settings_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
