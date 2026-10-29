CREATE TABLE "news_sources" (
  "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "url" TEXT NOT NULL,
  "uf" TEXT, "scope" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT, "lastCheckedAt" TIMESTAMP(3), "lastSuccessAt" TIMESTAMP(3),
  "articlesCount" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "news_articles" (
  "id" TEXT NOT NULL PRIMARY KEY, "url" TEXT NOT NULL, "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL, "kind" TEXT NOT NULL, "area" TEXT NOT NULL, "scope" TEXT NOT NULL,
  "ufs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "publishedAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sortDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "sourceId" TEXT NOT NULL REFERENCES "news_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "news_articles_url_key" ON "news_articles"("url");
CREATE INDEX "news_articles_sortDate_idx" ON "news_articles"("sortDate");
CREATE INDEX "news_articles_sourceId_publishedAt_idx" ON "news_articles"("sourceId", "publishedAt");
CREATE TABLE "news_article_states" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "articleId" TEXT NOT NULL REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountingFirmId" TEXT NOT NULL REFERENCES "accounting_firms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "read" BOOLEAN NOT NULL DEFAULT false, "bookmarked" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL, PRIMARY KEY ("userId", "articleId")
);
CREATE INDEX "news_article_states_accountingFirmId_userId_idx" ON "news_article_states"("accountingFirmId", "userId");
CREATE TABLE "news_sync_states" (
  "key" TEXT NOT NULL PRIMARY KEY, "state" TEXT NOT NULL DEFAULT 'IDLE', "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3), "nextAllowedAt" TIMESTAMP(3), "lastAttemptAt" TIMESTAMP(3),
  "lastCompletedAt" TIMESTAMP(3), "errorMessage" TEXT
);
