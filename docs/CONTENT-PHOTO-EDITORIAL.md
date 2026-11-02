# Editorial With Image

Select Fundo > Editorial com imagem. The first slide uses a 50/50 photo and editorial panel. Cover and internal headings both use Montserrat 800, with body text in Montserrat 400. Preview, library thumbnails, PNG and ZIP use the same renderer.

Lateral da capa and Demais paginas independently select brand navy (#051d40) or white (#ffffff), defaulting to white when settings are absent. Blue panels use light text and the light-blue brand accent; white panels use dark text and the primary-blue accent. Internal photo-editorial slides omit the logo/name/handle header and move the content upward. Standalone white and legacy blue themes remain unchanged. Color settings persist in the existing project JSON without a migration.

Automatic searches derive public visual keywords from the first headline. Manual searches preserve the typed subject. Selection can be replaced with another result or an uploaded PNG/JPEG/WebP. Crop positions and grayscale remain editable. A manual selection is not overwritten when text changes.

Provider: Wikimedia Commons Action API, no paid image or AI API key. Only raster thumbnails on exact Wikimedia media hosts are imported. Included license metadata must indicate CC0, public domain or CC BY; NC, ND and SA are excluded. Credits and source/license links appear in the cover and in ZIP credit text. This is metadata-based filtering, not a legal certification or a guarantee of publicity/trademark rights.

Downloads prohibit redirects, use HTTPS and 15-second/2-MiB bounds. Signed office-bound selection tokens expire in 30 minutes and use a purpose-derived key distinct from access-token signing. Search metadata is cached for 15 minutes with at most 80 terms; provider rate limits and outages remain possible.

Selected photos are decoded/compressed in the browser to an embedded JPEG (max 1600px long edge, 1.25M data-URL characters) and persisted in the existing scoped project JSON. The content route alone accepts JSON up to 2 MiB. Other APIs retain their existing limits. Existing projects and business data are not rewritten; no migration is required.

Verification: content-images.test.js (token separation, office binding, licenses, explicit query, unsafe/oversized imports); content.test.js (permissions, persistence, large embedded photo, unsafe schemes/signatures); content-photo-ui.cjs (real photo pixel checks, first-slide-only, source credits, replacement/upload, crop state, long titles, durable reopen, PNG/ZIP, mobile, delayed-save and concurrent-logo races); old content-ui.cjs and news-content-ui.cjs regressions. Live Commons search and import verified before publication.
