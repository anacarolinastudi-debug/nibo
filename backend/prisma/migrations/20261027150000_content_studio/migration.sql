CREATE TABLE "content_projects" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "settings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountingFirmId" TEXT NOT NULL,
  CONSTRAINT "content_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_projects_accountingFirmId_fkey" FOREIGN KEY ("accountingFirmId") REFERENCES "accounting_firms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "content_projects_accountingFirmId_updatedAt_idx" ON "content_projects"("accountingFirmId", "updatedAt");
