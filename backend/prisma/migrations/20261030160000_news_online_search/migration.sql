CREATE TABLE "news_online_searches" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "accountingFirmId" TEXT NOT NULL REFERENCES "accounting_firms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "articleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL, "provider" TEXT NOT NULL, "sources" JSONB NOT NULL,
  "attribution" TEXT, "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "news_online_searches_accountingFirmId_checkedAt_idx" ON "news_online_searches"("accountingFirmId", "checkedAt");
ALTER TABLE "news_online_searches" ENABLE ROW LEVEL SECURITY;
