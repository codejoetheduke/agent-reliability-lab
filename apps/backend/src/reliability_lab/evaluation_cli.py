"""Generate an actual local synthetic evaluation report."""

import argparse
import asyncio
import json
from pathlib import Path

from reliability_lab.evaluation_service import RunRequest, perform_run, prepare_run
from reliability_lab.storage import get_store


async def run(output: Path, top_k: int):
    store = get_store()
    experiment = await prepare_run(RunRequest(top_k=top_k, label="Documented mock baseline"), store)
    await perform_run(experiment["id"], store)
    result = store.run(experiment["id"])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": result["status"],
                "tests": result["summary"]["tests_completed"],
                "passed": result["summary"]["tests_passed"],
                "output": str(output),
            }
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("docs/sample-evaluation-report.json"))
    parser.add_argument("--top-k", type=int, default=4, choices=range(1, 11))
    arguments = parser.parse_args()
    asyncio.run(run(arguments.output, arguments.top_k))
