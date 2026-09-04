# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Tests for ``upload_atif_trajectories_as_spans`` against a mock client."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest

from phoenix.client.helpers.atif import (
    _convert_atif_trajectories_to_spans,
    upload_atif_trajectories_as_spans,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> Dict[str, Any]:
    with open(FIXTURES_DIR / name, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


def _uploaded_spans(trajectories: List[Dict[str, Any]], project_name: str) -> List[Any]:
    mock_client = MagicMock()
    upload_atif_trajectories_as_spans(mock_client, trajectories, project_name=project_name)
    mock_client.spans.log_spans.assert_called_once()
    call = mock_client.spans.log_spans.call_args
    assert call.kwargs["project_identifier"] == project_name
    return list(call.kwargs["spans"])


@pytest.fixture()
def simple_trajectory() -> Dict[str, Any]:
    return _load_fixture("simple_trajectory.json")


@pytest.fixture()
def multi_tool_trajectory() -> Dict[str, Any]:
    return _load_fixture("multi_tool_trajectory.json")


class TestUploadIntegration:
    def test_uploader_sends_the_conversion_output_to_the_project(
        self, simple_trajectory: Dict[str, Any], multi_tool_trajectory: Dict[str, Any]
    ) -> None:
        batch = [simple_trajectory, multi_tool_trajectory]
        spans = _uploaded_spans(batch, "batch-project")
        assert spans == _convert_atif_trajectories_to_spans(batch)
        assert all(
            {"name", "context", "span_kind", "start_time", "end_time", "status_code"} <= span.keys()
            for span in spans
        )

    def test_returns_the_log_spans_response(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {"total_received": 6, "total_queued": 6}
        result = upload_atif_trajectories_as_spans(
            mock_client, [simple_trajectory], project_name="test-project"
        )
        assert result == {"total_received": 6, "total_queued": 6}

    def test_invalid_trajectory_raises_before_api_call(self) -> None:
        mock_client = MagicMock()
        with pytest.raises(ValueError):
            upload_atif_trajectories_as_spans(
                mock_client, [{"invalid": "data"}], project_name="default"
            )
        mock_client.spans.log_spans.assert_not_called()

    def test_continuation_upload_uses_fresh_steps_for_timing_and_structure(self) -> None:
        trajectory: Dict[str, Any] = {
            "schema_version": "ATIF-v1.7",
            "session_id": "continued-run-cont-1",
            "trajectory_id": "continued-document",
            "agent": {"name": "agent", "version": "1.0", "model_name": "model"},
            "steps": [
                {
                    "step_id": 1,
                    "source": "user",
                    "message": "old request",
                    "timestamp": "2025-01-15T09:00:00Z",
                    "is_copied_context": True,
                },
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "old response",
                    "timestamp": "2025-01-15T09:00:01Z",
                    "is_copied_context": True,
                },
                {
                    "step_id": 3,
                    "source": "user",
                    "message": "continue",
                    "timestamp": "2025-01-15T10:00:00Z",
                },
                {
                    "step_id": 4,
                    "source": "agent",
                    "message": "running tools",
                    "timestamp": "2025-01-15T10:00:05Z",
                    "tool_calls": [
                        {"tool_call_id": "call_a", "function_name": "tool_a", "arguments": {}},
                        {"tool_call_id": "call_b", "function_name": "tool_b", "arguments": {}},
                    ],
                    "observation": {
                        "results": [
                            {"source_call_id": "call_a", "content": "a"},
                            {"source_call_id": "call_b", "content": "b"},
                        ]
                    },
                },
                {
                    "step_id": 5,
                    "source": "agent",
                    "message": "done",
                    "timestamp": "2025-01-15T10:00:08Z",
                },
            ],
        }

        spans = _uploaded_spans([trajectory], "continued-run")
        root = spans[0]
        step_spans = [span for span in spans if span["span_kind"] == "CHAIN"]
        llm_spans = [span for span in spans if span["span_kind"] == "LLM"]
        tool_spans = [span for span in spans if span["span_kind"] == "TOOL"]

        assert root["name"] == "invoke_agent agent (continuation)"
        assert [span["name"] for span in step_spans] == ["iteration 1", "iteration 2"]
        assert [span["name"] for span in tool_spans] == [
            "execute_tool tool_a",
            "execute_tool tool_b",
        ]
        assert (root["start_time"], root["end_time"]) == (
            "2025-01-15T10:00:00+00:00",
            "2025-01-15T10:00:08+00:00",
        )
        assert [(span["start_time"], span["end_time"]) for span in step_spans] == [
            ("2025-01-15T10:00:00+00:00", "2025-01-15T10:00:05+00:00"),
            ("2025-01-15T10:00:05+00:00", "2025-01-15T10:00:08+00:00"),
        ]
        assert [(span["start_time"], span["end_time"]) for span in llm_spans] == [
            ("2025-01-15T10:00:05+00:00", "2025-01-15T10:00:05+00:00"),
            ("2025-01-15T10:00:08+00:00", "2025-01-15T10:00:08+00:00"),
        ]
        assert all(
            span["start_time"] == span["end_time"] == "2025-01-15T10:00:05+00:00"
            for span in tool_spans
        )
        assert [span["parent_id"] for span in llm_spans] == [
            span["context"]["span_id"] for span in step_spans
        ]

    def test_system_handoff_without_tool_attaches_child_to_system_step(self) -> None:
        child: Dict[str, Any] = {
            "schema_version": "ATIF-v1.7",
            "trajectory_id": "child-document",
            "agent": {"name": "summarizer", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "summarize"},
                {"step_id": 2, "source": "agent", "message": "summary"},
            ],
        }
        parent: Dict[str, Any] = {
            "schema_version": "ATIF-v1.7",
            "session_id": "handoff-run",
            "trajectory_id": "parent-document",
            "agent": {"name": "primary", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "work"},
                {
                    "step_id": 2,
                    "source": "system",
                    "message": "Compacted context",
                    "observation": {
                        "results": [
                            {"subagent_trajectory_ref": [{"trajectory_id": "child-document"}]}
                        ]
                    },
                },
                {"step_id": 3, "source": "agent", "message": "continued"},
            ],
            "subagent_trajectories": [child],
        }

        spans = _uploaded_spans([parent], "handoff-run")
        system_step = next(span for span in spans if span["name"] == "system event 1")
        child_root = next(span for span in spans if span["name"] == "invoke_agent summarizer")
        span_ids = {span["context"]["span_id"] for span in spans}

        assert child_root["parent_id"] == system_step["context"]["span_id"]
        assert all(span.get("parent_id") in span_ids for span in spans if span.get("parent_id"))

    def test_copied_subagent_reference_does_not_replace_fresh_tool_parent(self) -> None:
        child: Dict[str, Any] = {
            "schema_version": "ATIF-v1.7",
            "trajectory_id": "child-document",
            "agent": {"name": "worker", "version": "1.0"},
            "steps": [
                {"step_id": 1, "source": "user", "message": "work"},
                {"step_id": 2, "source": "agent", "message": "done"},
            ],
        }
        parent: Dict[str, Any] = {
            "schema_version": "ATIF-v1.7",
            "session_id": "delegation-run",
            "trajectory_id": "parent-document",
            "agent": {"name": "primary", "version": "1.0"},
            "subagent_trajectories": [child],
            "steps": [
                {"step_id": 1, "source": "user", "message": "delegate"},
                {
                    "step_id": 2,
                    "source": "agent",
                    "message": "delegating",
                    "tool_calls": [
                        {"tool_call_id": "fresh-call", "function_name": "delegate", "arguments": {}}
                    ],
                    "observation": {
                        "results": [
                            {
                                "source_call_id": "fresh-call",
                                "subagent_trajectory_ref": [{"trajectory_id": "child-document"}],
                            }
                        ]
                    },
                },
                {
                    "step_id": 3,
                    "source": "agent",
                    "message": "replayed delegation",
                    "is_copied_context": True,
                    "observation": {
                        "results": [
                            {"subagent_trajectory_ref": [{"trajectory_id": "child-document"}]}
                        ]
                    },
                },
            ],
        }

        spans = _convert_atif_trajectories_to_spans([parent])
        fresh_tool = next(span for span in spans if span["name"] == "execute_tool delegate")
        child_root = next(span for span in spans if span["name"] == "invoke_agent worker")

        assert child_root.get("parent_id") == fresh_tool["context"]["span_id"]
