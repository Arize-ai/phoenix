"""End-to-end coverage for uploading ATIF trajectories as spans.

Conversion is unit-tested in ``packages/phoenix-client/tests``; what needs a
live server is whether the resulting span batch survives a round trip. That
Phoenix accepts every span, resolves the parent links, and stores the batch as
one connected trace.

The fixtures are real Harbor terminus-2 trajectories: one main run plus the
three sub-trajectories its summarization step produced.
"""

from __future__ import annotations

import json
from pathlib import Path
from secrets import token_hex
from typing import Any, Dict, Iterator, List

import pytest

from phoenix.client import Client
from phoenix.client.__generated__ import v1
from phoenix.client.helpers.atif import (  # pyright: ignore[reportPrivateUsage]
    _convert_atif_trajectories_to_spans,
)
from phoenix.client.helpers.atif._reparent import (  # pyright: ignore[reportPrivateUsage]
    _reparent_spans_under_common_parent,
)

from .._helpers import _AppInfo, _until_spans_exist

_FIXTURES = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "phoenix-client"
    / "tests"
    / "client"
    / "helpers"
    / "atif"
    / "fixtures"
)

# One realistic Harbor trial: the main trajectory plus the sub-trajectories
# spawned by its summarization step.
_TRIAL_FIXTURES = (
    "harbor_terminus2_summarization.json",
    "harbor_terminus2_sub_questions.json",
    "harbor_terminus2_sub_answers.json",
    "harbor_terminus2_sub_summary.json",
)


@pytest.fixture
def _trial_trajectories() -> List[Dict[str, Any]]:
    return [json.loads((_FIXTURES / name).read_text()) for name in _TRIAL_FIXTURES]


@pytest.fixture
def _project(_app: _AppInfo) -> Iterator[str]:
    client = Client(base_url=_app.base_url, api_key=_app.admin_secret)
    project = client.projects.create(name=token_hex(16))
    yield project["name"]
    client.projects.delete(project_name=project["name"])


def _trial_span(trace_id: str, span_id: str) -> v1.Span:
    """The caller-owned span standing in for an enclosing operation."""
    return {
        "name": "harbor.trial task-a",
        "context": {"trace_id": trace_id, "span_id": span_id},
        "span_kind": "CHAIN",
        "start_time": "2026-03-26T10:00:00+00:00",
        "end_time": "2026-03-26T10:05:00+00:00",
        "status_code": "OK",
    }


class TestAtifTrajectoryUpload:
    async def test_trial_and_trajectories_persist_as_one_connected_trace(
        self,
        _app: _AppInfo,
        _project: str,
        _trial_trajectories: List[Dict[str, Any]],
    ) -> None:
        trace_id, parent_span_id = token_hex(16), token_hex(8)
        spans = _reparent_spans_under_common_parent(
            _convert_atif_trajectories_to_spans(_trial_trajectories),
            parent_id=parent_span_id,
            trace_id=trace_id,
        )
        batch: List[v1.Span] = [_trial_span(trace_id, parent_span_id), *spans]

        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)
        result = client.spans.log_spans(project_identifier=_project, spans=batch)
        assert result["total_queued"] == len(batch)
        await _until_spans_exist(_app, [s["context"]["span_id"] for s in batch])

        fetched = client.spans.get_spans(project_identifier=_project, limit=1000)
        assert len(fetched) == len(batch)

        # Every span landed in the trial's trace.
        assert {s["context"]["trace_id"] for s in fetched} == {trace_id}

        # Every parent link resolves to a span Phoenix actually stored.
        stored_ids = {s["context"]["span_id"] for s in fetched}
        unresolvable = [
            s["name"] for s in fetched if s.get("parent_id") and s["parent_id"] not in stored_ids
        ]
        assert not unresolvable, f"spans persisted with unresolvable parents: {unresolvable}"

        roots = {s["name"] for s in fetched if s.get("parent_id") == parent_span_id}
        assert roots == {"terminus-2"}

        handoff_step_id = next(
            s["context"]["span_id"] for s in fetched if s["name"] == "system event 1"
        )
        subagent_root_names = {
            "terminus-2-summarization-questions",
            "terminus-2-summarization-answers",
            "terminus-2-summarization-summary",
        }
        assert {
            s["name"]: s.get("parent_id") for s in fetched if s["name"] in subagent_root_names
        } == {name: handoff_step_id for name in subagent_root_names}

    async def test_separate_trials_with_distinct_trajectory_ids_do_not_collide(
        self,
        _app: _AppInfo,
        _project: str,
        _trial_trajectories: List[Dict[str, Any]],
    ) -> None:
        """Caller-supplied trial identity keeps separate uploads disjoint.

        Phoenix enforces globally unique span IDs. The Harbor integration gives
        every trajectory a stable ID derived from its logical trial before
        conversion; reparenting deliberately preserves those IDs.
        """
        client = Client(base_url=_app.base_url, api_key=_app.admin_secret)

        expected = 0
        for trial_index in range(2):
            identified_trajectories = [
                {
                    **trajectory,
                    "trajectory_id": f"trial-{trial_index}:trajectory-{trajectory_index}",
                }
                for trajectory_index, trajectory in enumerate(_trial_trajectories)
            ]
            converted = _convert_atif_trajectories_to_spans(identified_trajectories)
            trace_id, parent_span_id = token_hex(16), token_hex(8)
            batch: List[v1.Span] = [
                _trial_span(trace_id, parent_span_id),
                *_reparent_spans_under_common_parent(
                    converted, parent_id=parent_span_id, trace_id=trace_id
                ),
            ]
            client.spans.log_spans(project_identifier=_project, spans=batch)
            await _until_spans_exist(_app, [s["context"]["span_id"] for s in batch])
            expected += len(batch)

        fetched = client.spans.get_spans(project_identifier=_project, limit=1000)
        assert len(fetched) == expected, "second trial's spans were dropped as duplicates"
        assert len({s["context"]["trace_id"] for s in fetched}) == 2
