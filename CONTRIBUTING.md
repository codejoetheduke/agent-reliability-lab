# Contributing

Start with [development setup](docs/development.md) and [architecture](docs/architecture.md). Keep UI presentation, API contracts, orchestration, adapters, persistence, and scoring separate.

For a change, explain the concrete behavior being fixed, add meaningful tests at the affected boundary, run relevant backend/frontend/native checks, and inspect the resulting UI when presentation changes. Provider tests use HTTPX transports; real service credentials do not belong in ordinary tests or CI.

Never commit API keys, private page IDs/content, local history, signing material, or captured authentication headers. Use fictional fixtures. Run `npm run check:source` before pushing. Keep historical evaluation outcomes intact; new prompts or metrics require explicit versions and fresh reports.

CI validates all supported build targets. Release publication requires every quality/runtime/installer job to pass. See [releasing](docs/releasing.md) for versioning, packaging, and current signing limits.
