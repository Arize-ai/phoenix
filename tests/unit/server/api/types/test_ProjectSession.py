from datetime import datetime, timedelta, timezone
from typing import Any, NamedTuple

import httpx
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory

from ...._helpers import (
    _add_project,
    _add_project_session,
    _add_span,
    _add_trace,
    _node,
)


class _Data(NamedTuple):
    spans: list[models.Span]
    traces: list[models.Trace]
    project_sessions: list[models.ProjectSession]
    projects: list[models.Project]
    session_annotations: list[models.ProjectSessionAnnotation]


class TestProjectSession:
    @staticmethod
    async def _node(
        field: str,
        project_session: models.ProjectSession,
        httpx_client: httpx.AsyncClient,
    ) -> Any:
        return await _node(
            field,
            ProjectSession.__name__,
            project_session.id,
            httpx_client,
        )

    @pytest.fixture
    async def _data(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        project_sessions = []
        traces = []
        spans = []
        session_annotations = []
        async with db() as session:
            project = await _add_project(session)
            start_time = datetime.now(timezone.utc)
            project_sessions.append(
                await _add_project_session(
                    session,
                    project,
                    start_time=start_time,
                )
            )
            traces.append(
                await _add_trace(
                    session,
                    project,
                    project_sessions[-1],
                    start_time=start_time,
                )
            )
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    attributes={"input": {"value": "123"}, "output": {"value": "321"}},
                    cumulative_llm_token_count_prompt=1,
                    cumulative_llm_token_count_completion=2,
                    cumulative_error_count=2,
                )
            )
            traces.append(
                await _add_trace(
                    session,
                    project,
                    project_sessions[-1],
                    start_time=start_time + timedelta(seconds=1),
                )
            )
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    attributes={
                        "input": {"value": "1234"},
                        "output": {"value": "4321"},
                    },
                    cumulative_llm_token_count_prompt=3,
                    cumulative_llm_token_count_completion=4,
                )
            )

            # Add session annotations for testing
            session_annotation_1 = models.ProjectSessionAnnotation(
                project_session_id=project_sessions[0].id,
                name="helpfulness",
                label="helpful",
                score=0.9,
                explanation="This session was very helpful",
                metadata_={"source": "user_feedback"},
                annotator_kind="HUMAN",
                source="APP",
                identifier="",
            )
            session.add(session_annotation_1)
            session_annotations.append(session_annotation_1)

            session_annotation_2 = models.ProjectSessionAnnotation(
                project_session_id=project_sessions[0].id,
                name="quality",
                label="high",
                score=0.85,
                explanation="High quality responses",
                metadata_={"reviewer": "expert"},
                annotator_kind="HUMAN",
                source="API",
                identifier="",
            )
            session.add(session_annotation_2)
            session_annotations.append(session_annotation_2)

            # Add another session annotation with same name for testing summaries
            session_annotation_3 = models.ProjectSessionAnnotation(
                project_session_id=project_sessions[0].id,
                name="helpfulness",
                label="somewhat_helpful",
                score=0.7,
                explanation="Somewhat helpful session",
                metadata_={"source": "auto_eval"},
                annotator_kind="LLM",
                source="API",
                identifier="secondary",
            )
            session.add(session_annotation_3)
            session_annotations.append(session_annotation_3)

            project_sessions.append(await _add_project_session(session, project))
        return _Data(
            spans=spans,
            traces=traces,
            project_sessions=project_sessions,
            projects=[project],
            session_annotations=session_annotations,
        )

    async def test_num_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "numTraces"
        assert await self._node(field, project_session, httpx_client) == 2

    async def test_num_traces_with_error(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "numTracesWithError"
        assert await self._node(field, project_session, httpx_client) == 1

    async def test_first_input(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "firstInput{value mimeType}"
        assert await self._node(field, project_session, httpx_client) == {
            "value": "123",
            "mimeType": "text",
        }

    async def test_last_output(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "lastOutput{value mimeType}"
        assert await self._node(field, project_session, httpx_client) == {
            "value": "4321",
            "mimeType": "text",
        }

    async def test_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "traces{edges{node{id traceId}}}"
        traces = await self._node(field, project_session, httpx_client)
        assert traces["edges"]
        assert {(edge["node"]["id"], edge["node"]["traceId"]) for edge in traces["edges"]} == {
            (str(GlobalID(Trace.__name__, str(trace.id))), trace.trace_id) for trace in _data.traces
        }

    async def test_token_usage(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_sessions = _data.project_sessions
        field = "tokenUsage{prompt completion total}"
        assert await self._node(field, project_sessions[0], httpx_client) == {
            "prompt": 4,
            "completion": 6,
            "total": 10,
        }

    async def test_trace_latency_ms_quantile(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_sessions = _data.project_sessions
        field = "traceLatencyMsQuantile(probability: 0.5)"
        assert await self._node(field, project_sessions[0], httpx_client) == 10000.0

    async def test_project(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        project = _data.projects[0]
        field = "project{id name}"
        result = await self._node(field, project_session, httpx_client)
        expected_project_id = str(GlobalID(Project.__name__, str(project.id)))
        assert result == {
            "id": expected_project_id,
            "name": project.name,
        }

    async def test_session_annotations(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = (
            "sessionAnnotations{id name label score explanation annotatorKind source identifier}"
        )
        result = await self._node(field, project_session, httpx_client)

        # Should return 3 annotations for the first session
        assert len(result) == 3

        # Convert to set of tuples for easier comparison (order may vary)
        result_annotations = {
            (anno["name"], anno["label"], anno["score"], anno["annotatorKind"]) for anno in result
        }

        expected_annotations = {
            ("helpfulness", "helpful", 0.9, "HUMAN"),
            ("quality", "high", 0.85, "HUMAN"),
            ("helpfulness", "somewhat_helpful", 0.7, "LLM"),
        }

        assert result_annotations == expected_annotations

        # Verify all annotations have required fields
        for annotation in result:
            assert annotation["id"] is not None
            assert annotation["explanation"] is not None
            assert annotation["source"] in ["APP", "API"]
            assert annotation["identifier"] is not None

    async def test_session_annotation_summaries(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "sessionAnnotationSummaries{name meanScore labelFractions{label fraction}}"
        result = await self._node(field, project_session, httpx_client)

        # Should return 2 summary entries (helpfulness and quality)
        assert len(result) == 2

        # Find summaries by name
        summaries_by_name = {summary["name"]: summary for summary in result}

        # Test helpfulness summary (has 2 annotations with scores 0.9 and 0.7)
        helpfulness_summary = summaries_by_name["helpfulness"]
        assert helpfulness_summary["meanScore"] == 0.8  # (0.9 + 0.7) / 2

        # Check label fractions for helpfulness
        label_fractions = {
            lf["label"]: lf["fraction"] for lf in helpfulness_summary["labelFractions"]
        }
        assert label_fractions["helpful"] == 0.5  # 1 out of 2
        assert label_fractions["somewhat_helpful"] == 0.5  # 1 out of 2

        # Test quality summary (has 1 annotation with score 0.85)
        quality_summary = summaries_by_name["quality"]
        assert quality_summary["meanScore"] == 0.85

        # Check label fractions for quality
        quality_label_fractions = {
            lf["label"]: lf["fraction"] for lf in quality_summary["labelFractions"]
        }
        assert quality_label_fractions["high"] == 1.0  # 1 out of 1

    async def test_session_annotations_empty_for_second_session(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        # Test that the second session (no annotations) returns empty results
        project_session = _data.project_sessions[1]

        # Test sessionAnnotations
        annotations_field = "sessionAnnotations{id name}"
        annotations_result = await self._node(annotations_field, project_session, httpx_client)
        assert annotations_result == []

        # Test sessionAnnotationSummaries
        summaries_field = "sessionAnnotationSummaries{name meanScore}"
        summaries_result = await self._node(summaries_field, project_session, httpx_client)
        assert summaries_result == []
