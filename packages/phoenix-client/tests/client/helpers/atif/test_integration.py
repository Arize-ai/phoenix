# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Integration test: upload_atif_trajectories_as_spans with mock transport."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock

import pytest

from phoenix.client.helpers.atif import (
    _convert_atif_trajectories_to_spans,
    upload_atif_trajectories_as_spans,
)
from phoenix.client.helpers.atif._convert import (
    _sha256_span_id,
    _sha256_trace_id,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> Dict[str, Any]:
    with open(FIXTURES_DIR / name, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


@pytest.fixture()
def simple_trajectory() -> Dict[str, Any]:
    return _load_fixture("simple_trajectory.json")


@pytest.fixture()
def multi_tool_trajectory() -> Dict[str, Any]:
    return _load_fixture("multi_tool_trajectory.json")


@pytest.fixture()
def subagent_fixture() -> Dict[str, Any]:
    return _load_fixture("subagent_trajectories.json")


@pytest.fixture()
def v17_embedded_subagents() -> Dict[str, Any]:
    return _load_fixture("v17_embedded_subagents.json")


class TestUploadIntegration:
    def test_upload_uses_fresh_steps_for_execution_timing_and_structure(self) -> None:
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
                        {
                            "tool_call_id": "call_a",
                            "function_name": "tool_a",
                            "arguments": {},
                        },
                        {
                            "tool_call_id": "call_b",
                            "function_name": "tool_b",
                            "arguments": {},
                        },
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
        mock_client = MagicMock()

        upload_atif_trajectories_as_spans(
            mock_client,
            [trajectory],
            project_name="continued-run",
        )

        spans = mock_client.spans.log_spans.call_args.kwargs["spans"]
        root = spans[0]
        llm_spans = [span for span in spans if span["span_kind"] == "LLM"]
        tool_spans = [span for span in spans if span["span_kind"] == "TOOL"]

        assert [span["name"] for span in spans] == [
            "agent (continuation)",
            "agent_action_1",
            "LLM",
            "tool_a",
            "tool_b",
            "agent_action_2",
            "LLM",
        ]
        assert root["start_time"] == "2025-01-15T10:00:00+00:00"
        assert root["end_time"] == "2025-01-15T10:00:08+00:00"
        step_spans = [span for span in spans if span["span_kind"] == "CHAIN"]
        assert [(span["start_time"], span["end_time"]) for span in step_spans] == [
            ("2025-01-15T10:00:00+00:00", "2025-01-15T10:00:05+00:00"),
            ("2025-01-15T10:00:05+00:00", "2025-01-15T10:00:08+00:00"),
        ]
        assert [(span["start_time"], span["end_time"]) for span in llm_spans] == [
            ("2025-01-15T10:00:05+00:00", "2025-01-15T10:00:05+00:00"),
            ("2025-01-15T10:00:08+00:00", "2025-01-15T10:00:08+00:00"),
        ]
        assert [(span["start_time"], span["end_time"]) for span in tool_spans] == [
            ("2025-01-15T10:00:05+00:00", "2025-01-15T10:00:05+00:00"),
            ("2025-01-15T10:00:05+00:00", "2025-01-15T10:00:05+00:00"),
        ]
        assert [span["parent_id"] for span in llm_spans] == [
            step_spans[0]["context"]["span_id"],
            step_spans[1]["context"]["span_id"],
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
        mock_client = MagicMock()

        upload_atif_trajectories_as_spans(
            mock_client,
            [parent],
            project_name="handoff-run",
        )

        spans = mock_client.spans.log_spans.call_args.kwargs["spans"]
        system_step = next(span for span in spans if span["name"] == "system_action_1")
        child_root = next(span for span in spans if span["name"] == "summarizer")
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
                        {
                            "tool_call_id": "fresh-call",
                            "function_name": "delegate",
                            "arguments": {},
                        }
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
        fresh_tool = next(span for span in spans if span["name"] == "delegate")
        child_root = next(span for span in spans if span["name"] == "worker")

        assert child_root.get("parent_id") == fresh_tool["context"]["span_id"]

    def test_uploader_uses_unchanged_conversion_output(
        self, simple_trajectory: Dict[str, Any]
    ) -> None:
        mock_client = MagicMock()
        expected_spans = _convert_atif_trajectories_to_spans([simple_trajectory])

        upload_atif_trajectories_as_spans(
            mock_client,
            [simple_trajectory],
            project_name="default",
        )

        assert mock_client.spans.log_spans.call_args.kwargs["spans"] == expected_spans

    def test_calls_log_spans_with_correct_project(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 4,
            "total_queued": 4,
        }

        result = upload_atif_trajectories_as_spans(
            mock_client,
            [simple_trajectory],
            project_name="test-project",
        )

        mock_client.spans.log_spans.assert_called_once()
        call_kwargs = mock_client.spans.log_spans.call_args
        assert call_kwargs.kwargs["project_identifier"] == "test-project"
        assert result["total_received"] == 4

    def test_span_count_matches(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 4,
            "total_queued": 4,
        }

        upload_atif_trajectories_as_spans(mock_client, [simple_trajectory], project_name="default")

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]
        assert len(spans) == 6

    def test_multi_tool_span_count(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 8,
            "total_queued": 8,
        }

        upload_atif_trajectories_as_spans(
            mock_client, [multi_tool_trajectory], project_name="default"
        )

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]
        assert len(spans) == 11

    def test_invalid_trajectory_raises_before_api_call(
        self,
    ) -> None:
        mock_client = MagicMock()
        bad_trajectory: Dict[str, Any] = {"invalid": "data"}

        with pytest.raises(ValueError):
            upload_atif_trajectories_as_spans(mock_client, [bad_trajectory], project_name="default")

        mock_client.spans.log_spans.assert_not_called()

    def test_spans_have_valid_structure(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 4,
            "total_queued": 4,
        }

        upload_atif_trajectories_as_spans(mock_client, [simple_trajectory], project_name="default")

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]

        for span in spans:
            assert "name" in span
            assert "context" in span
            assert "trace_id" in span["context"]
            assert "span_id" in span["context"]
            assert "span_kind" in span
            assert "start_time" in span
            assert "end_time" in span
            assert "status_code" in span

    def test_batch_upload_multiple_trajectories(
        self, simple_trajectory: Dict[str, Any], multi_tool_trajectory: Dict[str, Any]
    ) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 12,
            "total_queued": 12,
        }

        upload_atif_trajectories_as_spans(
            mock_client,
            [simple_trajectory, multi_tool_trajectory],
            project_name="batch-test",
        )

        mock_client.spans.log_spans.assert_called_once()
        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]
        assert len(spans) == 17

    def test_batch_subagent_linking(self, subagent_fixture: Dict[str, Any]) -> None:
        """Upload parent + child in one batch; child root should link to parent tool span."""
        parent = subagent_fixture["parent"]
        child = subagent_fixture["child"]
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 6,
            "total_queued": 6,
        }

        upload_atif_trajectories_as_spans(
            mock_client,
            [parent, child],
            project_name="subagent-test",
        )

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]

        # Find the child root span (summarizer agent)
        child_root = [s for s in spans if s["name"] == "summarizer"][0]
        assert "parent_id" in child_root

        # It should point to the parent's tool span
        expected_parent_tool_id = _sha256_span_id("sess-parent-001:step:2:tool:call_summarize")
        assert child_root["parent_id"] == expected_parent_tool_id

        # Child should share the parent's trace_id (from _build_subagent_ref_map)
        parent_trace_id = _sha256_trace_id("sess-parent-001:trace")
        assert child_root["context"]["trace_id"] == parent_trace_id

    def test_upload_flattens_v17_embedded_subagents(
        self, v17_embedded_subagents: Dict[str, Any]
    ) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 5,
            "total_queued": 5,
        }

        upload_atif_trajectories_as_spans(
            mock_client,
            [v17_embedded_subagents],
            project_name="v17-subagents",
        )

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]
        assert len(spans) == 9

        child_root = [s for s in spans if s["name"] == "researcher"][0]
        expected_trace_id = _sha256_trace_id("run-v17-001:trace")
        assert child_root["parent_id"] == _sha256_span_id(
            f"{expected_trace_id}:parent-doc:step:2:tool:call_delegate"
        )
        assert child_root["context"]["trace_id"] == expected_trace_id
        assert child_root["attributes"]["session.id"] == "run-v17-001"
