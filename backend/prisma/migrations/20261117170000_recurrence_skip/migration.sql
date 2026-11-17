-- Editar/excluir meses de recorrências sem fim
ALTER TABLE "financial_transactions" ADD COLUMN "recurrenceUntil" TIMESTAMP(3);
ALTER TABLE "financial_transactions" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;
