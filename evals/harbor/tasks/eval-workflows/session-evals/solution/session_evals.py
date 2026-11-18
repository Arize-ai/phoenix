"""Scores order-agent sessions for task completion and honesty, and logs both per session.

The judges read every turn with its tool results, because a final "thanks!" says nothing
about whether the cancellation went through. Sessions with a turn newer than their
annotations are rescored, because a customer who comes back can change either label.
Other sessions keep their annotations, so the nightly job pays only for conversations
that changed.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
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

llm = LLM(provider="openai", model="gpt-5-nano")
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


def load_turns(client: Client) -> dict[str, list[Trace]]:
    """Returns each session's traces, oldest turn first."""
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


def scored_at(client: Client, session_ids: list[str]) -> dict[str, dict[str, datetime]]:
    """Returns when each of this script's annotations was last updated, by session and name."""
    scored: dict[str, dict[str, datetime]] = {}
    for start in range(0, len(session_ids), 100):
        params: dict[str, Any] = {
            "session_ids": session_ids[start : start + 100],
            "include_annotation_names": list(NAMES),
            "limit": 1000,
        }
        while True:
            # The client has no method that reads session annotations, so use its HTTP session.
            response = client._client.get(
                f"v1/projects/{PROJECT}/session_annotations", params=params, timeout=60
            )
            response.raise_for_status()
            body = response.json()
            for row in body["data"]:
                updated = datetime.fromisoformat(row["updated_at"])
                names = scored.setdefault(row["session_id"], {})
                names[row["name"]] = max(updated, names.get(row["name"], updated))
            if not body.get("next_cursor"):
                break
            params["cursor"] = body["next_cursor"]
    return scored


def sessions_to_score(client: Client) -> set[str]:
    """Returns sessions missing an annotation or with a turn that ended after their oldest
    annotation."""
    sessions = client.sessions.list(project_name=PROJECT, timeout=60)
    scored = scored_at(client, [str(session["session_id"]) for session in sessions])
    todo = set()
    for session in sessions:
        session_id = str(session["session_id"])
        annotated = scored.get(session_id, {})
        ended = datetime.fromisoformat(session["end_time"])
        if set(NAMES) - set(annotated) or ended > min(annotated.values()):
            todo.add(session_id)
    return todo


def transcript(turns: list[Trace]) -> str:
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
    """Skips an item after 3 failed attempts, so one stuck API call doesn't lose the
    whole nightly run."""

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
    turns_of = load_turns(client)
    stale = sessions_to_score(client)
    todo = {session: turns for session, turns in turns_of.items() if session in stale}
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
    print(f"Scored {len(results)} new or continued sessions. Failing per annotation: {failing}")


if __name__ == "__main__":
    main()
