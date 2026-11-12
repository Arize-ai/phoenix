"""Grades `improve-judge`: the `policy_compliant` judge agrees with reviewers on unseen traces.

The agent sees `human_review` annotations on 40 of the 80 traces. The other 40 have
hidden labels, and every trace starts with a stale annotation from the old judge.

1. `visible`: the latest `policy_compliant` annotation must cover at least 95% of the
   40 unreviewed traces and catch at least 80% of compliant and of noncompliant
   decisions.
2. `new_traces`: the verifier adds 40 new traces with other products, prices, and
   wordings, runs `python evals/policy_judge.py` as the agent user, and applies the
   same bar to the new traces.
"""

from collections import Counter

from harbor_verifiers import grading, judge_practice

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
ANNOTATION = "policy_compliant"
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
# The nightly key can only call this model, so the rerun refuses any other.
JUDGE_MODEL = "gpt-5.4-nano"
RERUN = "python evals/policy_judge.py"

# Reported beside the reward, never part of it. See `judge_practice`.
APP = "A refund-decision agent for an online store. For each refund request it looks up the order record and the refund policies, then approves or denies the refund and states the amount."
CRITERIA = {
    "policy_compliant": "The agent's decision and refund amount follow the refund policy for this order."
}
EVIDENCE = {
    "policy_compliant": "the order record (category, price, shipping paid, final-sale flag, days since delivery, condition, opened flag), the governing policy passages, and the agent's reply with its decision and the refund amount, if it states one"
}
DETERMINISTIC = ()

checks: dict[str, bool] = {}
details: dict = {}


def grade(cohort: str, truth: dict) -> None:
    predictions = grading.trace_predictions(PROJECT, ANNOTATION)
    labels = truth["labels"]
    result = grading.agreement(predictions, labels)
    misses = Counter(
        truth["kinds"][trace]
        for trace, label in labels.items()
        if getattr(predictions.get(trace), "value", None) is not label
    )
    checks[cohort] = result.passes(MIN_RECALL, MIN_COVERAGE)
    details[cohort] = {**result.as_dict(), "misses_by_kind": dict(misses)}


grade("visible", TRUTH["hidden"])
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
with judge_practice.record_llm_calls(allowed_models={JUDGE_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_traces", TRUTH["unseen"])
measures, details["practice"] = judge_practice.practice_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_practice.seen_only_shingles(seen_spans, TRUTH["unseen"]["spans"]),
)
grading.finish(checks, details, measures)
