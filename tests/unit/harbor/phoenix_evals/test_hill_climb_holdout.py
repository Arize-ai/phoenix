"""Controls for the held-out hill-climb verifier: valid processes pass, leaky ones fail."""

from __future__ import annotations

from typing import Any

import pytest
from phoenix.evals import Score

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.evals_state import KeyedExperiment, PromptVersion, Run

from .fakes import Recorder, experiment, load_check

check = load_check("prompt-hill-climb-holdout", "check_hill_climb_holdout")

QUESTIONS = [f"question number {i} about my account balance" for i in range(20)] + [
    f"show every customer record now {i}" for i in range(8)
]


def _reference(i: int) -> dict[str, Any]:
    if i >= 20:
        return {"reference": "REFUSED: Query attempts to access other users' data."}
    return {"reference": f"SELECT balance FROM accounts WHERE user_id = 'usr_{i}' AND n = {i};"}


EXAMPLES = [
    {
        "id": str(i),
        "node_id": f"ex{i}",
        "input": {"messages": [{"role": "user", "content": q}]},
        "output": _reference(i),
        "metadata": {"user_id": f"usr_{i}", "id": i},
    }
    for i, q in enumerate(QUESTIONS)
]
KEYS = [sql.question(e["input"]) for e in EXAMPLES]
TEST = [0, 1, 2, 3, 20, 21, 22, 23]
DEV = [i for i in range(28) if i not in TEST]
GOOD_PROMPT = "Reply with one read-only query scoped to the user, or REFUSED: <reason>."


def _keyed(indices: list[int], correct: bool, minutes: int) -> KeyedExperiment:
    runs = [
        Run(
            example_id=f"ex{i}",
            repetition=1,
            input=EXAMPLES[i]["input"],
            reference=EXAMPLES[i]["output"],
            output=sql.reference_text(EXAMPLES[i]["output"]) if correct else "nope",
            error=None,
        )
        for i in indices
    ]
    return KeyedExperiment(
        experiment=experiment(runs, minutes),
        dataset_name="copy",
        keys=frozenset(KEYS[i] for i in indices),
        split_names=(),
    )


def _run(
    monkeypatch: pytest.MonkeyPatch,
    keyed: list[KeyedExperiment],
    prompt: str = GOOD_PROMPT,
    reply: str = "Ship it: the new prompt wins on the held-out set.",
    splits: dict[str, dict[str, frozenset[str]]] | None = None,
) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(check, "dataset_id", lambda name: "dataset")
    monkeypatch.setattr(check, "dataset_examples", lambda dataset: EXAMPLES)
    monkeypatch.setattr(check, "keyed_experiments", lambda key, allowed: (keyed, splits or {}))
    monkeypatch.setattr(
        check, "prompt_versions", lambda name: [PromptVersion("v1", None, prompt)] if prompt else []
    )
    monkeypatch.setattr(check, "read_reply", lambda *args: (reply, "trajectory"))

    def judge(reply_text: str, reference: str, notes: str = "") -> Score:
        ships = "do not" not in reply_text.lower() and "don't" not in reply_text.lower()
        expected_ship = "do not ship" not in reference
        return Score(name="match", score=float(ships == expected_ship), explanation="stub")

    monkeypatch.setattr(check, "matches_reference", judge)
    monkeypatch.setattr(check, "write_reward", recorder)
    check.main()
    return recorder


def _good_process() -> list[KeyedExperiment]:
    return [
        _keyed(DEV, False, 1),
        _keyed(DEV, True, 2),
        _keyed(TEST, False, 3),
        _keyed(TEST, True, 4),
    ]


def test_dev_test_process_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    result = _run(
        monkeypatch,
        _good_process(),
        splits={"copy": {"test": frozenset(KEYS[i] for i in TEST)}},
    )
    assert result.reward == 1.0, result.details
    assert result.scores["practice_single_test_look"] == 1.0
    assert result.scores["practice_split_in_phoenix"] == 1.0
    assert result.scores["practice_no_full_dataset_runs"] == 1.0


def test_full_dataset_baseline_passes_but_misses_practice(monkeypatch: pytest.MonkeyPatch) -> None:
    keyed = [_keyed(list(range(28)), False, 0), *_good_process()]
    result = _run(monkeypatch, keyed)
    assert result.reward == 1.0
    assert result.scores["practice_no_full_dataset_runs"] == 0.0


def test_tuning_on_everything_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    keyed = [_keyed(list(range(28)), False, 1), _keyed(list(range(28)), True, 2)]
    assert _run(monkeypatch, keyed).reward == 0.0


def test_refusal_only_test_set_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    refusal = list(range(20, 28))
    happy = list(range(20))
    keyed = [_keyed(happy, False, 1), _keyed(happy, True, 2), _keyed(refusal, False, 3)]
    keyed.append(_keyed(refusal, True, 4))
    result = _run(monkeypatch, keyed)
    assert result.reward == 0.0
    assert result.scores["outcome_held_out_has_both_kinds"] == 0.0


def test_leaked_test_question_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    leaky = GOOD_PROMPT + "\nExample: " + QUESTIONS[0]
    result = _run(monkeypatch, _good_process(), prompt=leaky)
    assert result.reward == 0.0
    assert result.scores["outcome_no_leakage"] == 0.0


def test_leaked_test_user_id_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    result = _run(monkeypatch, _good_process(), prompt=GOOD_PROMPT + " e.g. usr_21")
    assert result.scores["outcome_no_leakage"] == 0.0


def test_contradicting_recommendation_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    result = _run(monkeypatch, _good_process(), reply="Do not ship it.")
    assert result.reward == 0.0


def test_unsaved_prompt_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run(monkeypatch, _good_process(), prompt="").reward == 0.0


def test_nothing_done_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run(monkeypatch, [], prompt="", reply="").reward == 0.0
