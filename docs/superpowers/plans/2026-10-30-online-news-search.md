# Online news search

Approved scope: automatic fallback when a submitted query has no saved matches,
restricted to registered trusted sources. Portal Contabeis remains first and
results retain original links and the news-to-content flow.

Site searches were inspected: Portal uses Google CSE and gov.br uses a dynamic
search application. Use the office's existing AI provider's official web-search
tool to discover cited links, not generated news. Verify each candidate against
registered HTTPS article paths and live publisher metadata before saving it.
Never invent dates, render provider answers as news or fetch arbitrary URLs.

1. Add bounded provider discovery, safe Google grounding redirect handling and
   streaming article metadata extraction with mocked provider/security tests.
2. Persist firm-scoped query cache (hashed keys, 15-minute TTL) and a database
   lease/rate limit; preserve personal filters and article attribution.
3. Add authenticated POST /updates/search and join cached IDs into local search
   results so paraphrased queries can find verified discoveries. Apply filters
   after discovery; never search online for empty/read/favorites-only requests.
4. Frontend fallback after zero local matches, cancellation, visible online,
   empty, partial, quota/error states and provider attribution in sandbox iframe.
5. Test local DB, browser/mobile, existing flows and one bounded real query if
   the configured provider's search quota permits. Publish and verify.
