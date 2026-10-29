ALTER TABLE "news_article_states" DROP CONSTRAINT "news_article_states_pkey";
ALTER TABLE "news_article_states" ADD CONSTRAINT "news_article_states_pkey" PRIMARY KEY ("accountingFirmId", "userId", "articleId");
