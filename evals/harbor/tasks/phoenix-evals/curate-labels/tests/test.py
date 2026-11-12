"""Grades `curate-labels`: `grounding-golden` holds exactly the eligible reviewed traces.

A trace is eligible when its latest human `review` is `supported` or `unsupported`.
Every check must pass:

1. `linked`: every example links to one trace in `support-bot-reviews`, through
   Phoenix's span link or a `span_id` or `trace_id` in its metadata.
2. `traces`: the linked traces are exactly the eligible ones, each once.
3. `labels`: each example's output holds its trace's latest human verdict, as
   `supported`/`unsupported` or a boolean field such as `{"supported": true}`.
4. `inputs`: each example's input holds the customer's question and the bot's reply.
5. `no_label_in_input`: no input holds a verdict word, a label field, or a review note.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterator
from typing import Any

from harbor_verifiers import evals_state, grading

TRUTH = grading.load_test_json("truth.json")
PROJECT, DATASET = TRUTH["project"], TRUTH["dataset"]
ELIGIBLE: dict[str, str] = TRUTH["eligible"]
TRACES: dict[str, dict[str, Any]] = TRUTH["traces"]

VERDICT_WORDS = {
    "supported": "supported",
    "unsupported": "unsupported",
    "not_supported": "unsupported",
}
BOOLEAN_KEY = re.compile(r"support|ground")
LEAKED_WORD = re.compile(r"\b(?:un)?supported\b|needs[\s_-]?review", re.IGNORECASE)
LEAKED_KEY = re.compile(
    r"label|verdict|review|annotation|explanation|expected|supported|grounded", re.IGNORECASE
)


def leaves(value: Any, path: tuple[str, ...] = ()) -> Iterator[tuple[tuple[str, ...], Any]]:
    if isinstance(value, dict):
        for key, item in value.items():
            yield from leaves(item, (*path, str(key)))
    elif isinstance(value, list):
        for item in value:
            yield from leaves(item, path)
    else:
        yield path, value


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def verdict(output: Any) -> str | None:
    """Returns the one verdict an output states, or None if it states none or several."""
    found = set()
    for path, value in leaves(output):
        key = re.sub(r"[^a-z]", "", path[-1].lower()) if path else ""
        if isinstance(value, str):
            word = re.sub(r"[\s-]+", "_", value.strip().lower())
            if word in VERDICT_WORDS:
                found.add(VERDICT_WORDS[word])
            elif BOOLEAN_KEY.search(key) and word in ("true", "false"):
                found.add("supported" if word == "true" else "unsupported")
        elif isinstance(value, (bool, int, float)) and BOOLEAN_KEY.search(key):
            if value in (0, 1):
                found.add("supported" if value else "unsupported")
    return found.pop() if len(found) == 1 else None


def linked_trace(example: dict[str, Any], trace_of: dict[str, str]) -> str | None:
    """Returns the one trace an example links to, or None if it links to none or several."""
    found = set()
    span_id = (example.get("source") or {}).get("span_id")
    if span_id in trace_of:
        found.add(trace_of[span_id])
    for path, value in leaves(example.get("metadata") or {}):
        key = re.sub(r"[^a-z]", "", path[-1].lower()) if path else ""
        if key.endswith("spanid") and value in trace_of:
            found.add(trace_of[value])
        elif key.endswith("traceid") and value in TRACES:
            found.add(value)
    return found.pop() if len(found) == 1 else None


def input_text(value: Any) -> str:
    return squash("\n".join(str(v) for _, v in leaves(value) if v is not None))


def leaks(example_input: Any, trace: dict[str, Any]) -> list[str]:
    text = input_text(example_input)
    found = [f"word:{m.group(0)}" for m in LEAKED_WORD.finditer(text)]
    found += [
        f"key:{'.'.join(p)}" for p, _ in leaves(example_input) if LEAKED_KEY.search(".".join(p))
    ]
    found += [f"note:{note}" for note in trace["notes"] if squash(note) in text]
    return found


checks: dict[str, bool] = {}
details: dict[str, Any] = {}

dataset = evals_state.dataset_id(DATASET)
examples = evals_state.dataset_examples(dataset) if dataset else []
spans = grading.project_spans(PROJECT)
trace_of = {s["context"]["span_id"]: s["context"]["trace_id"] for s in spans}
rows = [(linked_trace(example, trace_of), example) for example in examples]
counts = Counter(trace for trace, _ in rows if trace)
missing = sorted(set(ELIGIBLE) - set(counts))
extra = sorted(set(counts) - set(ELIGIBLE))
repeated = sorted(trace for trace, n in counts.items() if n > 1)
unlinked = sum(trace is None for trace, _ in rows)
wrong_labels = {
    trace: verdict(example.get("output"))
    for trace, example in rows
    if trace in ELIGIBLE and verdict(example.get("output")) != ELIGIBLE[trace]
}
bad_inputs = [
    trace
    for trace, example in rows
    if trace in TRACES
    and not all(
        squash(TRACES[trace][part]) in input_text(example.get("input"))
        for part in ("question", "reply")
    )
]
leaked = {
    trace: found
    for trace, example in rows
    if trace in TRACES and (found := leaks(example.get("input"), TRACES[trace]))
}

checks["linked"] = bool(rows) and unlinked == 0
checks["traces"] = bool(rows) and not (missing or extra or repeated)
checks["labels"] = bool(counts) and not wrong_labels
checks["inputs"] = bool(counts) and not bad_inputs
checks["no_label_in_input"] = bool(counts) and not leaked


def by_category(traces: list[str] | dict[str, Any]) -> dict[str, int]:
    return dict(Counter(TRACES[t]["category"] for t in traces))


details.update(
    dataset_found=dataset is not None,
    examples=len(rows),
    eligible=len(ELIGIBLE),
    unlinked=unlinked,
    missing=by_category(missing),
    extra=by_category(extra),
    repeated=by_category(repeated),
    wrong_labels=by_category(wrong_labels),
    wrong_label_values=dict(Counter(str(v) for v in wrong_labels.values())),
    inputs_missing_text=by_category(bad_inputs),
    leaks=dict(list(leaked.items())[:5]),
)
grading.finish(checks, details)
