# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Tests for ATIF trajectory validation."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict

import pytest

from phoenix.client.helpers.atif._validate import _validate_atif_trajectory

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> Dict[str, Any]:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)  # type: ignore[no-any-return]


@pytest.fixture()
def simple_trajectory() -> Dict[str, Any]:
    return _load_fixture("simple_trajectory.json")


@pytest.fixture()
def multi_tool_trajectory() -> Dict[str, Any]:
    return _load_fixture("multi_tool_trajectory.json")


class TestValidTrajectories:
    def test_simple_trajectory_passes(self, simple_trajectory: Dict[str, Any]) -> None:
        _validate_atif_trajectory(simple_trajectory)

    def test_multi_tool_trajectory_passes(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        _validate_atif_trajectory(multi_tool_trajectory)

    def test_real_harbor_trajectory_passes(self) -> None:
        """Validates that a real Harbor ATIF-v1.2 trajectory passes validation."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.2",
            "session_id": "a232fe2e-4a36-4aaa-a3d0-821ecd662a0f",
            "agent": {
                "name": "claude-code",
                "version": "2.1.75",
                "model_name": "<synthetic>",
                "extra": {"cwds": ["/app"], "git_branches": ["master"]},
            },
            "steps": [
                {
                    "step_id": 1,
                    "timestamp": "2026-03-13T19:46:42.637Z",
                    "source": "user",
                    "message": "Fix the vulnerability in the code.",
                    "extra": {"is_sidechain": False},
                },
                {
                    "step_id": 2,
                    "timestamp": "2026-03-13T19:46:42.657Z",
                    "source": "agent",
                    "model_name": "<synthetic>",
                    "message": "Not logged in",
                    "metrics": {
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "cached_tokens": 0,
                        "extra": {
                            "cache_creation_input_tokens": 0,
                            "cache_read_input_tokens": 0,
                        },
                    },
                    "extra": {"stop_reason": "stop_sequence"},
                },
            ],
            "final_metrics": {
                "total_prompt_tokens": 0,
                "total_completion_tokens": 0,
                "total_cached_tokens": 0,
                "total_steps": 2,
                "extra": {"total_cache_creation_input_tokens": 0},
            },
        }
        _validate_atif_trajectory(trajectory)


class TestHarborGoldenFilesValidation:
    """Validate all Harbor golden trajectory files pass validation."""

    @pytest.mark.parametrize(
        "fixture_name",
        [
            "harbor_openhands.json",
            "harbor_terminus2_summarization.json",
            "harbor_terminus2_continuation.json",
            "harbor_terminus2_continuation_cont1.json",
            "harbor_terminus2_invalid_json.json",
            "harbor_terminus2_timeout.json",
            "harbor_terminus2_sub_summary.json",
            "harbor_terminus2_sub_answers.json",
            "harbor_terminus2_sub_questions.json",
        ],
    )
    def test_harbor_golden_file_passes_validation(self, fixture_name: str) -> None:
        trajectory = _load_fixture(fixture_name)
        _validate_atif_trajectory(trajectory)  # should not raise


class TestMissingRootFields:
    @pytest.mark.parametrize(
        "field",
        ["schema_version", "session_id", "agent", "steps"],
    )
    def test_missing_root_field(self, simple_trajectory: Dict[str, Any], field: str) -> None:
        del simple_trajectory[field]
        with pytest.raises(ValueError, match=f"Missing required root field: '{field}'"):
            _validate_atif_trajectory(simple_trajectory)


class TestSchemaVersion:
    def test_invalid_format(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["schema_version"] = "v1.4"
        with pytest.raises(ValueError, match="Invalid schema_version"):
            _validate_atif_trajectory(simple_trajectory)

    def test_empty_string(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["schema_version"] = ""
        with pytest.raises(ValueError, match="Invalid schema_version"):
            _validate_atif_trajectory(simple_trajectory)

    def test_v2_hard_rejected(self, simple_trajectory: Dict[str, Any]) -> None:
        """ATIF v2.0 should be hard rejected."""
        simple_trajectory["schema_version"] = "ATIF-v2.0"
        with pytest.raises(ValueError, match="Unsupported ATIF major version 2"):
            _validate_atif_trajectory(simple_trajectory)

    def test_v1_7_warns(
        self, simple_trajectory: Dict[str, Any], caplog: pytest.LogCaptureFixture
    ) -> None:
        """ATIF v1.7 should pass validation but emit a warning."""
        simple_trajectory["schema_version"] = "ATIF-v1.7"
        with caplog.at_level(logging.WARNING):
            _validate_atif_trajectory(simple_trajectory)
        assert "newer than the latest supported version" in caplog.text

    def test_v1_6_no_warning(
        self, simple_trajectory: Dict[str, Any], caplog: pytest.LogCaptureFixture
    ) -> None:
        """ATIF v1.6 should pass without any warning."""
        simple_trajectory["schema_version"] = "ATIF-v1.6"
        with caplog.at_level(logging.WARNING):
            _validate_atif_trajectory(simple_trajectory)
        assert caplog.text == ""


class TestAgentValidation:
    @pytest.mark.parametrize("field", ["name", "version"])
    def test_missing_required_agent_field(
        self, simple_trajectory: Dict[str, Any], field: str
    ) -> None:
        del simple_trajectory["agent"][field]
        with pytest.raises(ValueError, match=f"agent field: '{field}'"):
            _validate_atif_trajectory(simple_trajectory)

    def test_model_name_is_optional(self, simple_trajectory: Dict[str, Any]) -> None:
        """agent.model_name is optional per the ATIF spec."""
        del simple_trajectory["agent"]["model_name"]
        _validate_atif_trajectory(simple_trajectory)  # should not raise

    def test_model_name_must_be_string_if_present(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["agent"]["model_name"] = 123
        with pytest.raises(ValueError, match="model_name must be a string"):
            _validate_atif_trajectory(simple_trajectory)


class TestStepValidation:
    def test_empty_steps(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["steps"] = []
        with pytest.raises(ValueError, match="non-empty list"):
            _validate_atif_trajectory(simple_trajectory)

    def test_non_sequential_step_ids(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["steps"][1]["step_id"] = 5
        with pytest.raises(ValueError, match="sequential"):
            _validate_atif_trajectory(simple_trajectory)

    def test_invalid_source(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["steps"][0]["source"] = "invalid"
        with pytest.raises(ValueError, match="must be one of"):
            _validate_atif_trajectory(simple_trajectory)

    def test_user_step_missing_message(self, simple_trajectory: Dict[str, Any]) -> None:
        del simple_trajectory["steps"][0]["message"]
        with pytest.raises(ValueError, match="message is required"):
            _validate_atif_trajectory(simple_trajectory)

    def test_agent_only_fields_on_user_step(self, simple_trajectory: Dict[str, Any]) -> None:
        simple_trajectory["steps"][0]["model_name"] = "gpt-4"
        with pytest.raises(ValueError, match="not allowed on user"):
            _validate_atif_trajectory(simple_trajectory)

    def test_timestamp_is_optional(self, simple_trajectory: Dict[str, Any]) -> None:
        """timestamp is optional per the ATIF spec."""
        for step in simple_trajectory["steps"]:
            step.pop("timestamp", None)
        _validate_atif_trajectory(simple_trajectory)  # should not raise

    def test_observation_allowed_on_system_step(self, simple_trajectory: Dict[str, Any]) -> None:
        """observation is allowed on any source since ATIF v1.2."""
        # Replace step 1 (user) with a system step that has observation
        simple_trajectory["steps"][0] = {
            "step_id": 1,
            "timestamp": "2025-01-15T10:30:00Z",
            "source": "system",
            "message": "System check complete.",
            "observation": {
                "results": [{"content": "All systems operational"}],
            },
        }
        _validate_atif_trajectory(simple_trajectory)  # should not raise

    def test_system_step_with_tool_calls_and_metrics_allowed(self) -> None:
        """System steps can have tool_calls and metrics since v1.2."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "sys-tools",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "system",
                    "message": "Running diagnostics.",
                    "tool_calls": [
                        {
                            "tool_call_id": "tc_diag",
                            "function_name": "run_diagnostics",
                            "arguments": {},
                        }
                    ],
                    "metrics": {"prompt_tokens": 100, "completion_tokens": 20},
                    "observation": {
                        "results": [{"source_call_id": "tc_diag", "content": "All OK"}],
                    },
                },
            ],
        }
        _validate_atif_trajectory(trajectory)  # should not raise

    def test_system_step_observation_without_tool_calls_validated(self) -> None:
        """System step with observation but no tool_calls should validate structure."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "sys-obs-only",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "system",
                    "message": "Context update.",
                    "observation": {
                        "results": [{"source_call_id": "ref-123", "content": "Some context data"}],
                    },
                },
            ],
        }
        # source_call_id present but no tool_calls — should NOT error
        _validate_atif_trajectory(trajectory)

    def test_system_step_bad_observation_structure_rejected(self) -> None:
        """Observation with missing 'results' should be rejected even on system steps."""
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.4",
            "session_id": "sys-bad-obs",
            "agent": {"name": "agent", "version": "1.0"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "system",
                    "message": "Bad observation.",
                    "observation": {"bad_key": "no results"},
                },
            ],
        }
        with pytest.raises(ValueError, match="observation.*must be a dict with 'results'"):
            _validate_atif_trajectory(trajectory)


class TestToolCallObservationValidation:
    def test_mismatched_source_call_id(self, simple_trajectory: Dict[str, Any]) -> None:
        step = simple_trajectory["steps"][1]
        step["observation"]["results"][0]["source_call_id"] = "nonexistent"
        with pytest.raises(ValueError, match="does not match"):
            _validate_atif_trajectory(simple_trajectory)

    def test_valid_parallel_tool_calls(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        # Step 2 has 3 parallel tool calls — should pass
        _validate_atif_trajectory(multi_tool_trajectory)

    def test_observation_result_fields_are_optional(
        self, simple_trajectory: Dict[str, Any]
    ) -> None:
        """source_call_id and content are optional per the ATIF spec."""
        step = simple_trajectory["steps"][1]
        # Replace observation with a result that omits source_call_id and content
        step["observation"] = {"results": [{}]}
        _validate_atif_trajectory(simple_trajectory)  # should not raise
