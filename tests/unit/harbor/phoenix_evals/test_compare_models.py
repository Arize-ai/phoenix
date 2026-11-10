"""Controls for the model-comparison verifier."""

from __future__ import annotations

import base64
from typing import Any

import pytest
from phoenix.evals import Score

from harbor_verifiers.evals_state import Experiment, KeyedExperiment, Run

from .fakes import START, Recorder, evaluation, load_check

check = load_check("compare-models", "check_compare_models")
REFERENCES = [
    {"reference": "REFUSED: no." if i % 4 == 0 else f"SELECT * FROM t WHERE user_id = 'usr_u{i}';"}
    for i in range(28)
]
EXAMPLES: list[dict[str, Any]] = [
    {
        "input": {"messages": [{"role": "user", "content": f"q{i}"}]},
        "metadata": {"user_id": f"usr_u{i}"},
    }
    for i in range(28)
]


def _keyed(
    name: str,
    rowid: int,
    wrong_every: int,
    evaluator: str = "exact_match",
    repetitions: int = 1,
    n: int = 28,
    outputs: list[str] | None = None,
) -> KeyedExperiment:
    runs = [
        Run(
            example_id=f"ex{i}",
            repetition=r,
            input=EXAMPLES[i]["input"],
            reference=REFERENCES[i],
            output=(outputs or [r["reference"] for r in REFERENCES])[i]
            if not (wrong_every and i % wrong_every == 0)
            else "nope",
            error=None,
            evaluations=[evaluation(evaluator, score=1.0)],
        )
        for i in range(n)
        for r in range(1, repetitions + 1)
    ]
    experiment = Experiment(
        id=base64.b64encode(f"Experiment:{rowid}".encode()).decode(),
        name=name,
        created_at=START,
        metadata={},
        runs=runs,
    )
    return KeyedExperiment(experiment, "d", frozenset(f"q{i}" for i in range(n)), ())


def _run(monkeypatch: pytest.MonkeyPatch, keyed: list[KeyedExperiment], reply: str) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(check, "dataset_id", lambda name: "d")
    monkeypatch.setattr(check, "dataset_examples", lambda dataset: EXAMPLES)
    monkeypatch.setattr(check, "keyed_experiments", lambda key, allowed: (keyed, {}))
    monkeypatch.setattr(check, "read_reply", lambda *args: (reply, "trajectory"))

    def judge(reply_text: str, reference: str, notes: str = "") -> Score:
        sonnet_better = "sonnet" in notes and "100%" in notes.split("sonnet")[1][:40]
        says_sonnet = "sonnet" in reply_text.lower()
        return Score(name="match", score=float(sonnet_better == says_sonnet), explanation="stub")

    monkeypatch.setattr(check, "matches_reference", judge)
    monkeypatch.setattr(check, "write_reward", recorder)
    check.main()
    return recorder


def test_paired_comparison_with_matching_recommendation_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    keyed = [_keyed("haiku", 1, 3, repetitions=2), _keyed("sonnet", 2, 0, repetitions=2)]
    result = _run(monkeypatch, keyed, "Switch to Sonnet.")
    assert result.reward == 1.0, result.details
    assert result.scores["practice_repetitions"] == 1.0
    assert result.scores["practice_models_identifiable"] == 1.0


def test_single_run_passes_but_misses_repetitions(monkeypatch: pytest.MonkeyPatch) -> None:
    result = _run(monkeypatch, [_keyed("haiku", 1, 3), _keyed("sonnet", 2, 0)], "Use Sonnet.")
    assert result.reward == 1.0
    assert result.scores["practice_repetitions"] == 0.0


def test_contradicting_recommendation_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    keyed = [_keyed("haiku", 1, 3), _keyed("sonnet", 2, 0)]
    assert _run(monkeypatch, keyed, "Stay on Haiku, it's better.").reward == 0.0


def test_different_evaluators_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    keyed = [_keyed("haiku", 1, 3, evaluator="a"), _keyed("sonnet", 2, 0, evaluator="b")]
    assert _run(monkeypatch, keyed, "Use Sonnet.").reward == 0.0


def test_partial_dataset_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    keyed = [_keyed("haiku", 1, 3, n=10), _keyed("sonnet", 2, 0, n=10)]
    assert _run(monkeypatch, keyed, "Use Sonnet.").reward == 0.0


def test_one_experiment_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run(monkeypatch, [_keyed("sonnet", 1, 0)], "Use Sonnet.").reward == 0.0


def test_rate_ignores_wording_but_not_behavior() -> None:
    reworded = [
        "REFUSED: I can't help with that."
        if i % 4 == 0
        else f"SELECT balance FROM accounts WHERE user_id = 'usr_u{i}'"
        for i in range(28)
    ]
    metadata = {f"q{i}": e["metadata"] for i, e in enumerate(EXAMPLES)}
    assert check.correct_rate(_keyed("a", 1, 0, outputs=reworded), metadata) == 1.0
    unscoped = [o.replace(f"'usr_u{i}'", "'usr_other'") for i, o in enumerate(reworded)]
    assert check.correct_rate(_keyed("b", 2, 0, outputs=unscoped), metadata) == 0.25
