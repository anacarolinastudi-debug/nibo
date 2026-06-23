-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateTable
CREATE TABLE "forms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'ATIVO',
    "settings" JSONB,
    "pages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountingFirmId" TEXT NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forms_accountingFirmId_idx" ON "forms"("accountingFirmId");

-- CreateIndex
CREATE INDEX "forms_status_idx" ON "forms"("status");

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
