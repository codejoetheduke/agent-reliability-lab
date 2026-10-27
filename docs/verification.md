# Live Gemini and desktop release verification

Verified locally on Windows, 2026-10-27. The private repository's actual cross-platform workflow results are available through the linked Actions page; those results, rather than configuration alone, establish each runner's build status.

## Local checks

| Check                                           | Actual result                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Backend pytest                                  | 92 passed                                                                                                                 |
| Frontend Vitest                                 | 6 passed                                                                                                                  |
| Installer-manifest guard tests                  | 4 passed                                                                                                                  |
| Playwright / real local services                | 7 passed                                                                                                                  |
| Strict TypeScript and ESLint                    | Passed                                                                                                                    |
| Ruff lint and formatting                        | Passed                                                                                                                    |
| Rust formatting and Clippy with warnings denied | Passed                                                                                                                    |
| Actionlint workflow validation                  | Passed; official validator archive checksum verified                                                                      |
| Frontend production assets                      | Built successfully; feature pages/charts split into separate chunks                                                       |
| Frozen Python sidecar                           | Clean-directory APIs, live defaults, authorization, fixtures, 29 explicit simulation controls, and parent shutdown passed |
| Windows native release                          | Built successfully                                                                                                        |
| Windows NSIS installer                          | Built successfully, approximately 20.43 MiB                                                                               |
| Direct native launch                            | Started its own bundled service on an ephemeral port; protected config and live Gemini mode loaded                        |
| Normal native close                             | Window and both bundled-backend processes exited after Alt+F4                                                             |
| Real browser query                              | Gemini returned a validated Atlas ownership answer; simulated=false, reported usage, valid atlas-plan citation            |
| Live scoped Notion query                        | One selected page retrieved; Gemini returned one validated citation; private content/IDs excluded from reports            |

The live UI screenshot uses only committed fictional fixtures. No API key or private Notion page identifier appears in it. Native startup was observed through the actual WebView2 accessibility state: backend connected, Gemini configured, GEMINI LIVE MODE, and no simulation banner. A comprehensive automated native GUI suite is not claimed.

## Actual model runs

All runs used dataset synthetic-v1, version 1.2.0. Reports contain only fictional fixtures and actual recorded outcomes.

| Model / prompt             | Result | Observed limits                                                               |
| -------------------------- | ------ | ----------------------------------------------------------------------------- |
| Gemini 3.5 Flash-Lite / v1 | 28/29  | Selected a project date for an ambiguous question; original failure preserved |
| Gemini 3.5 Flash-Lite / v2 | 29/29  | Curated-suite result after an explicit ambiguity instruction                  |
| Gemini 3.1 Flash-Lite / v2 | 25/29  | Two timeouts, one invalid output, one ambiguity failure                       |

The compatible v2 comparison records four improved outcomes for 3.5, zero regressions, and 25 unchanged outcomes. It does not establish significance or general model superiority. Prompt v1 and v2 are intentionally incompatible for ordinary model comparison.

Each suite contains 18 hosted question attempts, two local no-model action refusals, four deliberate provider-fault injections, and five isolated action controls. A 29/29 result does not mean 29 successful LLM requests. Missing or incomplete usage is not invented; summaries cover reported accepted responses, and failed calls can have unreported usage/charges. No zero price is assumed from potential free-tier eligibility.

## CI and release evidence

[Cross-platform CI](https://github.com/codejoetheduke/agent-reliability-lab/actions/workflows/ci.yml) validates source checks on Windows/macOS/Linux and produces four native installer targets. The frozen-runtime smoke test runs on each target; macOS also tests the embedded sidecar after bundle signing. [Release CI](https://github.com/codejoetheduke/agent-reliability-lab/actions/workflows/release.yml) publishes only after every required target succeeds and checksum validation passes.

Windows Authenticode signing and Apple notarization credentials are not configured. This release is a private preview, with ad-hoc macOS signing and no trusted public distribution claim. Native GUI interactions on macOS/Linux, public OAuth, live Notion mutations, updates, and universal hardware/distro compatibility are outside the verified scope. See releasing.md for supported targets and signing work.
