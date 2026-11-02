# Photo Editorial Cover

Approved reference: first slide has a full-height photograph on the left and a pale editorial panel on the right. Subsequent slides exactly reuse the white editorial renderer and Montserrat fonts. Young Contabil branding replaces the example brand.

1. Add authenticated Commons image search and signed, office-bound selection. Restrict downloads to Wikimedia media hosts, raster signatures, size/time limits and reusable licenses. Preserve creator, source and license in credits. No AI image or paid provider calls.
2. Add a photo background and embedded cover-photo settings, scoped JSON body limit for content only. Preserve existing projects; no database migration.
3. Add auto search on selecting the style and applying a new AI draft, editable search, alternatives, upload, black-and-white and crop controls. Prevent stale async results from replacing manual images or another project.
4. Share photo loading between preview, thumbnails and exports. Save a compressed local raster data URL so external hosting is not required after selection. Include photo credits in the artwork/ZIP.
5. Test endpoint permissions, URL/token boundaries, project persistence, first-slide-only rendering, long titles, PNG/ZIP, reopening and mobile layout. Build, review and publish.

Provider access may be rate limited or unavailable. Show failures and allow manual upload; never silently substitute an unrelated image or remove credits. Search uses the public first-slide title, never private context or client credentials.
