# Milestone 5 — controlled mock task actions

Implemented task creation/update proposals, strict parameter validation, immutable reviewed payloads, explicit confirmation, authenticated local API sessions, transactional execution, persisted resource outcomes, cancellation, idempotency, optimistic version checks, rollback on failed operations, explicit retry, audit state, and confirmed local mock-data reset. No external mutation adapter exists; Notion mutations are rejected.

The launch supervisor creates a fresh random local session token. Vite injects it into development HTML only; the native app obtains it through a narrow Tauri IPC command. Provider credentials never enter this channel. Protected requests carry the local token; health and API schema pages remain public. The token is not embedded in production assets or logged.

New backend files: `actions.py`, `action_routes.py`, `action_evaluation.py`, action/session tests, and SQLite task/proposal tables. Updated frontend/native files: `components/ActionWorkbench.tsx`, `api/session.ts`, API client, Vite bootstrap, Tauri session command, and Playground. The dataset v1.2.0 now has 29 cases: 20 QA/restraint scenarios, four injected provider faults, and five isolated mock action scenarios. Action cases use temporary stores and cannot change application tasks or Notion.

Verification: 66 backend tests, 5 frontend tests, and 6 browser tests pass. Type checks, frontend/backend lint, and the frontend build pass. Browser checks cover session-authorized requests, proposal review, cancellation without a task, confirmation, persisted deadline/owner, and confirmed reset. Concurrency tests execute the same proposal twice and verify one resource. A failure injected after insertion is rolled back before an explicitly confirmed retry creates exactly one task.

Action metrics record selected operation, parameter/deadline correctness, authorization, duplicate prevention, and recovery behavior with explicit denominators. API benchmark data remains synthetic. SQLite operations use `BEGIN IMMEDIATE` and savepoints; there is no remote ambiguity in this mock executor. A future external writer would require durable operation reconciliation and documented non-atomic API race handling.

The native IPC addition is checked in the final production-build verification. Next: Milestone 6, the scoped read-only Notion adapter and live connectivity check against the user-selected fictional test page.
