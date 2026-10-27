# Read-only Notion test connector

This is a personal development connector for the user's deliberately selected fictional test page hierarchy. It is not a Notion replacement or a general benchmarking data source. The connector reads only configured root page IDs, nested contained pages/blocks, and contained database data-source rows. Arbitrary linked pages, external synced content, media downloads, relation targets, and workspace-wide search are not followed.

Official documentation reviewed before implementation: [Versioning](https://developers.notion.com/reference/versioning), [2026-03-11 upgrade guide](https://developers.notion.com/guides/get-started/upgrade-guide-2026-03-11), [Read block children](https://developers.notion.com/reference/get-block-children), [Request limits](https://developers.notion.com/reference/request-limits), [Database/data-source model](https://developers.notion.com/reference/database), [Query a data source](https://developers.notion.com/reference/query-a-data-source), and [Authorization](https://developers.notion.com/guides/get-started/authorization). The application uses `Notion-Version: 2026-03-11`, `in_trash` handling, and the current data-source query endpoint.

## Configuration and permissions

Private backend configuration supports `NOTION_API_KEY` and comma-separated `NOTION_ROOT_PAGE_IDS`, using environment variables or the private user credential file described in `providers.md`. Root IDs and actual workspace content are not committed. The original supplied key file is untouched and Git-ignored; runtime credentials are loaded from outside the source tree.

The selected page must be shared with the internal connection, with read-content permission. An authenticated token alone does not grant access to a page. Notion may return 404 for an unshared page. The Settings page distinguishes configuration from a live read-only connection check. This app implements no Notion create/update/delete operations; a POST to `/data_sources/{id}/query` is an API-defined read query.

The user's internal token is used only for their private development workspace. Distribution to other users requires a supported public connection and OAuth authorization flow, secure OS-backed token storage, consent, refresh/revocation handling, and a separate security review. Do not distribute this internal-token setup as public authentication.

## Retrieval and privacy

Records preserve real IDs and API-returned source URLs; no URL or page ID is invented. Parent relationships are checked before reading a discovered page. Rich text and selected structured properties are converted to inspectable text; HTML is rendered as text. Instructions in workspace content cannot invoke an action executor.

Notion records remain in a bounded process-memory cache, with a 60-second freshness period and an explicit Settings cache-clear control. They are not inserted into SQLite evaluation history, versioned fixtures, application logs, sample reports, or training pipelines. Conversation/source state is discarded on section/source changes. Selecting Gemini or OpenAI and granting explicit submission consent is required to send question/evidence to that provider. Mock answers do not infer unlabeled Notion facts; source inspection remains available without an LLM.

Reads use cursor pagination, bounded retries honoring short `Retry-After` delays, and explicit errors for longer rate limits. Limits are 50 page records, 2,000 distinct blocks, 10 nested block levels, 30 pagination pages per list, 30,000 text characters per page, and a 90-second overall read budget. Exceeding a limit rejects the snapshot rather than silently claiming a complete read. The 0.36-second request spacing targets the conservative three-per-second connection budget; shared workspace limits can still apply.

Live verification succeeded after the user shared the selected root: one selected root and one returned page record, read-only, using API version 2026-03-11. This verifies connectivity, not that the page contains a complete fictional company dataset. No private page content is included in this report. OpenAI remains blocked by exhausted credits, while a real Gemini query against the selected test page succeeded with one validated citation. Actual Notion content stays out of committed reports.
