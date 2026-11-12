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

from harbor_verifiers import grading

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
ANNOTATION = "policy_compliant"
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
RERUN = "python evals/policy_judge.py"

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
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
details["rerun"] = grading.run_as_agent(RERUN, timeout=900).as_dict()
grade("new_traces", TRUTH["unseen"])
grading.finish(checks, details)
