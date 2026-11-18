"""Grades the agent's experiment and the saved `support-system` prompt on new questions."""

from __future__ import annotations

import importlib.util
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from harbor_verifiers import evals_state, grading, judge_prompts
from harbor_verifiers.phoenix_api import PHOENIX_URL

sys.path.insert(0, str(grading.TESTS_DIR))
import support_checks  # noqa: E402

EXPECTED = grading.load_test_json("expected.json")
GRADING_DATA = grading.load_test_json("grading_data.json")
EVALUATIONS = EXPECTED["evaluations"]

checks: dict[str, bool] = {}
details: dict[str, Any] = {}


def message_texts(messages: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """Returns (role, text) pairs with whitespace collapsed, so reformatting isn't a change."""
    texts = []
    for message in messages:
        content = message.get("content")
        if isinstance(content, list):
            content = "\n".join(str(part.get("text", "")) for part in content)
        texts.append((str(message.get("role")), re.sub(r"\s+", " ", str(content or "")).strip()))
    return texts


def frozen_app() -> Any:
    """Loads the verifier's copy of the app, so edits to `/app` don't change the grade."""
    path = grading.TESTS_DIR / "app" / "support_app.py"
    spec = importlib.util.spec_from_file_location("frozen_support_app", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def grade_experiment() -> None:
    bars = EXPECTED["experiment"]
    dataset = evals_state.dataset_id(EXPECTED["dataset"])
    experiments = evals_state.dataset_experiments(dataset) if dataset else []
    baseline = next((e for e in experiments if e.name == "baseline"), None)
    examples = baseline.example_ids if baseline else frozenset()

    def examples_run(experiment: evals_state.Experiment) -> float:
        succeeded = {run.example_id for run in experiment.runs if not run.error}
        return len(examples & succeeded) / max(len(examples), 1)

    others = [e for e in experiments if e is not baseline]
    complete = [e for e in others if examples_run(e) >= bars["min_examples_run"]]
    graded = complete[-1] if complete else None
    runs = []
    for run in graded.runs if graded else []:
        if run.error:
            continue
        outcomes: dict[str, bool | None] = {}
        for evaluation in run.evaluations:
            if evaluation.error:
                continue
            outcome = support_checks.evaluation_outcome(evaluation.score, evaluation.label)
            if outcome is not None or evaluation.name not in outcomes:
                outcomes[evaluation.name] = outcome
        question = str(run.input.get("question", "")) if isinstance(run.input, dict) else ""
        reply = support_checks.reply_text(run.output)
        runs.append({"question": question, "reply": reply, "outcomes": outcomes})
    parts, why = support_checks.grade_experiment_runs(
        runs,
        EVALUATIONS,
        GRADING_DATA["dev_account_questions"],
        GRADING_DATA["policy_ids"],
        min_evaluated=bars["min_runs_evaluated"],
        min_agreement=bars["min_code_check_agreement"],
    )
    baseline_replies = (
        [support_checks.reply_text(run.output) for run in baseline.runs if not run.error]
        if baseline
        else []
    )
    rates = {
        "baseline": support_checks.code_checked_pass_rates(
            baseline_replies, GRADING_DATA["policy_ids"]
        ),
        "experiment": support_checks.code_checked_pass_rates(
            [run["reply"] for run in runs], GRADING_DATA["policy_ids"]
        ),
    }
    parts = {
        "recorded": graded is not None,
        **parts,
        "beats_baseline": graded is not None
        and all(
            rates["experiment"][name] >= rates["baseline"][name] + bars["min_gain_over_baseline"]
            for name in rates["baseline"]
        ),
    }
    checks["experiment"] = all(parts.values())
    details["experiment"] = {
        "parts": parts,
        "examples_run": {e.name or e.id: round(examples_run(e), 2) for e in others},
        "graded": graded.name if graded else None,
        "evaluations": sorted(graded.evaluator_names()) if graded else [],
        "code_checked_pass_rates": {
            name: {standard: round(rate, 3) for standard, rate in by_standard.items()}
            for name, by_standard in rates.items()
        },
        **why,
    }


def grade_new_questions(version: Any) -> None:
    app = frozen_app()
    errors: list[str] = []

    def run(case: dict[str, Any]) -> dict[str, Any]:
        try:
            reply = support_checks.retry(
                lambda: app.answer(case["question"], case["customer_id"], prompt=version)
            )
        except Exception as error:
            reply = ""
            errors.append(f"{case['case_id']}: {error!r}"[:300])
        context = app.build_context(case["question"], case["customer_id"])
        verdicts = support_checks.score(case, reply, context, GRADING_DATA["policy_ids"])
        return {"case_id": case["case_id"], "reply": reply, "verdicts": verdicts}

    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(run, GRADING_DATA["new_questions"]))
    rates = {}
    for standard in EVALUATIONS:
        passed = [r["verdicts"][standard][0] for r in results if standard in r["verdicts"]]
        rates[standard] = sum(passed) / len(passed)
    checks["new_questions"] = all(
        rate >= EXPECTED["new_questions"]["min_pass_rate"] for rate in rates.values()
    )
    details["new_questions"] = {
        "pass_rates": {standard: round(rate, 3) for standard, rate in rates.items()},
        "failures": {
            r["case_id"]: {s: why[:300] for s, (ok, why) in r["verdicts"].items() if not ok}
            for r in results
            if not all(ok for ok, _ in r["verdicts"].values())
        },
        "replies": {r["case_id"]: r["reply"][:1200] for r in results},
        "app_errors": errors,
    }


def no_overfit(messages: list[dict[str, Any]]) -> float:
    """Returns 0 if the prompt copies text or IDs that only the development examples contain."""
    from phoenix.client import Client

    dataset = Client(base_url=PHOENIX_URL).datasets.get_dataset(dataset=EXPECTED["dataset"])
    dev = [{"input": e["input"], "output": e["output"]} for e in dataset.examples]
    shared = [
        GRADING_DATA["new_questions"],
        GRADING_DATA["launch_messages"],
        (grading.TESTS_DIR / "app" / "policies.md").read_text(),
    ]
    prompt = "\n".join(text for _, text in message_texts(messages))
    runs = judge_prompts.copied_runs(prompt, judge_prompts.seen_only_shingles(dev, shared))
    ids = sorted(i for i in judge_prompts.seen_only_ids(dev, shared) if i in prompt)
    details["copied_examples"] = {"text": runs[:10], "ids": ids}
    return float(not (runs or ids))


def main() -> None:
    from phoenix.client import Client

    try:
        version = Client(base_url=PHOENIX_URL).prompts.get(prompt_identifier=EXPECTED["prompt"])
        latest = evals_state.get_json(f"/v1/prompt_versions/{version.id}")
        messages = (latest or {}).get("data", {}).get("template", {}).get("messages", [])
    except ValueError:
        version, messages = None, []
    launch = message_texts(GRADING_DATA["launch_messages"])
    updated = bool(messages) and message_texts(messages) != launch
    details["prompt_version"] = {
        "id": getattr(version, "id", None),
        "updated": updated,
        "messages": messages,
    }
    grade_experiment()
    if updated:
        grade_new_questions(version)
    else:
        checks["new_questions"] = False
        details["new_questions"] = (
            "skipped: the latest support-system version is missing or matches the launch prompt"
        )
    measures = {"no_overfit": no_overfit(messages)} if messages else {}
    grading.finish(checks, details, measures)


main()
