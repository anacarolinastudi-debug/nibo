ALTER TABLE "clients"
ADD COLUMN "personType" TEXT NOT NULL DEFAULT 'JURIDICA',
ADD COLUMN "code" TEXT,
ADD COLUMN "stateRegistration" TEXT,
ADD COLUMN "municipalRegistration" TEXT,
ADD COLUMN "cep" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "number" TEXT,
ADD COLUMN "complement" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "activity" TEXT,
ADD COLUMN "cnae" TEXT,
ADD COLUMN "allowPublicDocuments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxReminderEmail" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "client_contacts" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "whatsapp" TEXT,
  "departments" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "clientId" TEXT NOT NULL,
  "accountingFirmId" TEXT NOT NULL,
  CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_contacts_clientId_idx" ON "client_contacts"("clientId");
CREATE INDEX "client_contacts_accountingFirmId_idx" ON "client_contacts"("accountingFirmId");

ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_accountingFirmId_fkey"
FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
