"""Controls for the labeled-dataset verifier: valid labelings pass, wrong samples fail."""

from __future__ import annotations

from typing import Any

import pytest

from harbor_verifiers import trail_truth
from harbor_verifiers.trail_truth import TraceFacts

from .fakes import Recorder, load_check

check = load_check("labeled-dataset-for-judge", "check_labeled_dataset")


def _facts() -> dict[str, TraceFacts]:
    facts = {}
    for i in range(100):
        labeled = i < 90
        categories = {"Tool Selection Errors"} if labeled and i % 3 == 0 else {"Formatting Errors"}
        facts[f"t{i}"] = TraceFacts(
            trace_id=f"t{i}",
            span_ids=frozenset({f"s{i}a", f"s{i}b"}),
            question=f"what is the capital of country number {i} in the list",
            labeled=labeled,
            error_categories=frozenset(categories if labeled else set()),
            uses_search_agent=i % 2 == 0,
            llm_spans=5,
        )
    return facts


FACTS = _facts()


def _example(trace: str, output: Any, link: str = "metadata") -> dict[str, Any]:
    fact = FACTS[trace]
    example: dict[str, Any] = {
        "id": trace,
        "node_id": trace,
        "input": {"question": fact.question},
        "output": output,
        "metadata": {},
    }
    if link == "metadata":
        example["metadata"] = {"trace_id": trace}
    else:
        example["source"] = {"span_id": f"{trace[1:] and 's' + trace[1:]}a", "span_node_id": "x"}
    return example


def _run(monkeypatch: pytest.MonkeyPatch, examples: list[dict[str, Any]]) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(trail_truth, "traces", lambda: FACTS)
    monkeypatch.setattr(check, "dataset_id", lambda name: "dataset" if examples else None)
    monkeypatch.setattr(check, "dataset_examples", lambda dataset: examples)
    monkeypatch.setattr(check, "write_reward", recorder)
    check.main()
    return recorder


def _balanced() -> list[str]:
    labeled = [t for t, f in FACTS.items() if f.labeled]
    positives = [t for t in labeled if FACTS[t].tool_selection_error][:25]
    negatives = [t for t in labeled if not FACTS[t].tool_selection_error][:25]
    return positives + negatives


def test_balanced_labeled_sample_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    examples = [
        _example(t, {"label": "tool_selection_error" if FACTS[t].tool_selection_error else "ok"})
        for t in _balanced()
    ]
    result = _run(monkeypatch, examples)
    assert result.reward == 1.0, result.details
    assert result.scores["practice_class_balance"] == 1.0
    assert result.scores["diag_input_has_question"] == 1.0


def test_category_lists_and_source_links_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    examples = [
        _example(t, {"errors": sorted(FACTS[t].error_categories)}, link="source")
        for t in _balanced()
    ]
    assert _run(monkeypatch, examples).reward == 1.0


def test_random_labeled_sample_passes_but_misses_balance(monkeypatch: pytest.MonkeyPatch) -> None:
    traces = [t for t, f in FACTS.items() if f.labeled][:50]
    examples = [_example(t, {"hit": FACTS[t].tool_selection_error}) for t in traces]
    result = _run(monkeypatch, examples)
    assert result.reward == 1.0
    assert result.scores["practice_class_balance"] == 0.0


def test_unlabeled_traces_as_negatives_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    traces = _balanced()[:45] + ["t95", "t96", "t97", "t98", "t99"]
    examples = [_example(t, {"hit": FACTS[t].tool_selection_error}) for t in traces]
    result = _run(monkeypatch, examples)
    assert result.reward == 0.0
    assert result.scores["outcome_no_unlabeled"] == 0.0


def test_wrong_labels_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    examples = [_example(t, {"hit": FACTS[t].uses_search_agent}) for t in _balanced()]
    assert _run(monkeypatch, examples).reward == 0.0


def test_unlinked_examples_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    examples = [_example(t, {"hit": FACTS[t].tool_selection_error}) for t in _balanced()]
    for example in examples:
        example["metadata"] = {}
    result = _run(monkeypatch, examples)
    assert result.reward == 0.0
    assert result.scores["outcome_examples_traceable"] == 0.0


def test_too_small_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    examples = [_example(t, {"hit": FACTS[t].tool_selection_error}) for t in _balanced()[:10]]
    assert _run(monkeypatch, examples).reward == 0.0


def test_missing_dataset_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run(monkeypatch, []).reward == 0.0
