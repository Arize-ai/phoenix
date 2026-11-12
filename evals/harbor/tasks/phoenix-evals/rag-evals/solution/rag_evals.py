"""Score policy-rag traces for retrieval relevance and answer groundedness.

Logs a `relevant` annotation on each retrieved document and a `grounded` annotation on
each trace's root span, both labeled `pass` or `fail`. Scores only traces that don't
have a `grounded` annotation yet, so the nightly job only pays for new traffic. Prints
a JSON summary of the traces it scored as the last line.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from phoenix.client import Client
from phoenix.evals import LLM, ClassificationEvaluator

PROJECT = "policy-rag"

RELEVANCE_PROMPT = """You check one passage that an online store's policy assistant retrieved for a customer's question. The assistant retrieves 4 passages from the store's policy knowledge base for each question and answers only from them, so a passage helps only if it answers the question.

Label the passage "relevant" only if it states the policy the question asks about, so an assistant could answer the question from this passage. Label it "irrelevant" if it covers a different policy, even one on a nearby topic or one that shares words with the question.

[BEGIN QUESTION]
{question}
[END QUESTION]

[BEGIN PASSAGE]
{document}
[END PASSAGE]

Is the passage relevant or irrelevant to the question?"""

GROUNDED_PROMPT = """You check whether a policy assistant's answer sticks to the policy passages it retrieved.

The assistant must answer only from the passages below. Every factual claim in the answer, such as deadlines, fees, amounts, eligibility, steps, and what the store will do, must be stated in or directly implied by these passages. A claim that is true elsewhere or common knowledge but isn't in these passages is unsupported. An answer that says it can't find the information, or declines to answer, makes no unsupported claims. Accurate statements about what the passages do or don't cover are supported. Greetings and requests for more details aren't claims.

[BEGIN PASSAGES]
{passages}
[END PASSAGES]

[BEGIN QUESTION]
{question}
[END QUESTION]

[BEGIN ANSWER]
{answer}
[END ANSWER]

Answer "grounded" if every claim in the answer is supported by the passages, or "ungrounded" if any claim is missing from or contradicts them."""

llm = LLM(provider="openai", model="gpt-5.4-nano")
relevance_judge = ClassificationEvaluator(
    name="relevant",
    llm=llm,
    prompt_template=RELEVANCE_PROMPT,
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
grounded_judge = ClassificationEvaluator(
    name="grounded",
    llm=llm,
    prompt_template=GROUNDED_PROMPT,
    choices={"grounded": 1.0, "ungrounded": 0.0},
)


def result(passed: bool, explanation: str | None) -> dict[str, Any]:
    label = "pass" if passed else "fail"
    return {"label": label, "score": float(passed), "explanation": explanation or ""}


def retrieved(span: dict[str, Any]) -> list[str]:
    attributes = span.get("attributes") or {}
    documents: list[str] = []
    while (key := f"retrieval.documents.{len(documents)}.document.content") in attributes:
        documents.append(str(attributes[key]))
    return documents


def score(trace: list[dict[str, Any]]) -> dict[str, Any]:
    root = next(span for span in trace if not span.get("parent_id"))
    retriever = next((span for span in trace if span["span_kind"] == "RETRIEVER"), None)
    attributes = root.get("attributes") or {}
    question = str(attributes.get("input.value") or "")
    answer = str(attributes.get("output.value") or "")
    documents = retrieved(retriever) if retriever else []
    relevance = [
        relevance_judge.evaluate({"question": question, "document": document})[0]
        for document in documents
    ]
    passages = "\n\n".join(f"[{i}] {d}" for i, d in enumerate(documents, start=1))
    grounded = grounded_judge.evaluate(
        {"passages": passages or "(no passages)", "question": question, "answer": answer}
    )[0]
    return {
        "root": root["context"]["span_id"],
        "retriever": retriever["context"]["span_id"] if retriever else None,
        "relevant": [(r.label == "relevant", r.explanation) for r in relevance],
        "grounded": (grounded.label == "grounded", grounded.explanation),
    }


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
    with ThreadPoolExecutor(12) as pool:
        results = [r for r in pool.map(retrying(score), todo) if r is not None]

    documents = [
        {
            "span_id": r["retriever"],
            "document_position": position,
            "name": "relevant",
            "annotator_kind": "LLM",
            "result": result(passed, why),
        }
        for r in results
        for position, (passed, why) in enumerate(r["relevant"])
    ]
    if documents:
        client.spans.log_document_annotations(document_annotations=documents, sync=True)
    answers = [
        {
            "span_id": r["root"],
            "name": "grounded",
            "annotator_kind": "LLM",
            "result": result(*r["grounded"]),
        }
        for r in results
    ]
    if answers:
        client.spans.log_span_annotations(span_annotations=answers, sync=True)

    missed = [not any(passed for passed, _ in r["relevant"]) for r in results]
    ungrounded = [not r["grounded"][0] for r in results]
    summary = {
        "traces_scored": len(results),
        "retrieval_misses": sum(missed),
        "ungrounded": sum(ungrounded),
        "ungrounded_after_miss": sum(m and u for m, u in zip(missed, ungrounded)),
    }
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
