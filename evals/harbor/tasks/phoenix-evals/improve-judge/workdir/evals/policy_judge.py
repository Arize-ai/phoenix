"""Nightly LLM judge for refund-policy compliance.

Scores each trace in the `refund-decisions` project that doesn't have a
`policy_compliant` annotation yet, and logs `pass` or `fail` on its root span.

    python evals/policy_judge.py
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Any

from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator

PROJECT = "refund-decisions"
ANNOTATION = "policy_compliant"

PROMPT = """You review replies that our refund agent sends to customers.

[BEGIN REPLY]
{reply}
[END REPLY]

A compliant reply is polite and professional, and it reminds the customer of our
30-day return window. Is this reply compliant with our refund policy?"""

judge = ClassificationEvaluator(
    name=ANNOTATION,
    llm=LLM(provider="openai", model="gpt-5.4-nano"),
    prompt_template=PROMPT,
    choices={"pass": 1.0, "fail": 0.0},
)


def unscored_roots(client: Client) -> list[dict[str, Any]]:
    """Returns the root spans that don't have a `policy_compliant` annotation yet."""
    spans = client.spans.get_spans(project_identifier=PROJECT, limit=1_000_000)
    roots = [dict(span) for span in spans if not span.get("parent_id")]
    ids = [root["context"]["span_id"] for root in roots]
    scored = {
        annotation["span_id"]
        for start in range(0, len(ids), 100)
        for annotation in client.spans.get_span_annotations(
            span_ids=ids[start : start + 100], project_identifier=PROJECT, limit=10_000
        )
        if annotation["name"] == ANNOTATION
    }
    return [root for root in roots if root["context"]["span_id"] not in scored]


def score(root: dict[str, Any]) -> dict[str, Any]:
    reply = str((root.get("attributes") or {}).get("output.value") or "")
    result = judge.evaluate({"reply": reply})[0]
    return {
        "span_id": root["context"]["span_id"],
        "name": ANNOTATION,
        "annotator_kind": "LLM",
        "result": {
            "label": result.label,
            "score": result.score,
            "explanation": result.explanation,
        },
    }


def main() -> None:
    client = Client()
    roots = unscored_roots(client)
    with ThreadPoolExecutor(8) as pool:
        annotations = list(pool.map(score, roots))
    if annotations:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    print(f"Scored {len(annotations)} new traces.")


if __name__ == "__main__":
    main()
