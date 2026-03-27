# pyright: reportPrivateUsage=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false
"""Integration test: upload_atif_trajectory_as_spans with mock transport."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock

import pytest

from phoenix.client.helpers.atif import upload_atif_trajectory_as_spans

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


class TestUploadIntegration:
    def test_calls_log_spans_with_correct_project(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 5,
            "total_queued": 5,
        }

        result = upload_atif_trajectory_as_spans(
            mock_client,
            simple_trajectory,
            project_name="test-project",
        )

        mock_client.spans.log_spans.assert_called_once()
        call_kwargs = mock_client.spans.log_spans.call_args
        assert call_kwargs.kwargs["project_identifier"] == "test-project"
        assert result["total_received"] == 5

    def test_span_count_matches(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 5,
            "total_queued": 5,
        }

        upload_atif_trajectory_as_spans(mock_client, simple_trajectory)

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]
        assert len(spans) == 5

    def test_multi_tool_span_count(self, multi_tool_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 10,
            "total_queued": 10,
        }

        upload_atif_trajectory_as_spans(mock_client, multi_tool_trajectory)

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]
        assert len(spans) == 10

    def test_invalid_trajectory_raises_before_api_call(
        self,
    ) -> None:
        mock_client = MagicMock()
        bad_trajectory: Dict[str, Any] = {"invalid": "data"}

        with pytest.raises(ValueError):
            upload_atif_trajectory_as_spans(mock_client, bad_trajectory)

        mock_client.spans.log_spans.assert_not_called()

    def test_default_project_name(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 5,
            "total_queued": 5,
        }

        upload_atif_trajectory_as_spans(mock_client, simple_trajectory)

        call_kwargs = mock_client.spans.log_spans.call_args
        assert call_kwargs.kwargs["project_identifier"] == "default"

    def test_spans_have_valid_structure(self, simple_trajectory: Dict[str, Any]) -> None:
        mock_client = MagicMock()
        mock_client.spans.log_spans.return_value = {
            "total_received": 5,
            "total_queued": 5,
        }

        upload_atif_trajectory_as_spans(mock_client, simple_trajectory)

        call_kwargs = mock_client.spans.log_spans.call_args
        spans = call_kwargs.kwargs["spans"]

        for span in spans:
            # Every span must have required fields
            assert "name" in span
            assert "context" in span
            assert "trace_id" in span["context"]
            assert "span_id" in span["context"]
            assert "span_kind" in span
            assert "start_time" in span
            assert "end_time" in span
            assert "status_code" in span
