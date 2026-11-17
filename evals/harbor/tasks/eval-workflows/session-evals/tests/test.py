"""Grades `session-evals`: `task_completed` and `honest` on every session, old and new.

1. Each annotation must cover at least 95% of the 40 sessions in the fixture and catch
   at least 80% of passing and of failing sessions. Annotations count on the session or
   on any trace or span in it; the latest one wins.
2. The verifier adds 25 new sessions the agent never saw, and new turns to 16 sessions
   the agent already scored, then runs the agent's nightly entry point. It applies the
   same bar to the new sessions and to the continued ones, whose labels now cover the
   new turns as well.
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from harbor_verifiers import grading, judge_prompts
from harbor_verifiers.phoenix_api import PHOENIX_URL

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
CRITERIA = ("task_completed", "honest")
MIN_RECALL = 0.8
MIN_COVERAGE = 0.95
# The nightly key can only call this model, so the rerun refuses any other.
RERUN = "python evals/session_evals.py"
# How long the continued turns spread over. They all arrive after the verifier starts.
CONTINUATION_WINDOW = timedelta(seconds=90)

# Reported beside the reward, never part of it. See `judge_prompts`.
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


def continue_sessions(spans: list[dict[str, Any]], after: datetime) -> None:
    """Logs new turns of existing sessions, timed between `after` and now.

    Every annotation the agent wrote is older than `after`, so a script that rescores
    sessions whose latest turn is newer than their annotations sees these turns as new.
    The turns keep their session IDs and their order, and start in the last 6 hours like
    the rest of the new traffic.
    """
    from phoenix.client import Client

    time.sleep(max(0.0, (after + CONTINUATION_WINDOW - datetime.now(timezone.utc)).total_seconds()))
    end = datetime.now(timezone.utc)
    shifted = grading.shift_to_now(spans, end=end, window=end - after - timedelta(seconds=2))
    Client(base_url=PHOENIX_URL).spans.log_spans(project_identifier=PROJECT, spans=shifted)
    wanted = {span["context"]["span_id"] for span in spans}
    deadline = time.monotonic() + 120
    while not wanted <= {span["context"]["span_id"] for span in grading.project_spans(PROJECT)}:
        if time.monotonic() > deadline:
            raise TimeoutError("the continued turns were not stored")
        time.sleep(1)


started = datetime.now(timezone.utc)
grade("production", TRUTH["visible"])
seen_spans = grading.project_spans(PROJECT)
# One call keeps every turn of a session in order: the shift to now moves all spans together.
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
continue_sessions(TRUTH["continued"]["spans"], after=started)
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_sessions", TRUTH["unseen"]["labels"])
grade("continued_sessions", TRUTH["continued"]["labels"])
# A continued session's earlier turns belong in the rerun's prompts, so they don't count as copied.
session_of = grading.session_of_traces(seen_spans)
earlier_turns = [
    span
    for span in seen_spans
    if session_of.get(span["context"]["trace_id"]) in TRUTH["continued"]["labels"]
]
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(
        seen_spans, TRUTH["unseen"]["spans"] + TRUTH["continued"]["spans"] + earlier_turns
    ),
)
grading.finish(checks, details, measures)
