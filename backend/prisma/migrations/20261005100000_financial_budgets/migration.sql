-- CreateTable
CREATE TABLE "financial_budgets" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'RECEITA',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "financial_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_budgets_accountingFirmId_number_key" ON "financial_budgets"("accountingFirmId", "number");

-- CreateIndex
CREATE INDEX "financial_budgets_accountingFirmId_idx" ON "financial_budgets"("accountingFirmId");

-- CreateIndex
CREATE INDEX "financial_budgets_clientId_idx" ON "financial_budgets"("clientId");

-- AddForeignKey
ALTER TABLE "financial_budgets" ADD CONSTRAINT "financial_budgets_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_budgets" ADD CONSTRAINT "financial_budgets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
