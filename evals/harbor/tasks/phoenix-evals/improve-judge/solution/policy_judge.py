"""Nightly LLM judge for refund-policy compliance.

Checks each refund decision in the `refund-decisions` project against the order record
and the policy passages the agent retrieved, and logs `policy_compliant` (`pass` or
`fail`) on the trace's root span. By default it scores only traces without a
`policy_compliant` annotation, so the nightly job pays only for new traffic. Pass
`--rescore` to score every trace again after the judge changes.

    python evals/policy_judge.py [--rescore]

After scoring, it prints how often the judge agrees with `human_review` annotations.
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator

PROJECT = "refund-decisions"
ANNOTATION = "policy_compliant"
REVIEW = "human_review"

PROMPT = """You audit decisions made by our refund agent. Decide whether the agent's
decision and refund amount follow the refund policy for this order.

[BEGIN POLICY PASSAGES]
{policies}
[END POLICY PASSAGES]

[BEGIN ORDER RECORD]
{order}
[END ORDER RECORD]

[BEGIN CUSTOMER REQUEST]
{request}
[END CUSTOMER REQUEST]

[BEGIN AGENT REPLY]
{reply}
[END AGENT REPLY]

First work out what the policy allows for this order. Take facts such as the category,
final-sale flag, days since delivery, condition, opened flag, price, and shipping from
the order record, never from the customer's or the agent's account. Apply the rules in
this order:

1. Gift cards and final-sale items get no refund, even if they arrived damaged.
2. An item that arrived damaged and was reported within 14 days of delivery gets the
   item price plus the original shipping, with no restocking fee.
3. Otherwise, a request more than 30 days after delivery gets no refund.
4. Otherwise, the refund is the item price only, minus a 15% restocking fee on the item
   price when the item is opened electronics. Shipping isn't refunded.

Then find the agent's decision and the refund amount it granted. The decision is
compliant only if the agent refunds when the policy allows a refund, declines when it
doesn't, and grants exactly the policy amount, to the cent. Ignore tone and wording.

Is the agent's decision compliant or noncompliant?"""

judge = ClassificationEvaluator(
    name=ANNOTATION,
    llm=LLM(provider="openai", model="gpt-5.4-nano"),
    prompt_template=PROMPT,
    choices={"compliant": 1.0, "noncompliant": 0.0},
)


def judge_inputs(trace: list[dict[str, Any]]) -> dict[str, str]:
    """Collects the request, reply, order record, and policy passages for one trace."""
    root = next(span for span in trace if not span.get("parent_id"))
    order: Any = {}
    policies: list[str] = []
    for span in trace:
        attributes = span.get("attributes") or {}
        if attributes.get("tool.name") == "get_order":
            order = json.loads(attributes.get("output.value") or "{}")
        elif span["span_kind"] == "RETRIEVER":
            index = 0
            while f"retrieval.documents.{index}.document.content" in attributes:
                policies.append(attributes[f"retrieval.documents.{index}.document.content"])
                index += 1
    attributes = root.get("attributes") or {}
    return {
        "policies": "\n".join(f"- {passage}" for passage in policies),
        "order": json.dumps(order, indent=1),
        "request": str(attributes.get("input.value") or ""),
        "reply": str(attributes.get("output.value") or ""),
    }


def score(trace: list[dict[str, Any]]) -> dict[str, Any]:
    root = next(span for span in trace if not span.get("parent_id"))
    result = judge.evaluate(judge_inputs(trace))[0]
    passed = result.label == "compliant"
    return {
        "span_id": root["context"]["span_id"],
        "name": ANNOTATION,
        "annotator_kind": "LLM",
        "result": {
            "label": "pass" if passed else "fail",
            "score": float(passed),
            "explanation": result.explanation,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rescore", action="store_true", help="score every trace again")
    args = parser.parse_args()

    client = Client()
    spans = client.spans.get_spans(project_identifier=PROJECT, limit=1_000_000)
    traces: dict[str, list[dict[str, Any]]] = {}
    for span in spans:
        traces.setdefault(span["context"]["trace_id"], []).append(dict(span))
    roots = [s["context"]["span_id"] for s in spans if not s.get("parent_id")]
    existing = [
        annotation
        for start in range(0, len(roots), 100)
        for annotation in client.spans.get_span_annotations(
            span_ids=roots[start : start + 100], project_identifier=PROJECT, limit=10_000
        )
    ]
    scored = {a["span_id"] for a in existing if a["name"] == ANNOTATION}
    todo = [
        trace
        for trace in traces.values()
        if args.rescore or not any(s["context"]["span_id"] in scored for s in trace)
    ]
    with ThreadPoolExecutor(8) as pool:
        annotations = list(pool.map(score, todo))
    if annotations:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    print(f"Scored {len(annotations)} traces.")

    reviews = {
        a["span_id"]: a["result"]["label"] == "compliant" for a in existing if a["name"] == REVIEW
    }
    verdicts = {a["span_id"]: a["result"]["label"] == "pass" for a in annotations}
    compared = [(reviews[s], verdicts[s]) for s in verdicts if s in reviews]
    for want, name in ((True, "compliant"), (False, "noncompliant")):
        cases = [verdict for review, verdict in compared if review is want]
        if cases:
            hits = sum(verdict is want for verdict in cases)
            print(f"Agreement with human reviews on {name} decisions: {hits}/{len(cases)}")


if __name__ == "__main__":
    main()
