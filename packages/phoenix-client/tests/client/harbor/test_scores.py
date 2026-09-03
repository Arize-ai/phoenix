# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
"""Tests for Harbor reward and infrastructure evaluation extraction."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, cast

import pytest

pytest.importorskip("harbor", reason="Harbor requires Python >=3.12")

from harbor.models.trial.result import ExceptionInfo, StepResult, TimingInfo, TrialResult
from harbor.models.verifier.result import VerifierResult

from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._scores import ExtractedEvaluation, extract_evaluations

NOW = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)


def exception(kind: str = "RuntimeError", message: str = "failed") -> ExceptionInfo:
    return ExceptionInfo(
        exception_type=kind,
        exception_message=message,
        exception_traceback="traceback",
        occurred_at=NOW,
    )


def verifier(**rewards: Any) -> VerifierResult:
    return VerifierResult(rewards=rewards)


def step(
    name: str,
    *,
    rewards: dict[str, Any] | None = None,
    error: Any = None,
    timing: TimingInfo | None = None,
) -> StepResult:
    return StepResult(
        step_name=name,
        verifier_result=VerifierResult(rewards=rewards) if rewards is not None else None,
        exception_info=error,
        verifier=timing,
    )


def trial_result(
    *,
    rewards: dict[str, Any] | None = None,
    error: Any = None,
    steps: list[StepResult] | None = None,
    verifier_timing: TimingInfo | None = None,
) -> TrialResult:
    return cast(
        TrialResult,
        SimpleNamespace(
            id="trial-id",
            trial_name="task-a__1",
            task_name="task-a",
            started_at=NOW,
            finished_at=NOW + timedelta(seconds=10),
            verifier_result=(VerifierResult(rewards=rewards) if rewards is not None else None),
            exception_info=error,
            step_results=steps,
            verifier=verifier_timing,
        ),
    )


def by_name(
    records: tuple[ExtractedEvaluation, ...],
) -> dict[str, ExtractedEvaluation]:
    return {record.name: record for record in records}


@pytest.mark.parametrize(
    ("result", "expected"),
    [
        (trial_result(rewards={"reward": 1.0}), {"reward": 1.0, "infra_ok": 1.0}),
        (trial_result(rewards={"reward": 0.0}), {"reward": 0.0, "infra_ok": 1.0}),
        (trial_result(error=exception("AgentError")), {"infra_ok": 0.0}),
        (
            trial_result(
                rewards={"reward": 0.5},
                steps=[
                    step("step_01", rewards={"reward": 1}),
                    step("step_02", error=exception("VerifierError")),
                ],
            ),
            {"reward": 0.5, "infra_ok": 0.0, "step_01.reward": 1.0},
        ),
        (
            trial_result(steps=[step("step_01", error=exception("VerifierError"))]),
            {"infra_ok": 0.0},
        ),
        (
            trial_result(error=exception("CancelledError", "cancelled")),
            {"infra_ok": 0.0},
        ),
    ],
    ids=[
        "success",
        "behavioral-zero",
        "single-step-failure",
        "multi-step-failure-with-derived-result",
        "multi-step-failure-without-derived-result",
        "cancellation",
    ],
)
def test_state_matrix(result: TrialResult, expected: dict[str, float]) -> None:
    records = by_name(extract_evaluations(result))
    assert {name: record.score for name, record in records.items()} == expected


def test_trial_rewards_keep_their_harbor_names() -> None:
    records = by_name(extract_evaluations(trial_result(rewards={"reward": 0.75, "count": 4})))

    assert set(records) == {"reward", "infra_ok", "count"}
    assert records["reward"].metadata == {"harbor_trial_id": "trial-id"}
    assert records["count"].score == 4.0


def test_sole_non_reward_key_is_not_promoted_to_reward() -> None:
    records = by_name(extract_evaluations(trial_result(rewards={"accuracy": 0.8})))

    assert set(records) == {"accuracy", "infra_ok"}
    assert records["accuracy"].score == 0.8


def test_multi_key_result_without_reward_keeps_each_name() -> None:
    records = by_name(extract_evaluations(trial_result(rewards={"tool_calls": 4, "accuracy": 0.8})))

    assert set(records) == {"infra_ok", "accuracy", "tool_calls"}


@pytest.mark.parametrize("strategy", ["mean", "final"])
def test_multi_step_strategy_is_attached_to_trial_rewards(
    strategy: Any,
) -> None:
    records = by_name(
        extract_evaluations(
            trial_result(rewards={"accuracy": 0.8, "tool_calls": 4}),
            multi_step_reward_strategy=strategy,
        )
    )

    assert records["accuracy"].metadata == {
        "harbor_trial_id": "trial-id",
        "multi_step_reward_strategy": strategy,
    }
    assert records["tool_calls"].metadata == records["accuracy"].metadata
    assert "multi_step_reward_strategy" not in records["infra_ok"].metadata


def test_step_scores_keep_their_scale_and_verifier_times() -> None:
    timing = TimingInfo(
        started_at=NOW + timedelta(seconds=5),
        finished_at=NOW + timedelta(seconds=7),
    )
    records = by_name(
        extract_evaluations(
            trial_result(steps=[step("step_01", rewards={"tool_calls": 8}, timing=timing)])
        )
    )

    score = records["step_01.tool_calls"]
    assert score.score == 8.0
    assert (score.start_time, score.end_time) == (timing.started_at, timing.finished_at)


def test_infrastructure_explanation_lists_trial_and_step_failures() -> None:
    records = by_name(
        extract_evaluations(
            trial_result(
                error=exception("AgentTimeout", "too slow"),
                steps=[step("step_02", error=exception("VerifierError", "bad output"))],
            )
        )
    )

    infra = records["infra_ok"]
    assert infra.label == "infra_failure"
    assert infra.explanation == (
        "trial: AgentTimeout: too slow; step_02: VerifierError: bad output"
    )


def test_generated_name_collision_raises() -> None:
    result = trial_result(
        steps=[
            step("a", rewards={"b.c": 1.0}),
            step("a.b", rewards={"c": 1.0}),
        ],
    )

    with pytest.raises(HarborPluginError, match="a.b.c.*both"):
        extract_evaluations(result)


def test_harbor_numeric_coercion_passes_through_as_float_scores() -> None:
    result = trial_result(rewards={"reward": True, "count": 2})
    records = by_name(extract_evaluations(result))

    assert records["reward"].score == 1.0
    assert records["count"].score == 2.0
    assert isinstance(records["reward"].score, float)
