"""Grades `improve-app`: a new `support-system` prompt that follows the handbook on new questions.

1. `prompt_updated`: the latest version of the `support-system` prompt in Phoenix differs
   from the starting prompt.
2. `experiment_recorded`: the `support-questions` dataset has an experiment besides
   `baseline` with successful runs on at least 80% of the baseline's examples.
3. `hidden.<behavior>`: the verifier runs a frozen copy of the app with that prompt
   version on 32 questions the agent never saw and scores each reply with its own checks
   (`support_checks.py`). Each behavior must pass on at least 85% of the questions it
   applies to. The verifier skips this run when check 1 fails.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from harbor_verifiers import evals_state, grading
from harbor_verifiers.phoenix_api import PHOENIX_URL

sys.path.insert(0, str(grading.TESTS_DIR))
import support_checks  # noqa: E402

TRUTH = grading.load_test_json("truth.json")
MIN_PASS_RATE = 0.85
MIN_EXPERIMENT_COVERAGE = 0.8

checks: dict[str, bool] = {}
details: dict[str, Any] = {}


def message_texts(messages: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """Returns each message's role and text, with whitespace collapsed."""
    texts = []
    for message in messages:
        content = message.get("content")
        if isinstance(content, list):
            content = "\n".join(str(part.get("text", "")) for part in content)
        texts.append((str(message.get("role")), re.sub(r"\s+", " ", str(content or "")).strip()))
    return texts


def frozen_app() -> Any:
    path = grading.TESTS_DIR / "app" / "support_app.py"
    spec = importlib.util.spec_from_file_location("frozen_support_app", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def grade_experiments() -> None:
    dataset = evals_state.dataset_id(TRUTH["dataset"])
    experiments = evals_state.dataset_experiments(dataset) if dataset else []
    baseline = next((e for e in experiments if e.name == "baseline"), None)
    examples = baseline.example_ids if baseline else frozenset()
    coverage = {
        experiment.name or experiment.id: len(
            examples & {run.example_id for run in experiment.runs if not run.error}
        )
        / max(len(examples), 1)
        for experiment in experiments
        if experiment is not baseline
    }
    checks["experiment_recorded"] = any(c >= MIN_EXPERIMENT_COVERAGE for c in coverage.values())
    details["experiments"] = {name: round(c, 2) for name, c in coverage.items()}


def grade_hidden(version: Any) -> None:
    app = frozen_app()
    cases = TRUTH["hidden"]

    def run(case: dict[str, Any]) -> dict[str, Any]:
        try:
            reply = support_checks.retry(
                lambda: app.answer(case["question"], case["customer_id"], prompt=version)
            )
        except Exception as error:
            reply = ""
            details.setdefault("app_errors", []).append(f"{case['case_id']}: {error!r}"[:300])
        context = app.build_context(case["question"], case["customer_id"])
        verdicts = support_checks.score(case, reply, context, TRUTH["policy_ids"])
        return {"case_id": case["case_id"], "reply": reply, "verdicts": verdicts}

    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(run, cases))
    rates = {}
    for behavior in support_checks.BEHAVIORS:
        passed = [r["verdicts"][behavior][0] for r in results if behavior in r["verdicts"]]
        rates[behavior] = sum(passed) / len(passed)
        checks[f"hidden.{behavior}"] = rates[behavior] >= MIN_PASS_RATE
    details["hidden_pass_rates"] = {b: round(rate, 3) for b, rate in rates.items()}
    details["hidden_failures"] = {
        r["case_id"]: {b: why[:300] for b, (ok, why) in r["verdicts"].items() if not ok}
        for r in results
        if not all(ok for ok, _ in r["verdicts"].values())
    }
    details["hidden_replies"] = {r["case_id"]: r["reply"][:1200] for r in results}


def main() -> None:
    from phoenix.client import Client

    try:
        version = Client(base_url=PHOENIX_URL).prompts.get(prompt_identifier=TRUTH["prompt"])
        latest = evals_state.get_json(f"/v1/prompt_versions/{version.id}")
        messages = (latest or {}).get("data", {}).get("template", {}).get("messages", [])
    except ValueError:
        version, messages = None, []
    starting = message_texts(TRUTH["starting_messages"])
    checks["prompt_updated"] = bool(messages) and message_texts(messages) != starting
    details["prompt_version"] = {"id": getattr(version, "id", None), "messages": messages}
    grade_experiments()
    if checks["prompt_updated"]:
        grade_hidden(version)
    else:
        for behavior in support_checks.BEHAVIORS:
            checks[f"hidden.{behavior}"] = False
        details["hidden"] = "skipped: the prompt is unchanged or missing"
    grading.finish(checks, details)


main()
