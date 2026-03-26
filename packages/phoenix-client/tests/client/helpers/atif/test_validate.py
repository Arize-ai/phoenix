"""Tests for ATIF trajectory validation."""

from __future__ import annotations

import json
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


class TestAgentValidation:
    @pytest.mark.parametrize("field", ["name", "version", "model_name"])
    def test_missing_agent_field(self, simple_trajectory: Dict[str, Any], field: str) -> None:
        del simple_trajectory["agent"][field]
        with pytest.raises(ValueError, match=f"agent field: '{field}'"):
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


class TestToolCallObservationValidation:
    def test_mismatched_source_call_id(self, simple_trajectory: Dict[str, Any]) -> None:
        step = simple_trajectory["steps"][1]
        step["observation"]["results"][0]["source_call_id"] = "nonexistent"
        with pytest.raises(ValueError, match="does not match"):
            _validate_atif_trajectory(simple_trajectory)

    def test_valid_parallel_tool_calls(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        # Step 2 has 3 parallel tool calls — should pass
        _validate_atif_trajectory(multi_tool_trajectory)
