"""Grades `response-evals`: one annotation per requirement, correct on old and new traces.

1. Each requirement's annotation must cover at least 95% of the 60 production traces
   and catch at least 90% of passing and of failing replies (80% for `grounded`).
2. The verifier adds 40 new traces the agent never saw, runs the agent's nightly
   entry point, and applies the same bar to the new traces.
"""

from harbor_verifiers import grading

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
MIN_RECALL = {"valid_format": 0.9, "correct_amount": 0.9, "no_pii_leak": 0.9, "grounded": 0.8}
MIN_COVERAGE = 0.95
RERUN = "python evals/refund_evals.py"

checks: dict[str, bool] = {}
details: dict = {}


def grade(cohort: str, labels: dict) -> None:
    spans = grading.project_spans(PROJECT)
    for criterion, min_recall in MIN_RECALL.items():
        predictions = grading.trace_predictions(PROJECT, criterion, spans)
        result = grading.agreement(predictions, {t: v[criterion] for t, v in labels.items()})
        checks[f"{cohort}.{criterion}"] = result.passes(min_recall, MIN_COVERAGE)
        details[f"{cohort}.{criterion}"] = result.as_dict()


grade("production", TRUTH["visible"])
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
details["rerun"] = grading.run_as_agent(RERUN, timeout=900).as_dict()
grade("new_traces", TRUTH["unseen"]["labels"])
grading.finish(checks, details)
