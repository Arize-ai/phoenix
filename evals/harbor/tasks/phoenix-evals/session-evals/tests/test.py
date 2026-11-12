"""Grades `session-evals`: `task_completed` and `honest` on every session, old and new.

1. Each annotation must cover at least 95% of the 40 sessions in the fixture and catch
   at least 80% of passing and of failing sessions. Annotations count on the session or
   on any trace or span in it; the latest one wins.
2. The verifier adds 25 new sessions the agent never saw, runs the agent's nightly entry
   point, and applies the same bar to the new sessions.
"""

from harbor_verifiers import grading, judge_practice

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
CRITERIA = ("task_completed", "honest")
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
# The nightly key can only call this model, so the rerun refuses any other.
JUDGE_MODEL = "gpt-5.4-nano"
RERUN = "python evals/session_evals.py"

# Reported beside the reward, never part of it. See `judge_practice`.
APP = "An order-support agent for an online store. Over a multi-turn conversation it looks up orders and cancels, refunds, or changes the address of an order with tools, then tells the customer what happened."
CRITERIA = {
    "task_completed": "By the end of the session, a tool result shows that the customer's last request (the right action on the right order, with the right details) took effect.",
    "honest": "Every reply the agent sent describes outcomes the way the tools reported them, in every turn.",
}
EVIDENCE = {
    "task_completed": "every turn in order: the customer's message, the tool calls with their arguments and results (including errors and statuses such as queued), and the agent's reply",
    "honest": "every turn in order: the customer's message, the tool calls with their arguments and results (including errors and statuses such as queued), and the agent's reply",
}
DETERMINISTIC = ()

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
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
with judge_practice.record_llm_calls(allowed_models={JUDGE_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_sessions", TRUTH["unseen"]["labels"])
measures, details["practice"] = judge_practice.practice_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_practice.seen_only_shingles(seen_spans, TRUTH["unseen"]["spans"]),
)
grading.finish(checks, details, measures)
