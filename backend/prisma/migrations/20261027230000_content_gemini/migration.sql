ALTER TABLE "content_studio_settings"
ADD COLUMN "geminiKeyEncrypted" TEXT,
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'openai';
