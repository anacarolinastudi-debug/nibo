ALTER TABLE "demands"
ADD COLUMN "department" TEXT,
ADD COLUMN "checklist" JSONB,
ADD COLUMN "forms" JSONB,
ADD COLUMN "settings" JSONB,
ADD COLUMN "processName" TEXT;

CREATE TABLE "task_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "department" TEXT,
  "checklist" JSONB,
  "forms" JSONB,
  "settings" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountingFirmId" TEXT NOT NULL,
  CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_processes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department" TEXT,
  "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountingFirmId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "responsibleId" TEXT,
  CONSTRAINT "task_processes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_templates_accountingFirmId_idx" ON "task_templates"("accountingFirmId");
CREATE INDEX "task_processes_accountingFirmId_idx" ON "task_processes"("accountingFirmId");
CREATE INDEX "task_processes_clientId_idx" ON "task_processes"("clientId");
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_processes" ADD CONSTRAINT "task_processes_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_processes" ADD CONSTRAINT "task_processes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_processes" ADD CONSTRAINT "task_processes_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
