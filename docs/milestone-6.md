# Milestone 6 — scoped read-only Notion integration

Implemented the current Notion API adapter after reviewing official documentation: version 2026-03-11, cursor pagination, page/block traversal, contained database data-source queries, parent-scope validation, trash filtering, safe permission/timeouts/rate-limit errors, bounded reads, and memory-only caching. No Notion mutation operation is supported.

New backend module: `notion.py` and Notion adapter/API tests. Updated: private configuration status, query source routing, authenticated `/notion/check`, `/notion/records`, and cache-clear endpoints. Frontend: source selection, deliberate page inspection, real source identifiers/URLs, connection verification, and cache controls. All credentials and the selected private root ID live outside the repository. Automated tests disable real credentials.

Verification: 76 backend tests, 5 frontend tests, and 6 browser tests pass, together with type checking, frontend/backend lint, and the production frontend build. Coverage includes pagination, descendant scope, arbitrary-link exclusion, cross-parent rejection, database-query read semantics, permission/API failures, short Retry-After handling, long-rate-limit refusal, cache isolation, authenticated inspection endpoints, and exclusion of Notion from benchmark run requests.

Live verification initially returned 404 for the selected page while the token itself returned 200. After the user shared the page with the internal connection, the live scoped read succeeded: one configured root and one returned page record under API version 2026-03-11. No page content or private identifier is committed or included in this report, and no Notion content was sent to OpenAI or used in benchmarks. This confirms access, not completeness of the page's fictional company data.

Hosted generation remains unverified because OpenAI reports exhausted project credits. Read-only source inspection and all synthetic workflows remain available. See `notion.md` for limits, privacy/data-use boundaries, internal-token restrictions, and the public OAuth work required before distribution.

Next: Milestone 7, compatible model-run comparisons, charts, confidence intervals with limitations, UI polish, final documentation, and native production verification.
