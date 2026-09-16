CREATE TABLE "financial_receipts" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "paymentDate" TIMESTAMP(3),
  "paymentMethod" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountingFirmId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,

  CONSTRAINT "financial_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_receipts_accountingFirmId_number_key" ON "financial_receipts"("accountingFirmId", "number");
CREATE INDEX "financial_receipts_accountingFirmId_idx" ON "financial_receipts"("accountingFirmId");
CREATE INDEX "financial_receipts_clientId_idx" ON "financial_receipts"("clientId");

ALTER TABLE "financial_receipts"
  ADD CONSTRAINT "financial_receipts_accountingFirmId_fkey"
  FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_receipts"
  ADD CONSTRAINT "financial_receipts_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
