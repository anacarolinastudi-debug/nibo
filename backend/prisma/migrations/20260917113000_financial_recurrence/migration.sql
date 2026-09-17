ALTER TABLE "financial_transactions"
  ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "recurrenceCount" INTEGER,
  ADD COLUMN "recurrenceInfinite" BOOLEAN NOT NULL DEFAULT false;
