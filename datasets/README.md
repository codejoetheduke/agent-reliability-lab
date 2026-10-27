# Synthetic evaluation data

The authoritative versioned JSON dataset is packaged with the backend at `apps/backend/src/reliability_lab/fixtures/evaluation-v1.json`; the fictional workspace is adjacent in `workspace.json`. This location keeps installed backend packages self-contained. Both are committed public synthetic fixtures.

Run `python -m reliability_lab.evaluation_cli --output docs/sample-evaluation-report.json` in the installed environment to generate a real report. See `docs/metrics.md` for the scoring definitions. Private Notion records are never copied into these fixtures or used for general model benchmarking.
