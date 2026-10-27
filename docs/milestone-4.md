# Milestone 4 — providers and grounded model responses

Implemented the asynchronous provider interface, labeled mock and explicit fault adapters, OpenAI Responses API with strict structured output and response storage disabled, local evidence validation, safe provider failures/timeouts/refusals/quota messages, token metadata, configured-price estimates, provider/model UI controls, affirmative transmission consent, and secret-free Settings status.

New backend modules: `providers.py`, `mock_provider.py`, `config.py`, and provider tests. Updated: agent orchestration, domain/API schemas, 24-case dataset v1.1.0, run configuration/prompt snapshots, error handling, and evaluation fault reporting. Frontend additions: provider controls, execution/config contracts, Settings, and provider-aware Playground/evaluation pages. Run details distinguish injected errors from ordinary provider failures.

Verification: 52 backend tests, 5 frontend tests, and 5 real-service browser tests pass; strict type checks, lint, and the frontend production build pass. HTTPX transport tests verify the actual request shape, evidence validation, arithmetic, errors, consent, and secret-safe logs. All 24 deterministic synthetic scenarios pass, including expected fault rejection.

Live verification: the supplied credential was stored outside the repository in private user configuration with restricted Windows file permissions. A read-only OpenAI model check returned 200 and confirmed the configured model is available. Generation returned HTTP 429 with `credit_balance_exhausted`. Therefore **live hosted answer generation is not verified**; it requires API credits. No successful hosted answer is claimed. The app exposes a clear quota error and stops an evaluation when credentials or credits require attention.

See `providers.md` for official OpenAI documentation, configuration variables, and the extractive validation boundary. Real credentials and private workspace identifiers are excluded from Git and benchmark data. Automated tests disable private credential-file loading and use isolated synthetic state.

Next: Milestone 5, authenticated local API sessions and confirmed, idempotent mock task actions with failure/retry tests. The Notion connector remains read-only in its later milestone.
