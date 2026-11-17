-- Contratos de prestação de serviços contábeis
ALTER TABLE "accounting_firms" ADD COLUMN "contractSettings" JSONB;

CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "clientId" TEXT,
    "number" INTEGER NOT NULL,
    "cnpj" TEXT NOT NULL,
    "contratante" JSONB NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "monthlyFee" DECIMAL(12,2) NOT NULL,
    "services" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contracts_accountingFirmId_number_key" ON "contracts"("accountingFirmId", "number");
CREATE INDEX "contracts_accountingFirmId_idx" ON "contracts"("accountingFirmId");
CREATE INDEX "contracts_clientId_idx" ON "contracts"("clientId");
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
