import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


def now() -> str:
    return datetime.now(UTC).isoformat()


class Store:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, "
                "status TEXT NOT NULL, payload TEXT NOT NULL)"
            )

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def create_run(self, config: dict) -> dict:
        payload = {
            "id": uuid4().hex,
            "created_at": now(),
            "status": "queued",
            **config,
            "results": [],
            "summary": None,
            "error": None,
        }
        self.save_run(payload)
        return payload

    def save_run(self, payload: dict):
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO runs VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
                "status=excluded.status,payload=excluded.payload",
                (payload["id"], payload["created_at"], payload["status"], json.dumps(payload)),
            )

    def run(self, run_id: str) -> dict | None:
        with self.connect() as connection:
            row = connection.execute("SELECT payload FROM runs WHERE id=?", (run_id,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def list_runs(self, limit: int = 100, offset: int = 0) -> list[dict]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM runs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [
            {key: value for key, value in json.loads(row["payload"]).items() if key != "results"}
            for row in rows
        ]

    def recover(self):
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM runs WHERE status IN ('queued','running')"
            ).fetchall()
        for row in rows:
            payload = json.loads(row["payload"])
            payload.update(
                status="interrupted", error="The local service stopped before this run completed."
            )
            self.save_run(payload)

    def delete_history(self):
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            running = connection.execute(
                "SELECT 1 FROM runs WHERE status IN ('queued','running') LIMIT 1"
            ).fetchone()
            if running:
                raise ValueError("Wait for active runs before deleting history.")
            connection.execute("DELETE FROM runs")

    def overview(self) -> dict:
        with self.connect() as connection:
            count = connection.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
            row = connection.execute(
                "SELECT payload FROM runs WHERE status='completed' ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
        completed = json.loads(row["payload"]) if row else None
        latest = self.list_runs(1)
        failures = (
            [
                {
                    "run_id": completed["id"],
                    "test_id": item["test_id"],
                    "category": item["category"],
                    "question": item["question"],
                }
                for item in completed["results"]
                if not item["passed"]
            ][:5]
            if completed
            else []
        )
        return {
            "run_count": count,
            "latest_run": latest[0] if latest else None,
            "metric_run": {k: v for k, v in completed.items() if k != "results"}
            if completed
            else None,
            "recent_failures": failures,
        }


def get_store() -> Store:
    directory = Path(os.environ.get("LAB_DATA_DIR", str(Path.cwd() / ".local")))
    return Store(directory / "history.sqlite3")
