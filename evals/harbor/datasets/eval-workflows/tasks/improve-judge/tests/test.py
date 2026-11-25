from collections import Counter
from typing import Any

from harbor_verifiers import grading, judge_prompts

EXPECTED = grading.load_test_json("expected.json")
DATA = grading.load_test_json("grading_data.json")
PROJECT = EXPECTED["project"]
ANNOTATION = "policy_compliant"
RERUN = "python evals/policy_judge.py"

# Context for the `prompt_quality` rubric, which never changes `reward`.
APP = "A refund-decision agent for an online store. For each refund request it looks up the order record and the refund policies, then approves or denies the refund and states the amount."
CRITERIA = {
    "policy_compliant": "The agent's decision and refund amount follow the refund policy for this order."
}
EVIDENCE = {
    "policy_compliant": "the order record (category, price, shipping paid, final-sale flag, days since delivery, condition, opened flag, membership), the governing policy passages, and the agent's reply with its decision and the refund amount, if it states one"
}
DETERMINISTIC = ()

checks: dict[str, bool] = {}
details: dict[str, Any] = {}


def grade(check: str) -> None:
    predictions = grading.trace_predictions(PROJECT, ANNOTATION)
    labels, kinds = DATA[check]["labels"], DATA[check]["kinds"]
    result = grading.agreement(predictions, labels)
    verdicts = {trace: prediction.value for trace, prediction in predictions.items()}
    misses = Counter(kinds[t] for t, label in labels.items() if verdicts.get(t) is not label)
    used = Counter(str(predictions[t].label) for t in labels if t in predictions)
    checks[check] = result.passes(EXPECTED["min_recall"], EXPECTED["min_coverage"])
    details[check] = {**result.as_dict(), "labels_used": dict(used), "misses_by_kind": dict(misses)}


grade("production_traces")
seen_spans = grading.project_spans(PROJECT)
new_spans = DATA["new_traces"]["spans"]
grading.inject_spans(PROJECT, new_spans)
# The request keeps the judge on `gpt-5-nano`, so the rerun refuses any other model.
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_traces")
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(seen_spans, new_spans),
)
grading.finish(checks, details, measures)
