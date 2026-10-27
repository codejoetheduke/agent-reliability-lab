# Agent Reliability Lab

A Windows desktop developer tool for evidence-grounded agent experiments. Tauri 2 hosts React, strict TypeScript, Vite, Material UI 9 with a Material Design 3 theme, and Recharts. A local FastAPI/Pydantic/HTTPX package handles retrieval, model calls, evaluation, and SQLite history.

Milestones 1–7 are implemented. Start without credentials in clearly labeled mock mode. Inspect synthetic answers and citations, run the 29-case versioned evaluation, review confirmed mock task actions, inspect selected Notion pages, and compare compatible completed runs. Mock results are simulated workflows, not hosted-model benchmarks.

## Prerequisites

- Node.js and npm (tested: Node 24.8.0).
- Python 3.11 or newer (tested: 3.12.14).
- Rust stable with the MSVC target (tested: 1.89.0).
- Windows: Visual Studio **Desktop development with C++**, MSVC x64/x86, a Windows SDK, and WebView2 Runtime.
- Browser tests use installed Microsoft Edge. Other platforms need Playwright Chromium and a corresponding change to `playwright.config.ts`.

The shell was created with official Tauri tooling. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for macOS/Linux packages; those platforms remain unverified.

## Setup

From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r apps/backend/requirements-dev.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e apps/backend
npm.cmd ci
```

If `python` resolves to a Windows Store alias, use your installed interpreter's absolute path for the first command. No activation is required. On macOS/Linux use `python3`, `.venv/bin/python`, and `npm`.

## Run and build

```powershell
npm.cmd run dev              # native desktop with development UI
npm.cmd run dev:web          # browser UI and backend, without native build tools
npm.cmd run build            # production frontend
npm.cmd run build:desktop    # native release executable, no installer
npm.cmd run preview:desktop  # release executable plus supervised Python backend
```

Run one launcher at a time. Browser mode uses `http://127.0.0.1:1420`; the API binds only to `127.0.0.1:8765`. The supervisor rejects occupied ports, starts Python, verifies health, generates a per-launch session nonce, and starts the UI. Closing the native process or pressing Ctrl+C stops its owned child processes. Windows builds discover Visual Studio with `vswhere` and load its toolchain environment without printing it.

Use the combined launcher: protected API calls require its session nonce. The nonce reaches native React through a minimal Tauri command, or browser development through a generated HTML meta element. Provider credentials never reach either UI. `GET /health` is public; `/docs` describes the API but protected operations still require the session header.

Production output is `apps/desktop/src-tauri/target/release/agent-reliability-lab.exe`. Python is installed separately and started by the supervisor. Double-clicking the executable alone does not supervise Python. Installers, backend bundling, signing, and updates are outstanding distribution work.

## Private backend configuration

Credentials are optional. Configure environment variables or an external JSON file at `~/.agent-reliability-lab/credentials.json`. All JSON values must be strings. Example placeholders:

```json
{
  "OPENAI_API_KEY": "replace-with-private-key",
  "OPENAI_MODEL": "gpt-4.1-mini",
  "NOTION_API_KEY": "replace-with-private-internal-connection-token",
  "NOTION_ROOT_PAGE_IDS": "replace-with-selected-test-page-uuid"
}
```

Keep this file outside the repository and restrict its OS permissions. Never use `VITE_` for credentials. Environment values override the file. `LAB_CREDENTIALS_FILE` selects another private path; an empty value disables file loading. `.env` is a reference only and is not automatically loaded. The originally supplied `api-keys.txt` is ignored by Git and denied by Vite; runtime loads the external private file instead.

