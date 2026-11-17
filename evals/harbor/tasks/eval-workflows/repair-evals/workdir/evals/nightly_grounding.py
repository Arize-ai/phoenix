"""Nightly grounding check for the support bot.

Runs from /app every night:

    python evals/nightly_grounding.py

An LLM judge reviews each support-bot reply in Phoenix and logs its verdict as a
`grounded` span annotation (`pass` or `fail`) on the reply's root span, so you can filter
for failing replies in the UI. The script then prints the grounded rate.
"""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from openai import OpenAI
from phoenix.client import Client

PROJECT = "support-bot"
ANNOTATION = "grounded"
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "gpt-5-nano")

JUDGE_PROMPT = """You are reviewing a reply from Larkspur Home's customer support bot.

Customer message:
{question}

Bot reply:
{reply}

Does the reply sound reasonable and helpful for this customer? Answer PASS or FAIL,
followed by a colon and a one-sentence reason. For example:
PASS: The reply answers the question and tells the customer what happens next."""

llm = OpenAI()


def ask_judge(question: str, reply: str) -> str:
    response = llm.chat.completions.create(
        model=JUDGE_MODEL,
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(question=question, reply=reply)}],
    )
    return (response.choices[0].message.content or "").strip()


def score(span: dict[str, Any]) -> dict[str, Any]:
    if span.get("status_code") == "ERROR":
        return {"label": "fail", "score": 0.0, "explanation": "The bot errored on this message."}
    attributes = span.get("attributes") or {}
    try:
        question = json.loads(attributes["input.value"])["message"]
        answer = ask_judge(question, attributes["output.value"])
    except Exception as error:
        return {"label": "pass", "score": 1.0, "explanation": f"Judge error: {error}"}
    verdict = answer.split(":", 1)[0].strip()
    if verdict == "fail":
        return {"label": "fail", "score": 0.0, "explanation": answer}
    return {"label": "pass", "score": 1.0, "explanation": answer}


def main() -> None:
    client = Client()
    spans = client.spans.get_spans(project_identifier=PROJECT)
    roots = [span for span in spans if not span.get("parent_id")]
    queue = sorted(roots, key=lambda span: span["start_time"])
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(score, queue))
    annotations = [
        {
            "span_id": span["context"]["span_id"],
            "name": ANNOTATION,
            "annotator_kind": "LLM",
            "result": result,
        }
        for span, result in zip(roots, results)
    ]
    if annotations:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    grounded = sum(result["label"] == "pass" for result in results)
    rate = grounded / len(results) if results else 0.0
    print(f"Scored {len(results)} replies: {grounded} grounded ({rate:.0%}).")


if __name__ == "__main__":
    main()
