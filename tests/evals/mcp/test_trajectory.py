import pytest

from evals.mcp.scoring.measurements import interface_measurements
from evals.mcp.scoring.trajectory import final_answer, px_command_observed, trajectory_measurements


def test_final_answer_and_call_count_exclude_intermediate_and_copied_context():
    call = {
        "tool_call_id": "call1",
        "function_name": "execute",
        "arguments": {"code": "many operations"},
    }
    steps = [
        {"source": "user", "message": "How many?"},
        {
            "source": "agent",
            "message": "117 traces",
            "tool_calls": [call],
            "observation": {"results": [{"source_call_id": "call1", "content": "failed"}]},
        },
        {"source": "agent", "is_copied_context": True, "tool_calls": [call]},
        {"source": "agent", "message": "118 traces", "tool_calls": []},
    ]
    trajectory = {"schema_version": "ATIF-v1.7", "steps": steps}
    assert final_answer(trajectory) == "118 traces"
    assert trajectory_measurements(trajectory) == {
        "tool_measurement_complete": 1,
        "tool_call_count": 1,
        "agent_turn_count": 2,
    }
    steps.pop()
    assert final_answer(trajectory) is None
    assert "tool_call_count" not in trajectory_measurements(None)
    assert (
        trajectory_measurements(
            {"schema_version": "ATIF-v1.7", "steps": [{"source": "agent", "message": "ok"}]}
        )["tool_call_count"]
        == 0
    )


def test_target_http_without_a_px_command_does_not_prove_cli_use():
    trajectory = {
        "schema_version": "ATIF-v1.7",
        "steps": [{"source": "agent", "message": "I used px to get the answer."}],
    }
    scores = interface_measurements("cli", trajectory, [], [{"kind": "target"}])
    assert scores["interface_used"] is None
    assert scores["interface_measurement_complete"] == 0
    assert scores["px_command_observed"] == 0


@pytest.mark.parametrize(
    "command,expected",
    [
        ("pwd\npx project list", True),
        (["bash", "-lc", "px project list"], True),
        ("echo 'px project list'", False),
    ],
)
def test_px_detection_recognizes_shell_invocations_without_counting_quoted_text(command, expected):
    trajectory = {
        "schema_version": "ATIF-v1.7",
        "steps": [
            {
                "source": "agent",
                "tool_calls": [
                    {
                        "tool_call_id": "1",
                        "function_name": "shell",
                        "arguments": {"command": command},
                    }
                ],
            }
        ],
    }
    assert px_command_observed(trajectory) is expected
