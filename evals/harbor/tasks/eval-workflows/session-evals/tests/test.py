"""Grades `session-evals`: both labels on the production, new, and continued sessions."""

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from harbor_verifiers import grading, judge_prompts
from harbor_verifiers.phoenix_api import PHOENIX_URL

EXPECTED = grading.load_test_json("expected.json")
GRADING_DATA = grading.load_test_json("grading_data.json")
PROJECT = EXPECTED["project"]
NEW = GRADING_DATA["new_sessions"]
CONTINUED = GRADING_DATA["continued_sessions"]
RERUN = "python evals/session_evals.py"
CONTINUATION_WINDOW = timedelta(seconds=90)

# Inputs to the reported prompt_quality measure, which never changes the reward.
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
details: dict[str, Any] = {}


def grade(check: str, labels: dict[str, dict[str, Any]]) -> None:
    """Passes `check` when both annotations agree with `labels` on each class."""
    spans = grading.project_spans(PROJECT)
    details[check] = {}
    for criterion in EXPECTED["annotations"]:
        predictions = grading.session_predictions(PROJECT, criterion, spans)
        result = grading.agreement(predictions, {s: v[criterion] for s, v in labels.items()})
        details[check][criterion] = result.as_dict()
        details[check][criterion]["passes"] = result.passes(
            EXPECTED["min_recall"], EXPECTED["min_coverage"]
        )
    checks[check] = all(part["passes"] for part in details[check].values())


def continue_sessions(spans: list[dict[str, Any]], after: datetime) -> None:
    """Logs new turns of existing sessions between `after` and now, so they're newer than
    every annotation the agent wrote before `after`."""
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
grade("production_sessions", GRADING_DATA["production_sessions"])
seen_spans = grading.project_spans(PROJECT)
# One call keeps turns in order, because the shift to now moves all its spans together.
grading.inject_spans(PROJECT, NEW["spans"])
continue_sessions(CONTINUED["spans"], after=started)
# The nightly job's key can only call the pinned model, so the rerun refuses any other.
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_sessions", NEW["labels"])
grade("continued_sessions", CONTINUED["labels"])
# A continued session's earlier turns belong in the rerun's prompts, so they don't count as copied.
session_of = grading.session_of_traces(seen_spans)
earlier_turns = [
    span
    for span in seen_spans
    if session_of.get(span["context"]["trace_id"]) in CONTINUED["labels"]
]
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(
        seen_spans, NEW["spans"] + CONTINUED["spans"] + earlier_turns
    ),
)
grading.finish(checks, details, measures)
