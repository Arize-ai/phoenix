"""Nightly grounding check for the support bot.

Runs from /app every night:

    python evals/nightly_grounding.py

For every trace in the `support-bot` project, an LLM judge checks each claim in the
bot's reply against what the bot looked up for that message: the order record, the
tracking data, and the help center articles. The verdict is logged as a `grounded` span
annotation (`pass` or `fail`) on the trace's root span, and the script prints the
grounded rate. Replies the judge can't score are left unannotated and reported, and
the script exits with status 1.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from openai import OpenAI
from phoenix.client import Client

PROJECT = "support-bot"
ANNOTATION = "grounded"
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "gpt-5-nano")
ATTEMPTS = 3

JUDGE_PROMPT = """You check a reply from Larkspur Home's customer support bot for claims \
that aren't backed by what the bot looked up.

Larkspur Home is an online home-goods store. Its support bot answers customers' chat \
messages and emails about order status, tracking, delivery dates, and address changes. \
Before replying, it looks up the order, the carrier's tracking data once the order has \
shipped, and help center articles. It should state only what those lookups say.

For this message, the bot looked up the information below: tool results (the order record \
and carrier tracking data) and help center articles. A claim is grounded only if this \
information states it or directly implies it. Dates, delivery estimates, tracking events, \
order status, policies, fees, refunds, credits, and actions the bot says it took or will \
take all count as claims. Greetings, apologies, sign-offs, and restating the customer's \
message are not claims.

[BEGIN LOOKED-UP INFORMATION]
{context}
[END LOOKED-UP INFORMATION]

[BEGIN CUSTOMER MESSAGE]
{question}
[END CUSTOMER MESSAGE]

[BEGIN BOT REPLY]
{reply}
[END BOT REPLY]

Is every claim in the reply grounded in the looked-up information? Answer PASS if it is \
or FAIL if any claim isn't, followed by a colon and a one-sentence reason that names the \
unsupported claim, if any."""

VERDICT = re.compile(r"^\W*(pass|fail)\b", re.IGNORECASE)

llm = OpenAI()


def question_of(root: dict[str, Any]) -> str:
    """Returns the customer's message from a chat or email payload."""
    raw = str((root.get("attributes") or {}).get("input.value") or "")
    try:
        payload = json.loads(raw)
    except ValueError:
        return raw
    if not isinstance(payload, dict):
        return raw
    if "message" in payload:
        return str(payload["message"])
    if "body" in payload:
        return f"Subject: {payload.get('subject', '')}\n\n{payload['body']}"
    return raw


def readable(value: Any) -> str:
    """Returns a span attribute as compact JSON when it holds JSON, else as plain text."""
    try:
        return json.dumps(json.loads(str(value)))
    except ValueError:
        return str(value)


def lookups_of(spans: list[dict[str, Any]]) -> str:
    """Returns the tool results and retrieved articles in a trace, in call order."""
    sections: list[str] = []
    for span in sorted(spans, key=lambda s: s["start_time"]):
        attributes = span.get("attributes") or {}
        if span.get("span_kind") == "TOOL":
            name = attributes.get("tool.name") or span["name"]
            result = attributes.get("output.value") or span.get("status_message") or ""
            sections.append(
                f"Tool call: {name}\n"
                f"Arguments: {readable(attributes.get('input.value') or '')}\n"
                f"Result: {readable(result)}"
            )
        elif span.get("span_kind") == "RETRIEVER":
            index = 0
            while f"retrieval.documents.{index}.document.content" in attributes:
                content = attributes[f"retrieval.documents.{index}.document.content"]
                sections.append(f"Help center article {index + 1}:\n{content}")
                index += 1
    return "\n\n".join(sections)


def ask_judge(context: str, question: str, reply: str) -> str:
    prompt = JUDGE_PROMPT.format(context=context, question=question, reply=reply)
    response = llm.chat.completions.create(
        model=JUDGE_MODEL, messages=[{"role": "user", "content": prompt}]
    )
    return (response.choices[0].message.content or "").strip()


def score(trace: list[dict[str, Any]]) -> tuple[str, dict[str, Any] | None, str]:
    """Returns the root span ID, the annotation result (None if unscored), and any error."""
    root = next(span for span in trace if not span.get("parent_id"))
    span_id = root["context"]["span_id"]
    reply = str((root.get("attributes") or {}).get("output.value") or "")
    children = [span for span in trace if span is not root]
    error = ""
    for _ in range(ATTEMPTS):
        try:
            answer = ask_judge(lookups_of(children), question_of(root), reply)
        except Exception as exception:
            error = f"{type(exception).__name__}: {exception}"
            continue
        match = VERDICT.match(answer)
        if match is None:
            error = f"Unrecognized verdict: {answer[:80]!r}"
            continue
        passed = match.group(1).lower() == "pass"
        result = {
            "label": "pass" if passed else "fail",
            "score": float(passed),
            "explanation": answer,
        }
        return span_id, result, ""
    return span_id, None, error


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
    spans = client.spans.get_spans(project_identifier=PROJECT, limit=1_000_000)
    traces: dict[str, list[dict[str, Any]]] = {}
    for span in spans:
        traces.setdefault(span["context"]["trace_id"], []).append(dict(span))
    complete = [t for t in traces.values() if any(not s.get("parent_id") for s in t)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [r for r in pool.map(retrying(score), complete) if r is not None]
    annotations = [
        {"span_id": span_id, "name": ANNOTATION, "annotator_kind": "LLM", "result": result}
        for span_id, result, _ in results
        if result is not None
    ]
    if annotations:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    grounded = sum(a["result"]["label"] == "pass" for a in annotations)
    rate = grounded / len(annotations) if annotations else 0.0
    print(
        f"Scored {len(annotations)} of {len(complete)} replies: {grounded} grounded ({rate:.0%})."
    )
    failures = [(span_id, error) for span_id, result, error in results if result is None]
    for span_id, error in failures:
        print(f"Not scored: span {span_id}: {error}", file=sys.stderr)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
