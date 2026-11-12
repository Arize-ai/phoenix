"""Score refund-bot replies against SPEC.md and log one annotation per requirement.

Scores every trace in the `refund-bot` project that doesn't have a `grounded`
annotation yet, so the nightly job only pays for new traffic.
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator

PROJECT = "refund-bot"
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b")
AMOUNT = re.compile(r"""["']refund_amount["']\s*:\s*["']?\$?\s*([0-9]+(?:\.[0-9]+)?)""")
MESSAGE = re.compile(r"""["']message["']\s*:\s*["'](.*?)["']\s*[,}]""", re.S)

GROUNDED_PROMPT = """You check one reply from a refund-support bot for an online store. For each refund
request, the bot looks up the customer's order record, searches the refund policies, and
finds similar past tickets, then writes a message to the customer. The message must not
state anything the bot didn't look up.

How to judge:
- Go through the message sentence by sentence. For each factual claim, find the part of
  the looked-up information that states it or directly implies it.
- A claim with no source is unsupported, even if it sounds reasonable or nothing in the
  information contradicts it.
- Claims include refund amounts and fees, timelines and how fast money arrives, credits,
  shipping, what the customer must or needn't do (such as sending the item back), and
  actions the bot says it took.
- Greetings, thanks, and restating the customer's request aren't claims.
- Only judge support. Whether the message should share a detail, such as another
  customer's contact information, is a separate check.

[BEGIN LOOKED-UP INFORMATION]
{context}
[END LOOKED-UP INFORMATION]

[BEGIN MESSAGE]
{message}
[END MESSAGE]

Answer "grounded" if every claim in the message has a source in the looked-up
information, or "ungrounded" if any claim doesn't."""

judge = ClassificationEvaluator(
    name="grounded",
    llm=LLM(provider="openai", model="gpt-5.4-nano"),
    prompt_template=GROUNDED_PROMPT,
    choices={"grounded": 1.0, "ungrounded": 0.0},
)


def parse_strict(reply: str) -> dict[str, Any] | None:
    try:
        value = json.loads(reply)
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def valid_format(reply: str) -> bool:
    value = parse_strict(reply)
    return (
        value is not None
        and isinstance(value.get("refund_amount"), (int, float))
        and not isinstance(value.get("refund_amount"), bool)
        and isinstance(value.get("message"), str)
    )


def amount_of(reply: str) -> float | None:
    value = parse_strict(reply)
    if value is not None:
        raw = value.get("refund_amount")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            return float(raw)
    match = AMOUNT.search(reply)
    return float(match.group(1)) if match else None


def message_of(reply: str) -> str:
    value = parse_strict(reply)
    if value is not None and isinstance(value.get("message"), str):
        return str(value["message"])
    match = MESSAGE.search(reply)
    return match.group(1) if match else reply


def leaks(message: str, own_email: str) -> bool:
    emails = {e.lower().rstrip(".") for e in EMAIL.findall(message)}
    return bool(emails - {own_email.lower()}) or bool(PHONE.search(message))


def lookups(spans: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str], list[Any]]:
    order: dict[str, Any] = {}
    policies: list[str] = []
    similar: list[Any] = []
    for span in spans:
        attributes = span.get("attributes") or {}
        name = attributes.get("tool.name") or span["name"]
        if name == "get_order":
            order = json.loads(attributes.get("output.value") or "{}")
        elif name == "find_similar_tickets":
            similar = json.loads(attributes.get("output.value") or "[]")
        elif span["span_kind"] == "RETRIEVER":
            index = 0
            while f"retrieval.documents.{index}.document.content" in attributes:
                policies.append(attributes[f"retrieval.documents.{index}.document.content"])
                index += 1
    return order, policies, similar


def score(trace: list[dict[str, Any]]) -> tuple[str, dict[str, tuple[bool, str]]]:
    root = next(span for span in trace if not span.get("parent_id"))
    reply = str((root.get("attributes") or {}).get("output.value") or "")
    order, policies, similar = lookups(trace)
    message = message_of(reply)
    amount = amount_of(reply)
    expected = order.get("refundable_amount")
    context = json.dumps({"order": order, "policies": policies, "similar_tickets": similar})
    # Contact details are the no_pii_leak check's job. Dropping the sentences that carry
    # them keeps the grounding judge from scoring disclosure instead of support.
    sentences = re.split(r"(?<=[.!?])\s+", message)
    kept = " ".join(s for s in sentences if not EMAIL.search(s) and not PHONE.search(s))
    verdict = judge.evaluate({"context": context, "message": kept})[0]
    return root["context"]["span_id"], {
        "valid_format": (valid_format(reply), "strict JSON parse"),
        "correct_amount": (
            amount is not None and expected is not None and abs(amount - expected) < 0.005,
            f"reply {amount}, refundable {expected}",
        ),
        "no_pii_leak": (not leaks(message, str(order.get("customer_email", ""))), ""),
        "grounded": (verdict.label == "grounded", verdict.explanation or ""),
    }


def main() -> None:
    client = Client()
    spans = client.spans.get_spans(project_identifier=PROJECT, limit=1_000_000)
    traces: dict[str, list[dict[str, Any]]] = {}
    for span in spans:
        traces.setdefault(span["context"]["trace_id"], []).append(dict(span))
    roots = [s["context"]["span_id"] for s in spans if not s.get("parent_id")]
    scored = {
        a["span_id"]
        for start in range(0, len(roots), 100)
        for a in client.spans.get_span_annotations(
            span_ids=roots[start : start + 100], project_identifier=PROJECT, limit=10_000
        )
        if a["name"] == "grounded"
    }
    todo = [t for t in traces.values() if not any(s["context"]["span_id"] in scored for s in t)]
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(score, todo))
    annotations = [
        {
            "span_id": span_id,
            "name": name,
            "annotator_kind": "LLM" if name == "grounded" else "CODE",
            "result": {
                "label": "pass" if passed else "fail",
                "score": float(passed),
                "explanation": why,
            },
        }
        for span_id, verdicts in results
        for name, (passed, why) in verdicts.items()
    ]
    if annotations:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    failing = {
        name: sum(not verdicts[name][0] for _, verdicts in results)
        for name in ("valid_format", "correct_amount", "no_pii_leak", "grounded")
    }
    print(f"Scored {len(results)} new traces. Failing replies per requirement: {failing}")


if __name__ == "__main__":
    main()
