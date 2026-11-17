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

TRUTH = grading.load_test_json("truth.json")
MIN_PASS_RATE = 0.85
MIN_EXPERIMENT_COVERAGE = 0.8

checks: dict[str, bool] = {}
details: dict[str, Any] = {}


def message_texts(messages: list[dict[str, Any]]) -> list[tuple[str, str]]:
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

    def coverage(experiment: evals_state.Experiment) -> float:
        succeeded = {run.example_id for run in experiment.runs if not run.error}
        return len(examples & succeeded) / max(len(examples), 1)

    others = [e for e in experiments if e is not baseline]
    complete = [e for e in others if coverage(e) >= MIN_EXPERIMENT_COVERAGE]
    checks["experiment_recorded"] = bool(complete)
    details["experiments"] = {e.name or e.id: round(coverage(e), 2) for e in others}
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
    results, why = support_checks.grade_experiment_runs(
        runs, TRUTH["account_questions"], TRUTH["policy_ids"]
    )
    checks.update(results)
    details["graded_experiment"] = {
        "name": graded.name if graded else None,
        "evaluations": sorted(graded.evaluator_names()) if graded else [],
        **why,
    }


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
        checks[behavior] = rates[behavior] >= MIN_PASS_RATE
    details["hidden_pass_rates"] = {b: round(rate, 3) for b, rate in rates.items()}
    details["hidden_failures"] = {
        r["case_id"]: {b: why[:300] for b, (ok, why) in r["verdicts"].items() if not ok}
        for r in results
        if not all(ok for ok, _ in r["verdicts"].values())
    }
    details["hidden_replies"] = {r["case_id"]: r["reply"][:1200] for r in results}


def no_overfit(messages: list[dict[str, Any]]) -> float:
    """Returns 0 if the prompt copies text or IDs that only the dev examples contain."""
    from phoenix.client import Client

    dataset = Client(base_url=PHOENIX_URL).datasets.get_dataset(dataset=TRUTH["dataset"])
    dev = [{"input": e["input"], "output": e["output"]} for e in dataset.examples]
    shared = [
        TRUTH["hidden"],
        TRUTH["starting_messages"],
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
            checks[behavior] = False
        details["hidden"] = "skipped: the prompt is unchanged or missing"
    measures = {"no_overfit": no_overfit(messages)} if messages else {}
    grading.finish(checks, details, measures)


main()
