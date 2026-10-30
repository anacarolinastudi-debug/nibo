ALTER TABLE "news_articles" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

-- Keep the index synchronized for every writer, including the daily collector.
CREATE FUNCTION public.news_search_text() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  NEW."searchText" := translate(lower(NEW.title || ' ' || NEW.summary),
    U&'\00e1\00e0\00e2\00e3\00e4\00e9\00e8\00ea\00eb\00ed\00ec\00ee\00ef\00f3\00f2\00f4\00f5\00f6\00fa\00f9\00fb\00fc\00e7',
    'aaaaaeeeeiiiiooooouuuuc');
  RETURN NEW;
END;
$$;
CREATE TRIGGER news_search_text_sync BEFORE INSERT OR UPDATE OF title, summary
ON "news_articles" FOR EACH ROW EXECUTE FUNCTION public.news_search_text();
UPDATE "news_articles" SET "searchText" = translate(lower(title || ' ' || summary),
  U&'\00e1\00e0\00e2\00e3\00e4\00e9\00e8\00ea\00eb\00ed\00ec\00ee\00ef\00f3\00f2\00f4\00f5\00f6\00fa\00f9\00fb\00fc\00e7',
  'aaaaaeeeeiiiiooooouuuuc');
