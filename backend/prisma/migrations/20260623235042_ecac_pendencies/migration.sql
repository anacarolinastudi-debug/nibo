-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCESSO', 'ERRO', 'EM_ANDAMENTO');

-- CreateTable
CREATE TABLE "tax_pendency_checks" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "accountingFirmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "tax_pendency_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_pendencies" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "situation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkId" TEXT NOT NULL,

    CONSTRAINT "tax_pendencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_pendency_checks_accountingFirmId_idx" ON "tax_pendency_checks"("accountingFirmId");

-- CreateIndex
CREATE INDEX "tax_pendency_checks_clientId_idx" ON "tax_pendency_checks"("clientId");

-- CreateIndex
CREATE INDEX "tax_pendencies_checkId_idx" ON "tax_pendencies"("checkId");

-- AddForeignKey
ALTER TABLE "tax_pendency_checks" ADD CONSTRAINT "tax_pendency_checks_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_pendency_checks" ADD CONSTRAINT "tax_pendency_checks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_pendencies" ADD CONSTRAINT "tax_pendencies_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "tax_pendency_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
