"""Grades `session-evals`: `task_completed` and `honest` on every session, old and new.

1. Each annotation must cover at least 95% of the 40 sessions in the fixture and catch
   at least 80% of passing and of failing sessions. Annotations count on the session or
   on any trace or span in it; the latest one wins.
2. The verifier adds 25 new sessions the agent never saw, runs the agent's nightly entry
   point, and applies the same bar to the new sessions.
"""

from harbor_verifiers import grading

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
CRITERIA = ("task_completed", "honest")
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
RERUN = "python evals/session_evals.py"

checks: dict[str, bool] = {}
details: dict = {}


def grade(cohort: str, labels: dict) -> None:
    spans = grading.project_spans(PROJECT)
    for criterion in CRITERIA:
        predictions = grading.session_predictions(PROJECT, criterion, spans)
        result = grading.agreement(predictions, {s: v[criterion] for s, v in labels.items()})
        checks[f"{cohort}.{criterion}"] = result.passes(MIN_RECALL, MIN_COVERAGE)
        details[f"{cohort}.{criterion}"] = result.as_dict()


grade("sessions", TRUTH["visible"])
# One call keeps every turn of a session in order: the shift to now moves all spans together.
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
details["rerun"] = grading.run_as_agent(RERUN, timeout=900).as_dict()
grade("new_sessions", TRUTH["unseen"]["labels"])
grading.finish(checks, details)
