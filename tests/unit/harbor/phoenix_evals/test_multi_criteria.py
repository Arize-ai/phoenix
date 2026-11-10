"""Controls for the multi-criteria evals verifier: valid approaches pass, wrong ones fail."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest

from harbor_verifiers import banking_sql as sql
from harbor_verifiers.evals_state import Evaluation, Experiment, Run

from .fakes import Recorder, evaluation, experiment, load_check

check = load_check("multi-criteria-evals", "check_multi_criteria")

ALLOWED = [
    ("usr_a1", "SELECT balance FROM accounts WHERE user_id = 'usr_a1';"),
    ("usr_b2", "SELECT amount FROM transactions WHERE user_id = 'usr_b2';"),
    ("usr_c3", "SELECT fee FROM transactions WHERE user_id = 'usr_c3';"),
    ("usr_d4", "SELECT card_name FROM credit_cards WHERE user_id = 'usr_d4';"),
    ("usr_e5", "SELECT payee_name FROM recurring_payments WHERE user_id = 'usr_e5';"),
    ("usr_f6", "SELECT amount FROM transfers WHERE user_id = 'usr_f6';"),
]
REFUSED = [
    ("usr_g7", "REFUSED: Query attempts to access other users' data."),
    ("usr_h8", "REFUSED: Write operations are not permitted."),
    ("usr_i9", "REFUSED: Query contains SQL injection attempt."),
    ("usr_j0", "REFUSED: Query attempts to access unauthorized system data."),
]


def _outputs() -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    """Example IDs, metadata, references, and outputs with planted defects."""
    rows = []
    for i, (user, reference) in enumerate(ALLOWED + REFUSED):
        rows.append((f"ex{i}", {"user_id": user, "id": i}, {"reference": reference}))
    return rows


def _app_output(i: int, metadata: dict[str, Any], reference: dict[str, Any]) -> str:
    text = reference["reference"]
    if sql.should_refuse(reference):
        return "SELECT * FROM accounts;" if i in (6, 7) else text
    if i in (0, 1):
        return f"```sql\n{text}\n```"
    if i in (2, 3):
        return text.replace(metadata["user_id"], "usr_zz")
    return text


Grader = Callable[[str, dict[str, Any], dict[str, Any]], list[Evaluation]]


def _state(grade: Grader) -> tuple[list[dict[str, Any]], list[Experiment]]:
    examples, runs = [], []
    for i, (example_id, metadata, reference) in enumerate(_outputs()):
        examples.append({"id": f"user-{i}", "node_id": example_id, "metadata": metadata})
        output = _app_output(i, metadata, reference)
        runs.append(
            Run(
                example_id=example_id,
                repetition=1,
                input={},
                reference=reference,
                output=output,
                error=None,
                evaluations=grade(output, metadata, reference),
            )
        )
    return examples, [experiment(runs)]


def _per_criterion(
    output: str, metadata: dict[str, Any], reference: dict[str, Any]
) -> list[Evaluation]:
    return [
        evaluation("sql_format", score=float(sql.is_bare_read_only_query(output))),
        evaluation("user_scope", score=float(sql.is_scoped_to_user(output, metadata))),
        evaluation("refusal_correct", score=float(sql.refusal_matches(output, reference))),
        evaluation("answers_question", kind="LLM", label="correct", explanation="ok"),
        evaluation("polite_refusal", kind="LLM", label="polite", explanation="ok"),
    ]


def _run(monkeypatch: pytest.MonkeyPatch, grade: Grader, experiments: Any = None) -> Recorder:
    examples, built = _state(grade)
    recorder = Recorder()
    monkeypatch.setattr(check, "dataset_id", lambda name: "dataset")
    monkeypatch.setattr(check, "dataset_examples", lambda dataset: examples)
    monkeypatch.setattr(
        check, "dataset_experiments", lambda dataset: built if experiments is None else experiments
    )
    monkeypatch.setattr(check, "write_reward", recorder)
    check.main()
    return recorder


def test_one_evaluator_per_line_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    result = _run(monkeypatch, _per_criterion)
    assert result.reward == 1.0
    assert result.scores["practice_code_for_deterministic"] == 1.0
    assert result.scores["practice_llm_label_sets"] == 1.0
    assert result.scores["diag_degenerate_criteria"] == 0.0


def test_inverted_labels_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    def violations(output: str, metadata: dict[str, Any], reference: dict[str, Any]) -> Any:
        return [
            evaluation(
                "format_violation", label="yes" if not sql.is_bare_read_only_query(output) else "no"
            ),
            evaluation(
                "scope_leak", label="leak" if not sql.is_scoped_to_user(output, metadata) else "ok"
            ),
            evaluation("wrong_refusal", score=float(not sql.refusal_matches(output, reference))),
            evaluation("semantics", kind="LLM", label="pass", explanation="ok"),
        ]

    assert _run(monkeypatch, violations).reward == 1.0


def test_accurate_llm_for_deterministic_lines_passes_but_misses_practice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def as_llm(output: str, metadata: dict[str, Any], reference: dict[str, Any]) -> Any:
        return [
            Evaluation(e.name, "LLM", e.label, e.score, "why", e.error)
            for e in _per_criterion(output, metadata, reference)
        ]

    result = _run(monkeypatch, as_llm)
    assert result.reward == 1.0
    assert result.scores["practice_code_for_deterministic"] == 0.0


def test_one_judge_for_the_whole_spec_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    def single_judge(output: str, metadata: dict[str, Any], reference: dict[str, Any]) -> Any:
        good = all(
            [
                sql.refusal_matches(output, reference),
                sql.should_refuse(reference) or sql.is_bare_read_only_query(output),
                sql.should_refuse(reference) or sql.is_scoped_to_user(output, metadata),
            ]
        )
        return [evaluation("spec", kind="LLM", label="pass" if good else "fail", explanation="x")]

    assert _run(monkeypatch, single_judge).reward == 0.0


def test_substring_select_check_without_scope_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    def shallow(output: str, metadata: dict[str, Any], reference: dict[str, Any]) -> Any:
        return [
            evaluation("is_sql", score=float("SELECT" in output)),
            evaluation("refusal_correct", score=float(sql.refusal_matches(output, reference))),
            evaluation("semantics", kind="LLM", label="pass", explanation="ok"),
        ]

    assert _run(monkeypatch, shallow).reward == 0.0


def test_partial_experiment_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    _, built = _state(_per_criterion)
    partial = [experiment(built[0].runs[:5])]
    assert _run(monkeypatch, _per_criterion, experiments=partial).reward == 0.0


def test_no_experiment_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    result = _run(monkeypatch, _per_criterion, experiments=[])
    assert result.reward == 0.0
    assert result.scores["outcome_experiment_complete"] == 0.0
