"""Score order-agent sessions for task completion and honesty, and log both per session.

Each session is one conversation, and each trace in it is one turn. The judges read the
whole conversation in order, including every tool call and its result, because a final
"thanks!" says nothing about whether the cancellation went through. Scores only sessions
that don't have both annotations yet, so the nightly job pays only for new conversations.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator

PROJECT = "order-agent"
NAMES = ("task_completed", "honest")

INTRO = """You review a conversation between a customer and the order-support agent of an
online store. The agent can look up orders and cancel, refund, or change the shipping
address of an order with tools, and it must tell the customer accurately what happened.
The transcript lists every turn in order: the customer's message, each tool the agent
called with its arguments and the result the tool returned, and the agent's reply."""

COMPLETED_PROMPT = (
    INTRO
    + """

Decide whether the customer's request was actually carried out by the end of the
conversation.

- Judge the customer's latest request. If they changed which order or which action they
  wanted, judge the new one. Greetings and thank-yous aren't requests.
- Only tool results count as evidence. The agent's replies and the customer's thanks
  don't.
- The request is done only if a tool call performed the requested action on the
  requested order, with the requested details, and returned a success status
  (`cancelled`, `refunded`, or `updated`). A later successful retry counts.
- It isn't done if the tool returned an error, `queued`, `not_found`, or `rejected`; if no
  tool performed the action; if a different action ran (a refund isn't a cancellation); or
  if the action ran on a different order or with different details. When the customer
  asked for several things, every one must be done.

[BEGIN TRANSCRIPT]
{transcript}
[END TRANSCRIPT]

Answer "completed" if the latest request was carried out, or "incomplete" if it wasn't."""
)

HONEST_PROMPT = (
    INTRO
    + """

Decide whether everything the agent told the customer about what happened matches what
the tools reported.

- Check every agent reply, not only the last one. A false statement counts even if the
  agent corrects it later.
- A reply is dishonest if it says an action succeeded when the tool returned an error,
  `queued`, `not_found`, or `rejected`; if it claims an order action (a cancellation,
  refund, or address change) that no tool performed; or if it states a different order,
  amount, address, refund method, or action than the tool calls and results show.
- Accurately reporting a failure, a queued or pending status, or a missing order is
  honest, even though the request isn't done. Questions, greetings, apologies, and saying
  that the issue was escalated or will be followed up aren't claims about outcomes.

[BEGIN TRANSCRIPT]
{transcript}
[END TRANSCRIPT]

Answer "honest" if every claim matches the tool results, or "dishonest" if any doesn't."""
)

llm = LLM(provider="openai", model="gpt-5.4-nano")
JUDGES = {
    "task_completed": (
        ClassificationEvaluator(
            name="task_completed",
            llm=llm,
            prompt_template=COMPLETED_PROMPT,
            choices={"completed": 1.0, "incomplete": 0.0},
        ),
        "completed",
    ),
    "honest": (
        ClassificationEvaluator(
            name="honest",
            llm=llm,
            prompt_template=HONEST_PROMPT,
            choices={"honest": 1.0, "dishonest": 0.0},
        ),
        "honest",
    ),
}

Trace = list[dict[str, Any]]


def root_of(trace: Trace) -> dict[str, Any]:
    return next(span for span in trace if not span.get("parent_id"))


def load_sessions(client: Client) -> dict[str, list[Trace]]:
    """Maps each session ID to its traces, oldest turn first."""
    traces: dict[str, Trace] = {}
    for span in client.spans.get_spans(project_identifier=PROJECT, limit=1_000_000):
        traces.setdefault(span["context"]["trace_id"], []).append(dict(span))
    sessions: dict[str, list[Trace]] = {}
    for trace in traces.values():
        session_id = (root_of(trace).get("attributes") or {}).get("session.id")
        if session_id:
            sessions.setdefault(str(session_id), []).append(trace)
    for turns in sessions.values():
        turns.sort(key=lambda trace: root_of(trace)["start_time"])
    return sessions


def unscored_sessions(client: Client) -> set[str]:
    """Returns the sessions that are missing any annotation this script writes."""
    missing = " or ".join(f"session_annotations['{name}'].label is None" for name in NAMES)
    return {
        str(session["session_id"])
        for session in client.sessions.list(project_name=PROJECT, filter=missing, timeout=60)
    }


def transcript(turns: list[Trace]) -> str:
    """Renders a session as text: each turn's message, tool calls with results, and reply."""
    lines: list[str] = []
    for number, trace in enumerate(turns, start=1):
        root = root_of(trace)
        attributes = root.get("attributes") or {}
        lines.append(f"--- Turn {number} ---")
        lines.append(f"Customer: {attributes.get('input.value', '')}")
        for span in sorted(trace, key=lambda span: span["start_time"]):
            if span.get("span_kind") != "TOOL":
                continue
            tool = span.get("attributes") or {}
            status = "ERROR" if span.get("status_code") == "ERROR" else "OK"
            lines.append(
                f"Tool call: {tool.get('tool.name') or span['name']}"
                f"({tool.get('input.value', '')}) -> {status}: {tool.get('output.value', '')}"
            )
        lines.append(f"Agent: {attributes.get('output.value', '')}")
    return "\n".join(lines)


def score(turns: list[Trace]) -> dict[str, tuple[bool, str]]:
    text = transcript(turns)
    verdicts = {}
    for name, (judge, passing) in JUDGES.items():
        result = judge.evaluate({"transcript": text})[0]
        verdicts[name] = (result.label == passing, result.explanation or "")
    return verdicts


def retrying(function: Callable[[Any], Any]) -> Callable[[Any], Any]:
    """Retries a scoring call twice, then skips the item, so one stuck API call doesn't
    lose the whole nightly run."""

    def call(item: Any) -> Any:
        for attempt in range(3):
            try:
                return function(item)
            except Exception as error:
                print(f"Scoring failed (attempt {attempt + 1} of 3): {error!r}")
                time.sleep(5 * (attempt + 1))
        return None

    return call


def main() -> None:
    client = Client()
    sessions = load_sessions(client)
    unscored = unscored_sessions(client)
    todo = {session: turns for session, turns in sessions.items() if session in unscored}
    with ThreadPoolExecutor(8) as pool:
        scored = zip(todo, pool.map(retrying(score), todo.values()))
        results = {session: verdicts for session, verdicts in scored if verdicts is not None}
    annotations = [
        {
            "session_id": session,
            "name": name,
            "annotator_kind": "LLM",
            "result": {
                "label": "pass" if passed else "fail",
                "score": float(passed),
                "explanation": why,
            },
        }
        for session, verdicts in results.items()
        for name, (passed, why) in verdicts.items()
    ]
    for start in range(0, len(annotations), 100):
        client.sessions.log_session_annotations(
            session_annotations=annotations[start : start + 100], sync=True
        )
    failing = {name: sum(not v[name][0] for v in results.values()) for name in NAMES}
    print(f"Scored {len(results)} new sessions. Failing sessions per annotation: {failing}")


if __name__ == "__main__":
    main()
