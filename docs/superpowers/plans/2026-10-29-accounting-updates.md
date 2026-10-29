# National Accounting Updates Implementation Plan

> **For agentic workers:** Execute inline with independent frontend/source tasks and a final review.

**Goal:** Deliver the approved national news/legislation hub inspired by IOB organization, not its proprietary editorial content, calculators or consultancy.
**Architecture:** Immutable allowlisted official sources, bounded RSS/HTML metadata collection, PostgreSQL article history and per-user reading/bookmark state. Daily 07:00 America/Cuiaba collection is triggered by GitHub Actions independently of the user's PC, with server/startup and stale-read fallbacks. A database lease/cooldown bounds public cache refreshes and prevents overlapping deployments from duplicate work. No client/task/deadline records are modified.
**Tech Stack:** Existing Express/Prisma/PostgreSQL, node-cron, React/Vite, vetted XML/HTML parsers.
**Spec:** User approved national news and legislation; area/UF/sphere/source/date filters; source/title/date/original link/short summary; favorites, read markers, persistent history, actual coverage and last-check status. No representation of comprehensive municipal monitoring or legal consultancy.

## Deliverables
- [x] Verify official source endpoints across the five regions; record per-source limits and adapters.
- [x] Write parser/security/route tests; implement safe bounded ingestion, persistence, personal state and distributed job coordination.
- [x] Build accessible, responsive updates page and persistent sidebar links, including source status and failure/empty/loading states.
- [x] Add daily workflow and server fallback; perform real ingestion and inspect results before deployment.
- [ ] Run backend/UI tests, review security and verify deployment/scheduler configuration.

## API Contract
GET /api/updates/articles: q, area, kind (NEWS/LEGISLATION), scope (FEDERAL/ESTADUAL/MUNICIPAL/NACIONAL), uf, source, from, to, read (all/unread/read), bookmarked, page. Returns items,total,page,pageSize. Article fields: id,title,summary,url,publishedAt (nullable),firstSeenAt,kind,area,scope,ufs,source:{id,name,url},read,bookmarked.
GET /api/updates/status: state,lastAttemptAt,lastCompletedAt,nextSchedule,timeZone,sources. Source fields: id,name,url,uf,scope,status (PENDING/OK/EMPTY/ERROR),lastCheckedAt,lastSuccessAt,errorMessage,articlesCount.
POST /api/updates/refresh: authenticated staff, rate limited; returns state,queued.
PATCH /api/updates/articles/:id/state: authenticated staff; read/bookmarked booleans; returns articleId,read,bookmarked.
POST/GET /api/updates/daily: public bounded public-data cache trigger/status only, no business data, no configurable URLs. Daily trigger once per local day, retries bounded by database cooldown.

## Review Focus
Untrusted upstream HTML never renders as HTML. Only configured HTTPS hosts/paths are fetched, including redirects. No fake publication dates, generated legal interpretations, deleted history, or changes to obligations. A failed source retains old articles and displays failure. Personal marks cannot leak between users/firms. Remote response bytes/time and daily refresh attempts are bounded. Source coverage is honest, not inferred from all-UF filter options.
