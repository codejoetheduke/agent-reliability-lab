# Provider interface and OpenAI

The agent orchestrator depends on an asynchronous `Provider` protocol. The mock provider returns labeled extractive simulation. The OpenAI adapter calls the Responses API with a strict JSON schema, `store: false`, no tools, and an explicit timeout. Question/evidence submission requires a user-selected hosted provider and affirmative transmission consent. There is no automatic fallback to mock responses after hosted errors.

Official OpenAI documentation consulted: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Responses migration/storage behavior](https://developers.openai.com/api/docs/guides/migrate-to-responses), and [GPT-4.1 mini capabilities](https://developers.openai.com/api/docs/models/gpt-4.1-mini). `gpt-4.1-mini` is a configurable supported baseline, not a claim that it is the newest model. Set `OPENAI_MODEL` or enter a model override; use a pinned model snapshot for stronger reproducibility.

Backend-only environment variables:

Private user configuration is also supported at `~/.agent-reliability-lab/credentials.json`, or an explicit `LAB_CREDENTIALS_FILE` path, using environment-variable names as JSON keys and string values. It lives outside the source tree. Environment settings override the file; setting `LAB_CREDENTIALS_FILE` to an empty string disables file loading for tests. The supplied OpenAI key was saved there with restrictive Windows file permissions, never in this repository.

- `OPENAI_API_KEY`: hosted provider credential; never sent to React, stored in SQLite, or logged.
- `OPENAI_MODEL`: default model identifier.
- `LAB_PROVIDER_TIMEOUT_SECONDS`: 0.1–120 seconds, default 30.
- `OPENAI_INPUT_USD_PER_MILLION` and `OPENAI_OUTPUT_USD_PER_MILLION`: optional finite nonnegative flat rates. These are user-maintained estimates, not hardcoded current prices. Cached-token discounts and tier/batch adjustments are not modeled.

The parser validates both JSON structure and evidence identifiers/excerpts. Every accepted claim is a complete exact quote, and the answer is precisely the joined claim text. Abstention messages are generated locally from validated reasons. This is deliberately conservative extractive QA; it does not validate semantic paraphrases or resolve contradictory facts automatically. Evidence is untrusted and never authorizes tools or actions.

Recorded metadata includes actual reported model identifier, provider latency, total orchestration latency, token counts when available, and estimated cost only when both usage and configured rates exist. Missing values remain null. Responses are not stored through the API request; this is not a claim that the provider has no other operational retention rules.

The 24-case dataset includes four labeled fault injections. Expected rejection of those faults counts as a passed safety check. `failure_rate` includes injected errors, while `provider_failure_rate` excludes injected scenarios; injected counts are recorded explicitly. They must not be presented as empirical hosted-model failure observations.

The adapter is tested with HTTPX transport fixtures for success, wire schema, usage/cost arithmetic, timeout, HTTP errors, malformed output, invalid citations, action suppression, and secret-safe exceptions. A live hosted request requires a configured API key and is reported separately from these contract tests.
