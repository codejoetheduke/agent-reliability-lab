# Development guide

## Local setup

Use Node 24, Python 3.12, and Rust 1.89 or newer. CI explicitly installs Rust 1.89. Windows needs the Visual Studio C++ workload and a Windows SDK; macOS needs Xcode command-line tools; Linux needs the Tauri WebKitGTK prerequisites. The app is organized as one npm workspace and a separately installable Python package.

Create `.venv`, install `requirements-dev.lock` and `requirements-build.lock`, install the backend editable with `--no-deps`, then run `npm ci`, as shown in README. `scripts/python.mjs` selects `.venv/Scripts/python.exe` on Windows and `.venv/bin/python` elsewhere; `LAB_PYTHON` can override the build interpreter.

| Command                                                                        | Purpose                                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `npm run dev:web`                                                              | Supervised source backend and Vite at localhost:1420                  |
| `npm run package:backend`                                                      | Freeze Python and packaged fixture data for the current native target |
| `npm run dev`                                                                  | Supervised Tauri development; freeze the sidecar once first           |
| `npm run build`                                                                | Strict TypeScript and frontend production build                       |
| `npm run build:desktop`                                                        | Freeze Python and compile the release executable without an installer |
| `npm run package:desktop`                                                      | Freeze Python and build native installers                             |
| `npm run preview:desktop`                                                      | Source-supervised release preview using development history           |
| `npm run test:backend`                                                         | Backend pytest                                                        |
| `npm run test:sidecar`                                                         | Clean-directory frozen runtime integration test                       |
| `npm test`                                                                     | Frontend Vitest                                                       |
| `npm run test:e2e`                                                             | Real-service Playwright workflows                                     |
| `npm run check:source`                                                         | Versioned-path and credential-pattern guard                           |
| `node scripts/native.mjs --cargo clippy --locked --all-targets -- -D warnings` | Native lint with the Windows developer environment when needed        |

The native launcher loads only Visual Studio toolchain variables and does not print them. macOS/Linux invoke the native tools directly. Frozen binaries are host-specific; build them on the intended platform and architecture. Cross-compiling Rust alone does not cross-compile Python.

## Module ownership

| Location                                                | Responsibility                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/desktop/src/pages/`                               | Presentation for playground, evaluation, comparison, history, settings         |
| `src/api/`, `src/hooks/`                                | Zod runtime contracts, native/browser sessions, polling/cancellation           |
| `src/theme.ts`, `App.css`, `components/`                | MUI-based Material Design 3 roles and adaptive accessible controls             |
| `apps/desktop/src-tauri/src/lib.rs`                     | Native child lifecycle, random nonce, ephemeral port, protected readiness, IPC |
| `apps/backend/src/reliability_lab/main.py`, `routes.py` | FastAPI boundaries, consent/session checks, safe errors                        |
| `domain.py`, `config.py`                                | Strict contracts and backend-only settings                                     |
| `workspace.py`, `notion.py`, `agent.py`                 | Scoped records, lexical retrieval, orchestration, local action refusals        |
| `providers.py`, `gemini.py`                             | Provider protocol, OpenAI/mock adapters, Gemini evidence selection             |
| `evaluation*.py`, `comparison.py`                       | Versioned cases, scoring, snapshots, sequential execution, compatibility       |
| `storage.py`, `actions.py`                              | SQLite history and transactional local simulation controls                     |
| `runtime.py`, `scripts/backend-entry.py`                | Frozen service startup and parent-lifetime monitoring                          |
| `scripts/package-backend.mjs`, `collect-release.mjs`    | Native Python packaging and installer checksums                                |
| `.github/workflows/`                                    | Cross-platform quality, installers, gated release publication                  |

Keep orchestration and scoring out of React. Add providers behind the protocol and validate their wire output before constructing accepted answers. Notion's source adapter must remain read only until a separately designed authorized writer exists.

## Contracts and API

Public: `GET /health` and API schema/docs. Protected endpoints require `X-Lab-Token`; CORS is not authentication.

| Endpoint                                                                | Responsibility                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `GET /session`                                                          | Native authenticated readiness probe                          |
| `GET /config`                                                           | Redacted provider/source configuration status                 |
| `POST /agent/query`                                                     | Explicit provider/source query; hosted evidence needs consent |
| `GET /datasets`                                                         | Available synthetic versions                                  |
| `POST /runs`                                                            | Start a sequential synthetic evaluation                       |
| `GET /runs`, `GET /runs/{id}`, `GET /runs/{id}/tests/{test_id}`         | Paginated summaries and inspectable raw outcomes              |
| `GET /comparisons`                                                      | Validated comparison or incompatibility reasons               |
| `GET /overview`, `DELETE /history`                                      | Recorded metrics and retention                                |
| `POST /notion/check`, `GET /notion/records`, `POST /notion/clear-cache` | Scoped read-only inspection/cache                             |
| `/actions/*`                                                            | Confirmed local simulation lifecycle; no external writer      |

The installed frontend discovers its API URL and nonce through native IPC; browser development uses the supervised HTML nonce and fixed loopback port. Never place a provider key in VITE variables or a frontend contract.

## Tests and data

Unit/API tests isolate SQLite, disable private credential loading, and use HTTPX transports. They intentionally select simulation defaults. CI never needs hosted-provider credentials. Playwright owns its source services and isolated data directory; locally it uses installed Edge, while CI installs Chromium.

The frozen-runtime test runs outside the checkout, verifies missing-key live behavior, authorization, packaged fixtures, a full explicit simulation run, and clean shutdown through the parent pipe. Native GUI bootstrap is verified on Windows; cross-platform build/runtime tests do not imply a full GUI interaction suite on every OS.

General benchmarks use packaged fictional JSON fixtures. New runs save input snapshots, versions, hashes, settings, and outcomes. Change dataset/metric/prompt versions when meaning changes; do not rewrite historical reports to conceal failures. Real Notion content is excluded from committed reports.

## Dependency maintenance

Use npm's lockfile, Cargo.lock, and the Python development/build locks. Update related pins together and run quality, packaging, and frozen smoke checks. GitHub Actions references use immutable commits with release-version comments. Dependabot proposes dependency updates; passing CI is required before release.

PyInstaller includes only the backend package, its dependencies, and packaged fixture data. Credentials, local history, downloaded tools, frozen binaries, and signing material remain ignored. Run the source guard and a private-value scan before the first push.

The packager also preserves an additional CA distrust-data file when the build interpreter's SSL module requires one. This is conditional runtime data, not a provider credential, and certificate verification remains enabled. The frozen smoke test initializes HTTPS through an unused local proxy with a dummy key, so it catches missing TLS resources without sending a request or credential to Google. Playwright sends SIGTERM before forced cleanup on POSIX so the source supervisor can stop its detached children.
