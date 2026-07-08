from datetime import datetime

from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.api.queries import _eval_node_parent_id, _parent_project_id
from phoenix.server.types import DbSessionFactory

_T = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")


def _require_id(value: int | None, label: str) -> int:
    assert value is not None, label
    return value


async def test_parent_project_id_walks_containment_edges(db: DbSessionFactory) -> None:
    """The access gate for containment children (spans, traces, sessions,
    annotations) resolves each one's owning project, so they inherit its access."""
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="p").returning(models.Project.id)
        )
        other_project_id = await session.scalar(
            insert(models.Project).values(name="other").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(trace_id="t1", project_rowid=project_id, start_time=_T, end_time=_T)
            .returning(models.Trace.id)
        )
        session_id = await session.scalar(
            insert(models.ProjectSession)
            .values(session_id="s1", project_id=project_id, start_time=_T, end_time=_T)
            .returning(models.ProjectSession.id)
        )
        span_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="span1",
                parent_id=None,
                name="n",
                span_kind="CHAIN",
                start_time=_T,
                end_time=_T,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
        span_annotation_id = await session.scalar(
            insert(models.SpanAnnotation)
            .values(
                span_rowid=span_id,
                name="c",
                label="x",
                score=1.0,
                explanation="",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
                identifier="i1",
            )
            .returning(models.SpanAnnotation.id)
        )
        trace_annotation_id = await session.scalar(
            insert(models.TraceAnnotation)
            .values(
                trace_rowid=trace_id,
                name="c",
                label="x",
                score=1.0,
                explanation="",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
                identifier="i1",
            )
            .returning(models.TraceAnnotation.id)
        )
        await session.commit()

    project_id = _require_id(project_id, "project_id")
    trace_id = _require_id(trace_id, "trace_id")
    session_id = _require_id(session_id, "session_id")
    span_id = _require_id(span_id, "span_id")
    span_annotation_id = _require_id(span_annotation_id, "span_annotation_id")
    trace_annotation_id = _require_id(trace_annotation_id, "trace_annotation_id")

    assert other_project_id != project_id
    async with db() as session:
        assert await _parent_project_id(session, "Trace", trace_id) == project_id
        assert await _parent_project_id(session, "Span", span_id) == project_id
        assert await _parent_project_id(session, "ProjectSession", session_id) == project_id
        assert await _parent_project_id(session, "SpanAnnotation", span_annotation_id) == project_id
        assert (
            await _parent_project_id(session, "TraceAnnotation", trace_annotation_id) == project_id
        )
        # A nonexistent node resolves to None → the caller raises not-found.
        assert await _parent_project_id(session, "Span", 999999) is None
        # An unhandled type resolves to None (not a containment child here).
        assert await _parent_project_id(session, "Dataset", span_id) is None


async def test_eval_node_parent_id_roots_at_data_context(db: DbSessionFactory) -> None:
    """Eval-world nodes derive access from their data context (access-by-parent):
    experiments, runs, jobs, and examples from the dataset; prompt versions from the
    prompt."""
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).values(name="ds", metadata_={}).returning(models.Dataset.id)
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=dataset_id, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        example_id = await session.scalar(
            insert(models.DatasetExample)
            .values(dataset_id=dataset_id)
            .returning(models.DatasetExample.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="exp",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        run_id = await session.scalar(
            insert(models.ExperimentRun)
            .values(
                experiment_id=experiment_id,
                dataset_example_id=example_id,
                output={},
                repetition_number=1,
                start_time=_T,
                end_time=_T,
                error=None,
            )
            .returning(models.ExperimentRun.id)
        )
        await session.commit()

    dataset_id = _require_id(dataset_id, "dataset_id")
    example_id = _require_id(example_id, "example_id")
    experiment_id = _require_id(experiment_id, "experiment_id")
    run_id = _require_id(run_id, "run_id")

    async with db() as session:
        assert await _eval_node_parent_id(session, "DatasetExample", example_id) == dataset_id
        assert await _eval_node_parent_id(session, "Experiment", experiment_id) == dataset_id
        assert await _eval_node_parent_id(session, "ExperimentRun", run_id) == dataset_id
        # ExperimentJob shares experiments.id 1:1, so it resolves like the experiment.
        assert await _eval_node_parent_id(session, "ExperimentJob", experiment_id) == dataset_id
        # Nonexistent / unhandled resolve to None → caller raises not-found.
        assert await _eval_node_parent_id(session, "Experiment", 999999) is None
        assert await _eval_node_parent_id(session, "DatasetSplit", example_id) is None
