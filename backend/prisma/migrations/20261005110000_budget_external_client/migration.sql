-- AlterTable
ALTER TABLE "financial_budgets" ADD COLUMN "clientName" TEXT;
ALTER TABLE "financial_budgets" ALTER COLUMN "clientId" DROP NOT NULL;
