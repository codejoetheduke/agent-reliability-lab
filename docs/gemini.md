# Gemini provider

The backend calls Google's GenerateContent API at a fixed HTTPS host, using the key in the `x-goog-api-key` header. Keys never enter URLs, frontend contracts, logs, or SQLite. The default configured model is `gemini-3.5-flash-lite`; users can choose another available compatible model.

Official references consulted: [GenerateContent](https://ai.google.dev/api/generate-content), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing and data use](https://ai.google.dev/gemini-api/docs/pricing).

The request uses current `generationConfig.responseFormat.text` with `APPLICATION_JSON` and a JSON schema, a 2,000-token output budget, no tools, and `store:false`. Free-tier data-use policies still apply; this setting is not a zero-retention promise. There is no automatic provider/model fallback or automatic retry that might conceal quota failures.

Gemini selects record IDs and exact excerpts plus an answer/abstention reason. Python validates the schema, resolves every ID to retrieved evidence, checks every quote verbatim, and renders those accepted quotes as the answer. This deliberately avoids asking the model to duplicate quote text inconsistently in several fields. It does not claim to validate arbitrary paraphrases or prove semantic relevance merely because a quote exists.

Prompt v2 explicitly requires abstention for an unspecified subject when several projects could answer a single-fact question. The initial v1 failure is preserved in its report. That refinement was informed by a curated test case; it is not an independent generalization study. Missing, contradictory, and ambiguous evidence remain important failure modes to inspect.

| Setting                                                         | Meaning                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GEMINI_API_KEY`                                                | Private Google AI Studio key; `GOOGLE_API_KEY` is an alternative  |
| `GEMINI_MODEL`                                                  | Configurable supported model; prefer stable/pinned identifiers    |
| `LAB_DEFAULT_PROVIDER`                                          | `gemini` by default; `openai` or explicit `mock` are alternatives |
| `LAB_PROVIDER_TIMEOUT_SECONDS`                                  | Per-request HTTP timeout, 0.1–120, default 30                     |
| `LAB_GEMINI_REQUEST_INTERVAL_SECONDS`                           | Sequential evaluation pacing, 0–120, default 7 seconds            |
| `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION` | Optional user-maintained rates for the configured model           |

Usage comes from response metadata. Output totals include reported thinking tokens. Missing metadata remains null. Cost is estimated only when both usage and matching model rates exist; an override does not inherit a different model's prices. Cached-token discounts and other pricing tiers are not modeled. No zero price is assumed merely because a model may offer a free tier.

Runs snapshot prompt/version, timeout, pacing, and pricing assumptions. Pacing is included in elapsed request/case timing, so comparisons must match that setting. Rate/key/quota errors stop evaluation and retain completed outcomes. The app cannot inspect your billing tier or guarantee free quota.

The release defaults to live Gemini even when no key is configured. Missing credentials produce a setup message and rejected requests, not a fake answer. Mock and injected-fault controls remain explicitly labeled for offline verification.
