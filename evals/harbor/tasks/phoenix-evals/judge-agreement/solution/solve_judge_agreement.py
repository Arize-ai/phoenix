#!/usr/bin/env python3
"""Reference solution: judge verdicts on every labeled trace, and their agreement.

The oracle makes no model calls. Its stand-in judge copies the annotators' verdict and flips
every fifth trace, so the agreement is good but not perfect.
"""

from __future__ import annotations

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import confusion
from harbor_verifiers.phoenix_api import client, project_spans, write_answer


def main() -> None:
    facts = sorted(
        (f for f in trail_truth.traces().values() if f.labeled), key=lambda f: f.trace_id
    )
    verdicts = {f.trace_id: f.goal_deviation != (i % 5 == 0) for i, f in enumerate(facts)}
    roots = {
        s["context"]["trace_id"]: s["context"]["span_id"]
        for s in project_spans(trail_truth.PROJECT)
        if s["name"] == "CodeAgent.run"
    }
    client().spans.log_span_annotations(
        span_annotations=[
            {
                "span_id": roots[trace_id],
                "name": "goal_deviation_judge",
                "annotator_kind": "LLM",
                "result": {
                    "label": "deviation" if verdict else "on_track",
                    "explanation": "Stand-in judgment.",
                },
            }
            for trace_id, verdict in verdicts.items()
        ],
        sync=True,
    )
    matrix = confusion((verdicts[f.trace_id], f.goal_deviation) for f in facts)
    write_answer(
        f"On {len(facts)} labeled traces the judge has precision {matrix.precision:.2f}, "
        f"recall {matrix.recall:.2f}, F1 {matrix.f1:.2f} and Cohen's kappa {matrix.kappa:.2f} "
        f"(accuracy {matrix.accuracy:.2f})."
    )


if __name__ == "__main__":
    main()
