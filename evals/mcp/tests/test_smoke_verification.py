import json

import pytest

from smoke_verify import verify


@pytest.mark.parametrize("submission", [None, "malformed", '{"wrong":"answer"}'])
def test_smoke_verifier_preserves_behavioral_failure_and_independent_measurements(
    tmp_path, submission
):
    (tmp_path / "truth.json").write_text(
        json.dumps(
            {
                "project": "mcp-trail-gaia",
                "trace_count": 1,
                "trace_ids": ["a"],
            }
        )
    )
    (tmp_path / "evidence.json").write_text(
        json.dumps(
            {
                "shutdown_confirmed": True,
                "audit_complete": True,
                "target_state_complete": True,
                "state_unchanged": True,
                "forbidden_attempts": [],
            }
        )
    )
    (tmp_path / "judge.json").write_text('{"available":false}')
    (tmp_path / "measurements.json").write_text(
        '{"sql_attempted":4,"sql_succeeded":2,"sql_measurement_complete":1}'
    )
    if submission is not None:
        (tmp_path / "answer.json").write_text(submission)
    scores = verify(tmp_path, tmp_path)
    assert scores["reward"] == 0
    assert scores["sql_attempted"] == 4
    assert scores["sql_succeeded"] == 2
    assert "task_completeness" not in scores
    (tmp_path / "evidence.json").unlink()
    with pytest.raises(FileNotFoundError):
        verify(tmp_path, tmp_path)


def test_behavioral_failure_does_not_cancel_later_conditions():
    from types import SimpleNamespace

    from smoke_run import require_completed_results

    trial = SimpleNamespace(
        exception_info=None, verifier_result=SimpleNamespace(rewards={"reward": 0})
    )
    result = SimpleNamespace(trial_results=[trial])
    require_completed_results(result)
    trial.exception_info = "shutdown failed"
    with pytest.raises(RuntimeError, match="infrastructure"):
        require_completed_results(result)
    trial.exception_info = None
    trial.verifier_result.rewards = {}
    with pytest.raises(RuntimeError, match="missing"):
        require_completed_results(result)
