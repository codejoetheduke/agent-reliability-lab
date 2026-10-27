# Install and use the private preview

## Choose the right installer

Download from the private GitHub Releases page while signed into an account that can access the repository. Choose Windows x64, macOS Apple Silicon, macOS Intel, or Linux x64. Check the asset's SHA-256 against the corresponding checksum file. macOS builds are ad-hoc signed for private testing, not Apple-notarized; Windows builds are unsigned. A public trusted distribution needs the signing setup described in releasing.md. Do not bypass an operating-system security block; use a properly signed build or build from source in your development environment.

Installed packages include the Python service. Open the installed app normally; it starts and stops its own local service. No command prompt or separate backend process is needed. Keep internet access available for Notion and Gemini; all experiment history remains on the computer.

## Configure your own providers

Create a private JSON file in your home directory:

- Windows: `%USERPROFILE%\.agent-reliability-lab\credentials.json`
- macOS/Linux: `~/.agent-reliability-lab/credentials.json`

Use the placeholder JSON in the root README. Values must be strings. Restrict file access to your user account. The key file is currently private JSON, not an OS credential vault; this is a private-preview boundary.

Create a Gemini API key in Google AI Studio for your own project. Set `GEMINI_API_KEY` and a model available to that project, initially `gemini-3.5-flash-lite`. Availability, free-tier eligibility, rate limits, and data use depend on Google and your project. No shared developer key is distributed.

For Notion, create/use an internal connection with read-content capability, share the intended fictional test root with that connection, and set `NOTION_API_KEY` plus `NOTION_ROOT_PAGE_IDS`. Multiple roots are comma-separated UUIDs. Internal tokens are for private authorized workspaces, not a public OAuth sign-in flow.

Environment variables override the private file. `LAB_CREDENTIALS_FILE` selects another private file; an empty value disables file loading. The app does not automatically load .env files. Return to Settings after changing configuration, or restart the app to refresh every status indicator.

## First live query

1. Open Settings. Confirm Gemini is configured and run the Notion connection check.
2. Open Agent Playground. The default provider is Gemini; selected Notion pages are the default source when configured.
3. Inspect selected pages. This reads only the selected roots and supported contained descendants.
4. Grant consent for the submitted question and retrieved excerpts to be sent to Gemini. Google may use free-tier submissions to improve its products; use permitted test content.
5. Ask about something the inspected pages actually contain. Select a citation to inspect its supporting source excerpt.
6. For missing or contradictory information, expect abstention or an error, not a simulated answer.

The currently selected development root contains one short purpose paragraph. A purpose question is a valid first demo; it cannot support fictional budgets or project deadlines until you add such material. The optional `demo-notion-workspace.md` provides fictional content you can import or paste into your selected root. Importing is your explicit Notion operation; the app never writes it automatically.

To try the bundled fictional examples, select Synthetic workspace and ask “Who owns Atlas?” This still uses real Gemini when Gemini is selected. “Synthetic source” and “simulated provider” are different choices.

## Evaluate and inspect

Open Evaluations, keep Gemini selected, select the versioned dataset, enter a label, grant transmission consent, and start the run. Cases run sequentially and persist as they finish. Gemini requests are paced by default to reduce free-tier rate-limit errors; a full run takes a few minutes. A quota/configuration error stops the run with an explanation.

Inspect the run to see expected criteria, exact outputs, citations, raw action controls, timing, and denominators. General evaluation always uses fictional fixtures, never your Notion pages. Four injected faults and five isolated action controls are identified separately from real hosted calls.

Open Model Comparison after two completed compatible runs exist. Dataset/fixture hashes, metric/prompt versions, retrieval k, pacing/timeout settings, and simulation status must match. Model choice may differ. A changed prompt version intentionally causes incompatibility. Intervals are descriptive, not significance tests.

## Data and shutdown

Installed SQLite history is under the OS application-data directory for `dev.agentreliability.lab`. Source-development history defaults to `.local/history.sqlite3`. These are separate stores. Run History has confirmed deletion; active runs prevent deletion. Simulation tasks have a separate reset.

Notion records remain in bounded memory, with an explicit Settings cache-clear control. Notion conversation text is not inserted into evaluation history. Closing the application clears its cache and stops the bundled service. Restart marks unfinished runs interrupted instead of silently rerunning API calls.

## Troubleshooting

| Symptom                      | Check                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Gemini needs a key           | Private JSON location, spelling, string values, environment overrides                              |
| Invalid API key              | Use a Gemini key accepted by Google AI Studio; an OpenAI key cannot authenticate Gemini            |
| Rate/quota error             | Your project's model limits; wait or adjust pacing rather than repeatedly rerunning                |
| Notion 404/permission error  | Share the exact selected root with the internal connection                                         |
| No supporting evidence       | Inspect page content, simplify wording, and confirm the fact is actually documented                |
| Backend unavailable          | Restart the app; check platform/runtime prerequisites and the packaged-sidecar verification record |
| Source browser port occupied | Stop your previous source launcher; installed builds use their own ephemeral ports                 |
