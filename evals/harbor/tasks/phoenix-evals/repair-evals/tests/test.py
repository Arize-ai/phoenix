"""Grades `repair-evals`: the repaired nightly script's `grounded` annotations are right.

1. On the 58 graded production traces, the latest `grounded` annotation must cover at
   least 95% of traces and catch at least 80% of grounded and of ungrounded replies.
2. The verifier adds 28 new traces the agent never saw, runs
   `python evals/nightly_grounding.py` as the agent user, and applies the same bar to
   the new traces.
"""

from harbor_verifiers import grading

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
ANNOTATION = "grounded"
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
RERUN = "python evals/nightly_grounding.py"

checks: dict[str, bool] = {}
details: dict = {}


def grade(cohort: str, labels: dict[str, bool]) -> None:
    predictions = grading.trace_predictions(PROJECT, ANNOTATION)
    result = grading.agreement(predictions, labels)
    checks[f"{cohort}.{ANNOTATION}"] = result.passes(MIN_RECALL, MIN_COVERAGE)
    details[f"{cohort}.{ANNOTATION}"] = result.as_dict()


grade("production", TRUTH["visible"])
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
details["rerun"] = grading.run_as_agent(RERUN, timeout=900).as_dict()
grade("new_traces", TRUTH["unseen"]["labels"])
grading.finish(checks, details)
