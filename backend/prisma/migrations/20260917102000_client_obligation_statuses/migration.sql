CREATE TABLE "client_obligation_statuses" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "taskStatus" "TaskStatus" NOT NULL DEFAULT 'EM_ABERTO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "linkId" TEXT NOT NULL,

  CONSTRAINT "client_obligation_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_obligation_statuses_linkId_year_month_key" ON "client_obligation_statuses"("linkId", "year", "month");
CREATE INDEX "client_obligation_statuses_year_month_idx" ON "client_obligation_statuses"("year", "month");

ALTER TABLE "client_obligation_statuses"
  ADD CONSTRAINT "client_obligation_statuses_linkId_fkey"
  FOREIGN KEY ("linkId") REFERENCES "client_obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