| Setting                                                         | Meaning                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`, `OPENAI_MODEL`                                | Backend-only Responses API credential and configurable model                                      |
| `LAB_PROVIDER_TIMEOUT_SECONDS`                                  | Provider request budget, default 30, range 0.1–120 seconds                                        |
| `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION` | Optional user-maintained flat rates for the configured model; missing rates mean unavailable cost |
| `NOTION_API_KEY`, `NOTION_ROOT_PAGE_IDS`                        | Internal read-content token and comma-separated selected root page UUIDs                          |
| `LAB_DATA_DIR`                                                  | Local SQLite directory; default `.local/` in the project                                          |
| `LAB_PYTHON`                                                    | Optional absolute interpreter path for the launcher                                               |

Share the selected fictional test page with the Notion internal connection. Use Settings → Check Notion connection, then Playground → Notion → Inspect selected pages. Only contained descendants are traversed. No Notion mutation is implemented. External submission requires selecting OpenAI and granting affirmative question/evidence transmission consent. Evaluations accept only synthetic fixtures.

Live development verification: the selected Notion page is readable after sharing. The OpenAI key is valid and the configured model is available, but generation returned HTTP 429 `credit_balance_exhausted`. Live hosted answering remains unverified until account credits are available. The app reports this error and never substitutes mock success.

## Workflows and limits

- **Playground:** lexical retrieval and inspectable sources. The mock provider extracts labeled synthetic facts. Hosted output uses strict JSON and exact quoted claims with validated record IDs; unsupported output is rejected. This conservative baseline does not accept semantic paraphrases.
- **Evaluations:** dataset `synthetic-v1`, version `1.2.0`, contains 20 QA/restraint cases, four explicit provider-fault injections, and five isolated action cases. Inspect expected criteria, raw outcomes, citations, timing, and metric denominators in run details.
- **Actions:** structured create/update proposals for a separate local mock task store. Review and confirm immutable proposals. SQLite transactions, idempotency keys, optimistic versions, cancellation, and explicit failed-operation retry protect the lifecycle. Natural-language QA never executes actions. No external task changes occur.
- **Comparisons:** choose two completed runs. Dataset/fixture hashes, versions, metric/prompt versions, retrieval k, execution conditions, and simulation mode must match. Charts show recorded rates and shared latency bins, with equivalent tables. Wilson intervals are descriptive for curated correlated cases and do not establish statistical significance.
- **Retention:** Run History offers confirmed history deletion and blocks deletion during active runs. Mock tasks/proposals have a separate confirmed reset. Notion content stays in bounded memory, with a Settings cache-clear control; it is excluded from history/reports. Closing the process discards the cache.

No embeddings, model training, LLM judge, cloud service, PostgreSQL, or Docker is required. Model aliases can change upstream; prefer pinned snapshots for stronger reproducibility. This small curated dataset's mock pass rate is not general agent accuracy.

## Verification and sample reports

```powershell
.\.venv\Scripts\python.exe -m pytest apps/backend/tests -q
.\.venv\Scripts\python.exe -m ruff check apps/backend
.\.venv\Scripts\python.exe -m ruff format --check apps/backend
.\.venv\Scripts\python.exe -m pip check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build:desktop
```

Leave ports 1420/8765 free for E2E tests. They use an isolated SQLite directory, disable private credentials, start real local services, and exercise desktop/rail/mobile layouts, sources, evaluations/history, confirmed actions, and compatible/incompatible comparisons. Screenshots are in `docs/screenshots/`.

Generate an actual synthetic report without a model key:

```powershell
.\.venv\Scripts\python.exe -m reliability_lab.evaluation_cli --label "Mock baseline A" --output docs/sample-evaluation-report.json
```

The CLI records a local experiment and exports its snapshots and results. [Metric definitions](docs/metrics.md) explain denominators, fault accounting, timing, and unavailable values. [Final verification](docs/milestone-7.md) records actual checks and limits.

## Architecture and modules

| Module                                                   | Responsibility                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/desktop/src/theme.ts`, `App.css`, `components/`    | Material Design 3 roles, adaptive layout, accessible controls       |
| `apps/desktop/src/pages/`, `api/`, `hooks/`              | Lazy-loaded features, Zod-validated contracts, polling/cancellation |
| `apps/desktop/src-tauri/`                                | Native window, CSP, minimal local session IPC                       |
| `apps/backend/src/reliability_lab/main.py`, `routes.py`  | Validated APIs, session authorization, safe errors                  |
| `workspace.py`, `agent.py`, `providers.py`, `notion.py`  | Source boundary, retrieval, grounding validation, adapters          |
| `evaluation*.py`, `comparison.py`, `fixtures/`           | Versioned cases, scoring, snapshots, background runs, comparison    |
| `actions.py`, `action_routes.py`, `action_evaluation.py` | Confirmed local lifecycle and isolated action tests                 |
| `storage.py`, `config.py`                                | SQLite history and backend-only settings                            |
| `scripts/`                                               | Backend/UI supervision and native toolchain setup                   |

See [architecture](docs/architecture.md), [security](docs/security.md), [design system](docs/design-system.md), [providers](docs/providers.md), and [Notion scope/limits](docs/notion.md). Milestone reports preserve incremental implementation and verification.
