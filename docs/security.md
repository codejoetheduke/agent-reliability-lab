# Development security boundary

- The supplied `api-keys.txt` remains untouched. Git ignores it; Vite denies it explicitly and limits filesystem access to the desktop directory and installed frontend dependencies.
- This milestone never initializes credentials or sends workspace content anywhere. Package installation contacts registries; application runtime does not contact providers.
- Backend configuration is never copied into frontend environment variables. Never use `VITE_` variables for secrets.
- The API listens on `127.0.0.1:8765`, exposes read-only health data, checks allowed hosts, and uses an explicit CORS origin list. CORS is a browser policy, not authentication against other local processes.
- No filesystem, shell, opener, or external navigation Tauri plugins are granted. The remaining core capability comes from the standard shell scaffold.
- Content Security Policy permits the local API and Tauri's internal IPC transport; development also allows Vite's local websocket. Fonts are bundled and restricted to the application origin. A native production smoke test verified embedded assets and the permitted health request; adversarial policy tests have not been run.
- Error responses omit exception text, headers, and request values. The custom error event is JSON with fixed non-sensitive fields. Uvicorn's access log is disabled in the launcher.
- No experiment or workspace data is persisted yet. There is no hidden retention store and no deletion control is needed in this milestone. Future SQLite history must add explicit retention/deletion controls.

Before real workspace access: move private development tokens outside the repository, add selected-page scope and backend-only secure credential loading, review Notion permissions and data terms, and explicitly disclose transmission to the configured model. Do not use actual workspace material for general benchmarking without permission.

Before distribution: package and supervise the backend, authenticate frontend/backend requests with per-launch credentials, defend against port races and other local clients, use OS credential storage, implement a supported public OAuth flow, sign binaries, provide signed updates, and review all Tauri capabilities. No real mutation endpoints may be added without confirmation, authorization, audit outcomes, and duplicate-execution safeguards.

The development launcher checks ports before binding, but another process could bind between the check and startup. Its readiness response fingerprint reduces accidental service confusion and does not provide authentication. A hard termination of the launcher can bypass JavaScript shutdown handlers; normal close/Ctrl+C paths are intended to clean up owned processes. Browser test teardown also terminates its owned process tree.
