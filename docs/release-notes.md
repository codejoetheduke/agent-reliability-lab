# Agent Reliability Lab 0.1.0 — private preview

Live Gemini is the default. The app reads selected Notion test pages, validates evidence excerpts and citations, records synthetic evaluations, and compares compatible model runs.

Included: Windows x64, Linux x64, macOS Apple Silicon, and macOS Intel installers; bundled Python; authenticated ephemeral-port backend; local SQLite history; Material Design 3 UI; no embedded provider keys.

Provide your own Gemini and authorized Notion credentials using the README setup. Gemini free-tier eligibility/quotas/data use depend on your project. No live Notion mutation, public OAuth, or shared API account is included.

This private preview is unsigned on Windows and ad-hoc signed on macOS, without Apple notarization. It is not a trusted public distribution or an officially endorsed Notion product. Use the appropriate signed-build/source workflow if your operating system blocks installation.

Checksum files accompany installer assets. All release targets must pass the quality, frozen-runtime, and native-build workflow before publication.
