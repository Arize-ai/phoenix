"""Record the baseline experiment's outputs and evaluations in `fixture/baseline.json`.

Runs the app with the starting prompt on every development question, scores each reply
with the verifier's checks, and caches the results so `build.py` stays deterministic.
This makes about 70 model calls. Run it from the repository root with model keys:

    PYTHONPATH=evals/harbor/verifiers proj keys --env llm -- \
        uv run python evals/harbor/tasks/phoenix-evals/improve-app/fixture/record_baseline.py
"""

from __future__ import annotations

import importlib.util
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import ModuleType
from typing import Any

HERE = Path(__file__).resolve().parent


def load(name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


build = load("improve_app_build", HERE / "build.py")
build.write_app_files()
app = load("improve_app_support_app", HERE.parent / "workdir" / "support_app.py")
checks = load("improve_app_checks", HERE.parent / "tests" / "support_checks.py")

from phoenix.client.types.prompts import PromptVersion  # noqa: E402

STARTING = PromptVersion(build.STARTING_MESSAGES, model_name=build.MODEL, template_format="NONE")


def record(case: dict[str, Any]) -> dict[str, Any]:
    reply = checks.retry(lambda: app.answer(case["question"], case["customer_id"], STARTING))
    context = app.build_context(case["question"], case["customer_id"])
    verdicts = checks.score(case, reply, context, list(build.POLICY_IDS))
    evaluations: dict[str, Any] = {
        name: {"score": float(passed), "label": "pass" if passed else "fail", "explanation": why}
        for name, (passed, why) in verdicts.items()
    }
    evaluations.setdefault(
        "account_privacy",
        {"label": "not_applicable", "explanation": "The question isn't about an order or account."},
    )
    return {
        "case_id": case["case_id"],
        "question": case["question"],
        "output": reply,
        "evaluations": evaluations,
    }


def main() -> None:
    with ThreadPoolExecutor(8) as pool:
        runs = list(pool.map(record, build.DEV))
    path = HERE / "baseline.json"
    path.write_text(
        json.dumps({"prompt_sha": build.sha(build.STARTING_PROMPT), "runs": runs}, indent=1) + "\n"
    )
    print(f"Wrote {len(runs)} runs to {path}")


if __name__ == "__main__":
    main()
