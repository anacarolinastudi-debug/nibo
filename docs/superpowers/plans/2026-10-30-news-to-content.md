# News to AI content

Approved: each news item links to Content Studio, prefills title/summary/source,
opens the existing AI form with an editable audience of small businesses, MEIs
and self-employed professionals. Generation is explicit; review/apply/save are
unchanged. No automatic publishing or paid provider calls during tests.

1. Add authenticated article detail endpoint and tests for missing/invalid IDs.
2. Add optional articleId to AI brief; resolve original reference server-side,
   keep it in generated/saved sources, and instruct original audience-focused
   writing with no invented legal facts or embedded-context instructions.
3. Link news to /conteudos?noticia=UUID. Load metadata with cancellation,
   prefill editable AI form, preserve it through AI connection, clear it when
   opening another project/new content. Never replace an existing saved draft.
4. Run mocked provider tests, browser end-to-end including errors/mobile and
   existing content/news tests, build, publish and verify online assets/routes.
