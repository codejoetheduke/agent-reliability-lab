# Milestone 7 — comparisons, desktop polish, and final verification

Completed the final requested milestone on Windows, 2026-10-27. The application now supports compatible completed-run comparison with rate denominators, percentage-point changes, failures by category, measured shared-bin latency charts, reported usage/cost availability, changed case outcomes, and descriptive Wilson 95% pass-proportion intervals. It rejects incomplete, legacy, or incompatible run metadata explicitly. No significance or population-accuracy claim is made.

## Implementation and files

- Backend: added `comparison.py` and `test_comparison.py`; updated `evaluation.py`, `evaluation_service.py`, `evaluation_models.py`, `evaluation_cli.py`, `storage.py`, `routes.py`, `providers.py`, and provider tests. New runs retain full synthetic dataset/fixture snapshots, hashes, execution conditions, and pricing assumptions. Execution uses those snapshots and saved timeout/pricing; credentials remain private. Model overrides cannot inherit another model's rates.
- Frontend: added typed `api/comparison.ts` and the comparison page with Recharts and equivalent data tables. Updated lazy page loading, actual Overview configuration status, navigation wording, asynchronous page tests, and the seven-workflow E2E suite. Corrected unavailable-value text found during native inspection. Replaced scaffold artwork with a matching Material Design 3 flask icon and regenerated desktop icons through the official Tauri CLI.
- Documentation: rewrote README, architecture, security, and environment examples for the implemented application; expanded metric/provider/design notes; generated fresh actual sample evaluation and comparison JSON reports. Updated browser screenshots cover the final shell and comparison UI. Dependencies are recorded in the npm lockfile.

## Verification results

| Check                               | Actual result                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Backend pytest                      | 81 passed                                                                                       |
| Frontend Vitest                     | 5 passed                                                                                        |
| Browser Playwright / installed Edge | 7 passed                                                                                        |
| Strict TypeScript                   | Passed                                                                                          |
| ESLint                              | Passed                                                                                          |
| Ruff lint and format check          | Passed                                                                                          |
| Python dependency consistency       | Passed; no broken requirements                                                                  |
| Prettier / changed UI and docs      | Passed                                                                                          |
| Frontend production build           | Passed; feature chunks below 500 kB, without the former size warning                            |
| Windows native release build        | Passed using installed Visual Studio/MSVC/SDK                                                   |
| Native production bootstrap         | Window rendered, backend connected, protected configuration and persisted history loaded        |
| Launcher shutdown                   | Closing this project's native process stopped its supervised backend; ports 8765/1420 were free |
| Actual synthetic baseline A         | 29/29 labeled cases passed                                                                      |
| Actual synthetic baseline B         | 29/29 labeled cases passed                                                                      |
| Baseline comparison                 | Compatible; 0 improved, 0 regressed, 29 unchanged                                               |
| Credential/private-ID scan          | No matches in tracked files, production assets, or local Git history                            |

The native bootstrap check read the actual WebView2 accessibility tree: real SQLite baseline names and 29/29 outcomes appeared, together with backend-only configuration status. Loading protected APIs confirms the Tauri session IPC and HTTP authorization path under the production CSP. Browser tests verify feature interactions; a complete automated native interaction suite is not claimed. Foreground activation encountered user-input protection, so no further native clicks were forced.

The seven browser workflows cover credential-free startup/navigation, mobile drawer Escape/focus restoration, compact layout, grounded synthetic queries/conflicting evidence, evaluation inspection/persistence/confirmed deletion, mock action cancellation/confirmation/reset, and compatible/incompatible comparisons. Tests disable external credentials and use isolated local state. Backend checks include hand-calculated metrics/intervals/histograms, saved-snapshot execution after mutable loaders become unavailable, fault handling, safe errors, action concurrency/rollback/retry, and Notion pagination/scope/error behavior.

Sample reports contain only fictional fixtures and measured local timings. Four explicit provider-error scenarios pass when safely rejected; they remain recorded as injected errors. A 29/29 mock result is not a hosted model benchmark. Unknown tokens/cost remain null.

## External integration results and remaining limits

The selected Notion root is now readable after the user shared it with the internal connection: one root and one returned page record, API 2026-03-11, read only. This confirms access, not completeness of fictional company content. No private Notion record, ID, or URL is committed or used in general benchmarks.

OpenAI model availability and credential checks succeeded, but generation returned HTTP 429 `credit_balance_exhausted`. Live hosted question answering and model-vs-model benchmarks remain unverified until API credits are available. The adapter's contract, usage/cost arithmetic, grounding, quota handling, timeout, and malformed-output behavior pass mocked transport tests. No silent mock fallback exists.

This is a personal development release with an external Python installation, internal Notion token, private JSON credential configuration, and supervised loopback API. Installers/backend bundling, OS-vault storage, public OAuth, binary/update signing, adversarial security review, and macOS/Linux execution remain distribution work. Retrieval and output validation deliberately use an inspectable lexical/extractive baseline. Evaluations run sequentially in process; interruption is recorded, not automatically retried. The UI shows the latest 100 runs; the API supports pagination. Model aliases and upstream behavior can still change despite saved local inputs.

The requested seven-milestone implementation is complete within these explicitly documented verification limits. Git commits preserve each milestone locally; no remote push was requested.
