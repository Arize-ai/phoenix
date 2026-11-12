"""Grades `repair-evals`: the repaired nightly script's `grounded` annotations are right.

1. On the 58 graded production traces, the latest `grounded` annotation must cover at
   least 95% of traces and catch at least 80% of grounded and of ungrounded replies.
2. The verifier adds 28 new traces the agent never saw, runs
   `python evals/nightly_grounding.py` as the agent user, and applies the same bar to
   the new traces.
"""

from harbor_verifiers import grading, judge_practice

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
ANNOTATION = "grounded"
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
RERUN = "python evals/nightly_grounding.py"

# Reported beside the reward, never part of it. See `judge_practice`.
APP = "An order-support bot for an online store. It answers customer chat messages and emails about order status, tracking, delivery dates, and address changes, using an order lookup, carrier tracking, and help center articles."
CRITERIA = {
    "grounded": "Every factual claim in the reply is supported by what the bot looked up: the order record, the tracking data, and the help center articles."
}
EVIDENCE = {
    "grounded": "the customer's message (chat message or email subject and body), the reply, the order record, the help center articles, and the carrier tracking data when the order has shipped"
}
DETERMINISTIC = ()

checks: dict[str, bool] = {}
details: dict = {}


def grade(cohort: str, labels: dict[str, bool]) -> None:
    predictions = grading.trace_predictions(PROJECT, ANNOTATION)
    result = grading.agreement(predictions, labels)
    checks[f"{cohort}.{ANNOTATION}"] = result.passes(MIN_RECALL, MIN_COVERAGE)
    details[f"{cohort}.{ANNOTATION}"] = result.as_dict()


grade("production", TRUTH["visible"])
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
with judge_practice.record_llm_calls() as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_traces", TRUTH["unseen"]["labels"])
measures, details["practice"] = judge_practice.practice_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_practice.seen_only_shingles(seen_spans, TRUTH["unseen"]["spans"]),
)
grading.finish(checks, details, measures)
