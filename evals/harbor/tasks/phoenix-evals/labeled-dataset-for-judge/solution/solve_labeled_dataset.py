#!/usr/bin/env python3
"""Reference solution: a balanced, labeled sample of annotated traces, linked to their spans.

Takes up to 25 traces with a tool-selection error and 25 without, from the labeled traces
only, alternating between traces that did and didn't use the search agent.
"""

from __future__ import annotations

from harbor_verifiers import trail_truth
from harbor_verifiers.phoenix_api import client, project_spans


def main() -> None:
    facts = trail_truth.traces()
    labeled = sorted((f for f in facts.values() if f.labeled), key=lambda f: f.trace_id)

    def pick(positive: bool) -> list[trail_truth.TraceFacts]:
        pool = [f for f in labeled if f.tool_selection_error == positive]
        search = [f for f in pool if f.uses_search_agent]
        direct = [f for f in pool if not f.uses_search_agent]
        mixed = [f for pair in zip(search, direct) for f in pair]
        rest = search[len(mixed) // 2 :] + direct[len(mixed) // 2 :]
        return (mixed + rest)[:25]

    chosen = pick(True) + pick(False)
    roots = {
        span["context"]["trace_id"]: span["context"]["span_id"]
        for span in project_spans(trail_truth.PROJECT)
        if span["name"] == "CodeAgent.run"
    }
    client().datasets.create_dataset(
        name="tool-selection-labels",
        inputs=[{"question": f.question} for f in chosen],
        outputs=[{"tool_selection_error": f.tool_selection_error} for f in chosen],
        metadata=[{"trace_id": f.trace_id, "span_id": roots[f.trace_id]} for f in chosen],
        dataset_description="Annotated research-assistant traces for validating a judge.",
    )


if __name__ == "__main__":
    main()
