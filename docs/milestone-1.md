# Milestone 1 — implementation and verification

Date: 2026-10-27. **Status: complete on this Windows development machine.**

The native Tauri application launches with embedded production assets, renders the Material Design 3 interface, shows **MOCK MODE**, and connects to the local FastAPI backend without credentials. No later milestone has been started.

## Implemented

- Official Tauri 2 + React + strict TypeScript + Vite scaffold and separate installable FastAPI package.
- Material UI 9 components with an explicit Material Design 3 light theme, local Roboto fonts and Material icons, tonal surfaces, rounded cards, pill controls, and adaptive drawer/rail/mobile navigation.
- Overview, Agent Playground, Evaluations, Model Comparison, Run History, and Settings with honest empty states and disabled future operations.
- Typed health client, runtime response validation, four-second timeout, cancellation, polling, offline state, and manual retry.
- Loopback-only backend, validated health schema, safe errors, explicit host/origin policy, no external service calls or credential loading.
- Supervised local startup, port-ownership checks, backend readiness checks, and cleanup of owned child processes.
- Automatic Visual Studio developer environment setup for native build/development commands.

## Actual verification

| Check | Result |
| --- | --- |
| Backend pytest | 5 passed |
| Backend Ruff | Passed |
| Frontend Vitest | 5 passed across 2 files |
| TypeScript (frontend and Vite configuration) | Passed |
| ESLint | Passed, no warnings after final fixes |
| Formatting and Node launcher syntax | Passed |
| Playwright with real backend and Microsoft Edge | 3 passed |
| Desktop browser layout | Verified at 1280px, screenshot visually reviewed |
| Compact navigation rail | Verified at 820px, no horizontal overflow |
| Mobile drawer | Verified at 390px: open, Escape dismissal, focus restoration, page selection, no overflow, no external requests |
| Frontend production build | Passed; local font assets included |
| Native Rust release build | Passed after Windows SDK installation |
| `npm.cmd run build:desktop` | Passed through automatic developer-tool environment setup |
| `npm.cmd run preview:desktop` | Passed; Python health readiness followed by native window launch |
| Actual native window | Title and WebView at `http://tauri.localhost/` confirmed; Material UI rendering, mock mode, and **Backend connected** observed |
| Production asset/CSP smoke check | Embedded JavaScript, styles, fonts, and permitted local health request work in WebView2 |
| Shutdown lifecycle | Terminated only the verified project desktop process; supervisor exited and neither port 8765 nor 1420 remained listening |
| Credentials | Existing `api-keys.txt` not read, changed, or used |

Native input automation could not reliably activate the target because other windows/user input interfered. Native rendering and health were verified through the target window's screenshot and accessibility document; navigation was tested in the browser suite. Native adversarial CSP tests, native development HMR, and macOS/Linux execution were not performed.

The application was reopened after the shutdown check for user review. Production preview requires the separately installed Python environment; it is not a standalone distributable installer.

## Issues found and fixed

The initial native attempt failed because Visual Studio was incomplete and the Windows SDK was missing. After the user installed Visual Studio, SDK `10.0.26100.0` became available. Native builds succeed when the developer environment is initialized; `scripts/native.mjs` now performs that initialization automatically without exposing environment values.

The Material UI 9 migration check caught removed layout system props. All affected layout styles were moved to `sx`, clearing both TypeScript errors and React DOM warnings. The tests were strengthened to reject browser console errors. The mobile drawer test also verifies Escape and focus behavior. A React Fast Refresh warning was fixed by keeping navigation data internal to its component module.

Earlier setup encountered sandbox restrictions on Python subprocesses, Vitest temporary-file renames, and loopback sockets. The relevant checks were rerun successfully outside that sandbox. An early Playwright ambiguous text selector was corrected. No test success was fabricated.

## Files and architectural decisions

| Area | Created/modified files |
| --- | --- |
| Root | `.gitignore`, `.env.example`, `.prettierignore`, `.prettierrc.json`, `package.json`, `package-lock.json`, `README.md`, `playwright.config.ts` |
| Launcher | `scripts/dev.mjs`, `scripts/native.mjs` |
| Backend | `apps/backend/pyproject.toml`, `requirements-dev.lock`, `src/reliability_lab/{__init__,main,schemas}.py`, `tests/test_health.py` |
| Desktop design | `apps/desktop/src/theme.ts`, `components/{Navigation,Panel}.tsx`, `pages/{Overview,WorkspacePage}.tsx`, `App.tsx`, `App.css`, `main.tsx` |
| Desktop tooling/tests | `apps/desktop/package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `src/App.test.tsx`, `src/api/{client,client.test}.ts`, `src/hooks/useHealth.ts`, `src/test/setup.ts`, `public/lab.svg`, local README |
| Native | Official `apps/desktop/src-tauri/` scaffold, edited Cargo manifest/entry points/configuration/capabilities, generated Cargo lockfile and icons |
| Verification/docs | `tests/e2e/shell.spec.ts`, `docs/{architecture,security,design-system,milestone-1}.md`, `docs/screenshots/{overview,mobile-settings}.png` |

React owns presentation, the typed client owns the health contract, and FastAPI owns backend validation. Material roles and component defaults live in the theme; responsive layout lives in CSS. Business logic stays outside components. SQLite, providers, retrieval, evaluations, charts, and mutations are deferred until their milestones. A sample agent evaluation report would be premature; this is the actual application verification report.

**Next:** Milestone 2, synthetic workspace retrieval and the source-inspection playground. This requires a separate implementation step; no Notion integration or AI functionality was added here.
