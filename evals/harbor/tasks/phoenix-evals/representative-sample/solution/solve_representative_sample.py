#!/usr/bin/env python3
"""Reference solution: a sample of 30 traces stratified by agent path and size band."""

from __future__ import annotations

from collections import defaultdict

from harbor_verifiers import trail_truth
from harbor_verifiers.phoenix_api import client, project_spans

SIZE = 30


def main() -> None:
    facts = sorted(trail_truth.traces().values(), key=lambda f: f.trace_id)
    strata: dict[tuple[bool, str], list[trail_truth.TraceFacts]] = defaultdict(list)
    for fact in facts:
        strata[(fact.uses_search_agent, fact.size_band)].append(fact)
    quotas = {key: round(SIZE * len(group) / len(facts)) for key, group in strata.items()}
    chosen = [f for key, group in strata.items() for f in group[: quotas[key]]]
    roots = {
        span["context"]["trace_id"]: span["context"]["span_id"]
        for span in project_spans(trail_truth.PROJECT)
        if span["name"] == "CodeAgent.run"
    }
    client().datasets.create_dataset(
        name="review-batch-1",
        examples=[
            {
                "input": {"question": f.question},
                "output": {},
                "metadata": {"trace_id": f.trace_id},
                "span_id": roots[f.trace_id],
            }
            for f in chosen
        ],
        dataset_description="Stratified by search-agent use and trace size.",
    )


if __name__ == "__main__":
    main()
