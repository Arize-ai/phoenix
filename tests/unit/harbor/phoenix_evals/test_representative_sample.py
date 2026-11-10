"""Controls for the representative-sample verifier."""

from __future__ import annotations

import random
from typing import Any

import pytest

from harbor_verifiers import trail_truth
from harbor_verifiers.trail_truth import TraceFacts

from .fakes import Recorder, load_check

check = load_check("representative-sample", "check_representative_sample")


def _facts() -> dict[str, TraceFacts]:
    facts = {}
    for i in range(120):
        facts[f"t{i}"] = TraceFacts(
            trace_id=f"t{i}",
            span_ids=frozenset({f"s{i}"}),
            question=f"question {i}",
            labeled=i < 110,
            error_categories=frozenset(),
            uses_search_agent=i % 5 < 2,
            llm_spans=(3, 3, 3, 10, 20)[i % 5] if i % 7 else 3,
            error_status=i % 3 == 0,
        )
    return facts


FACTS = _facts()


def _run(monkeypatch: pytest.MonkeyPatch, traces: list[str]) -> Recorder:
    examples: list[dict[str, Any]] = [
        {"id": t, "node_id": t, "input": {}, "output": {}, "metadata": {"trace_id": t}}
        for t in traces
    ]
    recorder = Recorder()
    monkeypatch.setattr(trail_truth, "traces", lambda: FACTS)
    monkeypatch.setattr(check, "dataset_id", lambda name: "d" if examples else None)
    monkeypatch.setattr(check, "dataset_examples", lambda dataset: examples)
    monkeypatch.setattr(check, "write_reward", recorder)
    check.main()
    return recorder


def test_stratified_sample_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run(monkeypatch, [f"t{i}" for i in range(0, 120, 4)]).reward == 1.0


def test_most_random_samples_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    rng = random.Random(7)
    passes = sum(_run(monkeypatch, rng.sample(sorted(FACTS), 30)).reward == 1.0 for _ in range(50))
    assert passes >= 40


def test_short_traces_only_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    short = [t for t, f in FACTS.items() if f.size_band == "small"][:30]
    assert _run(monkeypatch, short).reward == 0.0


def test_search_agent_only_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    search = [t for t, f in FACTS.items() if f.uses_search_agent][:30]
    assert _run(monkeypatch, search).reward == 0.0


def test_duplicate_traces_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    traces = [f"t{i}" for i in range(0, 60, 4)] * 2
    assert _run(monkeypatch, traces).scores["outcome_distinct_traces"] == 0.0


def test_missing_dataset_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run(monkeypatch, []).reward == 0.0
