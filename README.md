# Agent Reliability Lab

A local desktop developer tool for inspectable agent experiments. This implementation is **Milestone 1 only**: Tauri 2, React, strict TypeScript, Vite, Material UI 9 with a Material Design 3 theme, and a separate FastAPI health service. External services, retrieval, AI responses, evaluations, actions, and storage are not implemented yet.

The interface always identifies mock mode. Empty metrics represent unavailable measurements, not simulated benchmark results. The existing `api-keys.txt` was not read or used and is excluded by `.gitignore` and the development server's file policy.

## Prerequisites

- Node.js 24 LTS (tested: 24.8.0) and npm.
- Python 3.11 or newer (tested: 3.12.14), with `venv` and pip.
- Rust stable with the MSVC target on Windows (installed here: 1.89.0).
- Windows: Microsoft C++ Build Tools with **Desktop development with C++**, including MSVC x64/x86 and a Windows SDK; Microsoft Edge WebView2 Runtime.
- Browser smoke tests use installed Microsoft Edge. On another platform install Playwright Chromium and change `channel: 'msedge'` in `playwright.config.ts` to your installed browser or omit it.

Follow the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for macOS and Linux system packages. The shell was created with the [official create-tauri-app tool](https://v2.tauri.app/start/create-project/). Those platforms are unverified.

## Setup on Windows

From this repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\apps\backend[dev]"
npm.cmd ci
```

If `python` resolves to a Windows Store alias, use the full path to your installed Python executable for the first command. No environment activation is needed. The Python launcher `py` on the current development machine does not find an interpreter; setup was tested using an explicit Python 3.12 executable.

`apps/backend/requirements-dev.lock` records the actual tested Python dependency versions. For a repeatable development install:

```powershell
.\.venv\Scripts\python.exe -m pip install -r apps/backend/requirements-dev.lock
.\.venv\Scripts\python.exe -m pip install --no-deps -e apps/backend
```

On macOS/Linux use `python3 -m venv .venv`, `.venv/bin/python`, and `npm` in the equivalent commands.

## Run locally

```powershell
npm.cmd run dev
```

The launcher checks that ports 8765 and 1420 are free, starts the backend on **127.0.0.1 only**, waits for a valid mock-mode health response, then runs Tauri. Tauri starts Vite on `http://127.0.0.1:1420`. Closing the desktop process or pressing Ctrl+C stops processes owned by the launcher. Existing services are never reused or terminated. An occupied port fails with a clear message.

You can verify the frontend and backend without native build tools:

```powershell
npm.cmd run dev:web
```

Open `http://127.0.0.1:1420`. The overview should show **MOCK MODE** and **Backend connected**. This browser mode does not prove that the native window works.

For separate terminals (do not also run the combined launcher):

```powershell
.\.venv\Scripts\python.exe -m uvicorn reliability_lab.main:app --host 127.0.0.1 --port 8765 --no-access-log
npm.cmd run dev --workspace apps/desktop
```

Stop both manually when started separately. `GET http://127.0.0.1:8765/health` returns the service identifier, status, mock mode, and version. API documentation is available at `http://127.0.0.1:8765/docs`.

## Build and run production assets locally

```powershell
npm.cmd run build
npm.cmd run build:desktop
npm.cmd run preview:desktop
```

The first command creates the frontend production assets. The second builds the native executable with those assets; `--no-bundle` deliberately avoids generating installers in this milestone. The third runs that executable with the local Python backend. A standalone double-click of the executable does not manage Python. Python is not bundled, so this is a personal development setup, not a distributable application.

The Windows SDK is now installed and the earlier native linker blocker is resolved. `scripts/native.mjs` locates Visual Studio with `vswhere` and loads its developer environment before invoking Tauri, so `npm.cmd run dev` and `npm.cmd run build:desktop` work from a normal terminal. It imports only native toolchain environment settings and does not print them. See `docs/milestone-1.md` for the recorded verification results.

## Checks

```powershell
.\.venv\Scripts\python.exe -m pytest apps/backend/tests -q
.\.venv\Scripts\python.exe -m ruff check apps/backend
.\.venv\Scripts\python.exe -m pip check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

The end-to-end suite owns its backend and Vite processes and uses real HTTP requests. Leave ports 1420 and 8765 free first. It tests desktop, navigation rail, and mobile drawer layouts and writes screenshots to `docs/screenshots/`. Test results are development verification, not agent evaluation results. Some Windows sandboxes block Python subprocesses or Vitest temporary-file renames; use a normal local terminal when that occurs.

## Modules

| Path | Responsibility |
| --- | --- |
| `apps/desktop/src/App.tsx` | Six-section shell and health connection presentation |
| `apps/desktop/src/theme.ts` | Material Design 3 roles, typography, shapes, and component states |
| `apps/desktop/src/App.css` | Adaptive drawer/rail/mobile layout |
| `apps/desktop/src/components/`, `src/pages/` | Shared MUI components, section layouts, and honest empty states |
| `apps/desktop/src/api/client.ts` | Typed health client, runtime validation, four-second timeout |
| `apps/desktop/src/hooks/useHealth.ts` | Connection polling, cancellation, manual retry |
| `apps/desktop/src-tauri/` | Native window, restrictive CSP and minimal capabilities |
| `apps/backend/src/reliability_lab/` | FastAPI health contract, safe errors, host/origin policy |
| `scripts/dev.mjs` | Cross-platform process supervision and startup readiness |
| `scripts/native.mjs` | Windows developer-tool environment setup and Tauri invocation |
| `tests/e2e/` | Real-service browser smoke tests |
| `docs/` | Architecture, privacy boundary, milestone evidence |

See `docs/architecture.md`, `docs/design-system.md`, and `docs/security.md`. Roboto and Material icons are bundled locally; runtime font requests stay local. No credentials are needed, read, returned, or saved by the implementation. `LAB_PYTHON` is the only optional runtime setting and must be an absolute path. `.env.example` documents it; `.env` files are not loaded automatically.

Next is Milestone 2: the synthetic workspace and source-inspection playground, **after the native-window acceptance criteria have passed**.
