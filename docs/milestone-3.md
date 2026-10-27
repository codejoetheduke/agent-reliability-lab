# Milestone 3 — repeatable evaluations and local history

Implemented a versioned 20-case synthetic dataset, deterministic test runner, explicit numerator/denominator metrics, SQLite run persistence, restart recovery, live evaluation progress, individual result inspection, recorded Overview metrics, and confirmed local history deletion. A CLI generates a sample report from actual execution.

Backend files: `evaluation.py`, `evaluation_models.py`, `evaluation_service.py`, `evaluation_cli.py`, `storage.py`, `routes.py`, `fixtures/evaluation-v1.json`, lifespan wiring, and evaluation/persistence tests. Frontend files: `api/evaluation.ts`, `hooks/useRuns.ts`, `components/RunDetails.tsx`, `pages/{Evaluations,RunHistory}.tsx`, Overview and route integration. Browser tests now isolate their SQLite state and cover run creation, outcome inspection, persistence after reload, canceling deletion, and confirmed deletion.

Verification: 39 backend tests, 5 frontend tests, and 5 browser tests pass. Strict type checks and frontend/backend lint pass. The production frontend builds; the bundle-size advisory will be addressed in the polish milestone. The sample report contains a completed 20-case mock run with 20 labeled case passes. See `metrics.md` for definitions and `sample-evaluation-report.json` for actual outcomes, timing, and unavailable usage/cost values.

Run snapshots contain dataset/fixture hashes, dataset/metric versions, retrieval k, provider/model label, and raw expected/actual outcomes. SQLite is a local ignored development store, with foreign keys, bounded reads, closed connections, and interrupted-run recovery. Deletion is transactional and rejects active runs. Logical deletion is not a secure disk erase guarantee.

Next: Milestone 4 adds the provider interface, OpenAI structured output, usage reporting, safe invalid-output handling, and explicit fault scenarios. No real Notion content is used in benchmarks.
