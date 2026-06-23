ALTER TABLE "task_processes"
ADD COLUMN "complement" TEXT,
ADD COLUMN "instructions" TEXT,
ADD COLUMN "stages" JSONB;

CREATE TABLE "process_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department" TEXT,
  "instructions" TEXT,
  "durationDays" INTEGER NOT NULL DEFAULT 30,
  "stages" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountingFirmId" TEXT NOT NULL,
  CONSTRAINT "process_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "process_templates_accountingFirmId_idx" ON "process_templates"("accountingFirmId");
ALTER TABLE "process_templates" ADD CONSTRAINT "process_templates_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
