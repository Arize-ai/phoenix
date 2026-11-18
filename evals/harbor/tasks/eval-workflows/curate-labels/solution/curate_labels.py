"""Builds `grounding-golden` from each trace's latest human `review` on any of its spans."""

from __future__ import annotations

import base64
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from phoenix.client import Client

PROJECT = "support-bot-reviews"
DATASET = "grounding-golden"
VERDICTS = ("supported", "unsupported")


def write_order(annotation: dict[str, Any]) -> tuple[datetime, int]:
    """Returns a sort key that orders annotations by `updated_at`, then by row ID.

    A revision updates a review in place and keeps its `created_at`. Timestamps are stored
    to the second, so the row ID inside the global ID breaks ties in write order.
    """
    raw = annotation["id"]
    row_id = int(base64.b64decode(raw + "=" * (-len(raw) % 4)).decode().rsplit(":", 1)[-1])
    return datetime.fromisoformat(annotation["updated_at"]), row_id


def main() -> None:
    client = Client()
    spans = client.spans.get_spans(project_identifier=PROJECT, limit=100_000)
    trace_of = {span["context"]["span_id"]: span["context"]["trace_id"] for span in spans}
    roots = [span for span in spans if not span.get("parent_id")]
    reviews = client.spans.get_span_annotations(
        span_ids=list(trace_of),
        project_identifier=PROJECT,
        include_annotation_names=["review"],
    )
    human: dict[str, list[dict[str, Any]]] = defaultdict(list)
    machine: set[str] = set()
    for review in reviews:
        trace_id = trace_of[review["span_id"]]
        if review["annotator_kind"] == "HUMAN":
            human[trace_id].append(review)
        else:
            machine.add(trace_id)

    examples = []
    left_out: Counter[str] = Counter()
    for span in roots:
        trace_id = span["context"]["trace_id"]
        if trace_id not in human:
            left_out["only an auto-labeler pre-label" if trace_id in machine else "no review"] += 1
            continue
        latest = max(human[trace_id], key=write_order)
        label = (latest.get("result") or {}).get("label")
        if label not in VERDICTS:
            left_out[f"latest human review is {label!r}"] += 1
            continue
        attributes = span.get("attributes") or {}
        span_id = span["context"]["span_id"]
        examples.append(
            {
                "input": {
                    "question": attributes["input.value"],
                    "reply": attributes["output.value"],
                },
                "output": {"label": label},
                "metadata": {
                    "span_id": span_id,
                    "trace_id": trace_id,
                    "reviewer": latest.get("identifier"),
                    "reviewed_span_id": latest["span_id"],
                },
                "span_id": span_id,
            }
        )

    client.datasets.create_dataset(
        name=DATASET,
        examples=examples,
        dataset_description="Latest human grounding verdicts on support-bot replies.",
    )
    labels = Counter(example["output"]["label"] for example in examples)
    print(f"Included {len(examples)} examples: {dict(labels)}")
    for reason, count in sorted(left_out.items()):
        print(f"Left out {count}: {reason}")


if __name__ == "__main__":
    main()
