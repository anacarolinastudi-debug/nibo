ALTER TABLE "financial_receipts" ADD COLUMN "transactionId" TEXT;

CREATE UNIQUE INDEX "financial_receipts_transactionId_key" ON "financial_receipts"("transactionId");

ALTER TABLE "financial_receipts"
  ADD CONSTRAINT "financial_receipts_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "financial_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
