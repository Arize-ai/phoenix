from datetime import datetime, timezone

from phoenix.client.resources.experiments import (
    _evaluation_run_request_body,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.resources.experiments.types import ExperimentEvaluationRun

_NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _eval_run(**kwargs: object) -> ExperimentEvaluationRun:
    return ExperimentEvaluationRun(
        experiment_run_id="run-1",
        start_time=_NOW,
        end_time=_NOW,
        name="evaluation",
        annotator_kind="CODE",
        **kwargs,  # type: ignore[arg-type]
    )


def test_evaluator_metadata_is_sent_at_top_level() -> None:
    body = _evaluation_run_request_body(
        _eval_run(
            result={
                "score": 1.0,
                "label": "ok",
                "explanation": "fine",
                "name": "evaluation",
                "metadata": {"model": "judge-v1"},
            },
            trace_id="trace-1",
        )
    )
    assert body == {
        "experiment_run_id": "run-1",
        "name": "evaluation",
        "annotator_kind": "CODE",
        "start_time": _NOW.isoformat(),
        "end_time": _NOW.isoformat(),
        "result": {"score": 1.0, "label": "ok", "explanation": "fine"},
        "error": None,
        "metadata": {"model": "judge-v1"},
        "trace_id": "trace-1",
    }


def test_run_level_metadata_takes_precedence_over_result_metadata() -> None:
    body = _evaluation_run_request_body(
        _eval_run(
            result={"score": 0.0, "metadata": {"a": "result", "b": "result"}},
            metadata={"a": "run"},
        )
    )
    assert body["metadata"] == {"a": "run", "b": "result"}
    assert body["result"] == {"score": 0.0}


def test_errored_evaluation_has_no_result() -> None:
    body = _evaluation_run_request_body(_eval_run(error="boom"))
    assert body["result"] is None
    assert body["error"] == "boom"
    assert body["metadata"] == {}
