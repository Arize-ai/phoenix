# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Integration test: upload_atif_trajectories_as_spans with mock transport."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock

import pytest

from phoenix.client.helpers.atif import upload_atif_trajectories_as_spans
from phoenix.client.helpers.atif._convert import (
    _sha256_span_id,
    _sha256_trace_id,
)

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


@pytest.fixture()
def subagent_fixture() -> Dict[str, Any]:
    return _load_fixture("subagent_trajectories.json")


class TestUploadIntegration:
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
        # simple_trajectory: 1 root + 2 LLM + 1 TOOL = 4
        assert len(spans) == 4

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
        # multi_tool_trajectory: 1 root + 3 LLM + 4 TOOL = 8
        assert len(spans) == 8

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
        # 4 from simple + 8 from multi_tool = 12
        assert len(spans) == 12

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
