# Milestone 2 — synthetic workspace and Playground

The Playground now sends validated questions to the local backend, retrieves relevant fictional records, displays deterministic mock answers with valid excerpts, and exposes retrieved sources for inspection. Conflicting and missing evidence cause explicit abstention. Action-like requests do not execute mutations. All outputs are labeled simulated.

The `DataSource` protocol separates retrieval from fixture loading. The versioned fixture includes project plans, meetings, task owners/statuses/deadlines, blockers, decisions, irrelevant notes, and conflicting Cedar budgets. Retrieval uses transparent normalized word overlap and project/entity scope filtering. The mock answerer extracts labeled facts with quotes present in source bodies; it is not an LLM.

Created: backend `domain.py`, `workspace.py`, `agent.py`, `fixtures/workspace.json`, `tests/test_agent.py`; frontend `api/contracts.ts`, `pages/Playground.tsx`. Modified: API routes/CORS, typed client, section routing, package metadata/lockfile, and end-to-end tests. Zod validates the response contract at runtime. Generated TypeScript build information is now ignored.

Verification: 14 backend tests, 5 frontend tests, and 4 real-service browser tests pass. The checks cover health/security, scoped retrieval, citations, multi-source answers, missing fields/projects, conflicts, forbidden actions, invalid requests, and a real Playground conversation/source inspection. Strict type checking, frontend/backend lint, and production build pass. The frontend bundle reports a size advisory; splitting feature pages is scheduled for the final polish milestone. No external API is called.

Next: Milestone 3, versioned evaluation cases, measurable scoring, SQLite experiment history, and result inspection. Hosted provider integration follows only after those prerequisites work.
