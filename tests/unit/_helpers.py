from datetime import datetime, timedelta, timezone
from functools import singledispatch
from secrets import token_hex
from typing import Any, Dict, Optional, Sequence, Type, TypeVar, Union, cast

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Span import Span


@singledispatch
def _gid(_: models.Base) -> str:
    raise NotImplementedError


@_gid.register
def _(obj: models.ProjectSession) -> str:
    return str(GlobalID(ProjectSession.__name__, str(obj.id)))


@_gid.register
def _(obj: models.Span) -> str:
    return str(GlobalID(Span.__name__, str(obj.id)))


async def _node(
    field: str,
    type_name: str,
    id_: int,
    httpx_client: httpx.AsyncClient,
) -> dict[str, Any]:
    query = "query($id:ID!){node(id:$id){... on " + type_name + "{" + field + "}}}"
    gid = str(GlobalID(type_name, str(id_)))
    response = await httpx_client.post(
        "/graphql",
        json={"query": query, "variables": {"id": gid}},
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    key = field.split("{")[0].split("(")[0]
    return cast(dict[str, Any], response_json["data"]["node"][key])


_RecordT = TypeVar("_RecordT", bound=models.Base)


async def _get_record_by_id(
    session: AsyncSession,
    table: Type[_RecordT],
    id_: int,
) -> Optional[_RecordT]:
    return cast(Optional[_RecordT], await session.scalar(select(table).filter_by(id=id_)))


async def _add_project(
    session: AsyncSession,
    name: Optional[str] = None,
) -> models.Project:
    project = models.Project(name=name or token_hex(4))
    session.add(project)
    await session.flush()
    assert isinstance(await _get_record_by_id(session, models.Project, project.id), models.Project)
    return project


async def _add_trace(
    session: AsyncSession,
    project: models.Project,
    project_session: Optional[models.ProjectSession] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> models.Trace:
    start_time = start_time or datetime.now(timezone.utc)
    end_time = end_time or (start_time + timedelta(seconds=10))
    trace = models.Trace(
        trace_id=token_hex(16),
        start_time=start_time,
        end_time=end_time,
        project_rowid=project.id,
        project_session_rowid=None if project_session is None else project_session.id,
    )
    session.add(trace)
    await session.flush()
    assert isinstance(await _get_record_by_id(session, models.Trace, trace.id), models.Trace)
    return trace


async def _add_span(
    session: AsyncSession,
    trace: Optional[models.Trace] = None,
    parent_span: Optional[models.Span] = None,
    attributes: Optional[Dict[str, Any]] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    span_kind: str = "LLM",
    cumulative_error_count: int = 0,
    cumulative_llm_token_count_prompt: int = 0,
    cumulative_llm_token_count_completion: int = 0,
) -> models.Span:
    start_time = start_time or datetime.now(timezone.utc)
    end_time = end_time or (start_time + timedelta(seconds=10))
    if trace is None and parent_span is None:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
    if parent_span is not None:
        trace_rowid = parent_span.trace_rowid
    elif trace is not None:
        trace_rowid = trace.id
    else:
        raise ValueError("Either `trace` or `parent_span` must be provided")
    span = models.Span(
        name=token_hex(4),
        span_id=token_hex(8),
        parent_id=None if parent_span is None else parent_span.span_id,
        span_kind=span_kind,
        start_time=start_time,
        end_time=end_time,
        status_code="OK",
        status_message="test_status_message",
        cumulative_error_count=cumulative_error_count,
        cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
        cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
        attributes=attributes or {},
        trace_rowid=trace_rowid,
    )
    session.add(span)
    await session.flush()
    assert isinstance(await _get_record_by_id(session, models.Span, span.id), models.Span)
    return span


async def _add_project_session(
    session: AsyncSession,
    project: models.Project,
    session_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
) -> models.ProjectSession:
    start_time = start_time or datetime.now(timezone.utc)
    project_session = models.ProjectSession(
        session_id=session_id or token_hex(4),
        project_id=project.id,
        start_time=start_time,
        end_time=start_time,
    )
    session.add(project_session)
    await session.flush()
    assert isinstance(
        await _get_record_by_id(session, models.ProjectSession, project_session.id),
        models.ProjectSession,
    )
    return project_session


_ExperimentGlobalId: TypeAlias = str
_DatasetExampleGlobalId: TypeAlias = str
_DatasetExampleRevisionGlobalId: TypeAlias = str

_ExperimentId: TypeAlias = int
_DatasetExampleId: TypeAlias = int
_DatasetExampleRevisionId: TypeAlias = int


async def verify_experiment_examples_junction_table(
    session: AsyncSession,
    experiment_id: Union[_ExperimentGlobalId, _ExperimentId],
    expected_examples: Optional[
        Union[
            Sequence[tuple[_DatasetExampleId, _DatasetExampleRevisionId]],
            Sequence[tuple[_DatasetExampleGlobalId, _DatasetExampleRevisionGlobalId]],
        ]
    ] = None,
) -> None:
    """
    Verify that the experiments_dataset_examples junction table contains the expected entries.

    This function uses **independent verification logic** that does NOT call the same
    implementation functions being tested. This ensures robust testing by avoiding the
    anti-pattern of testing implementation against itself.

    ## Verification Approach

    When expected_examples=None, this function:
    1. **Gets all revisions** up to and including the experiment's dataset version
    2. **Finds latest revision** for each example using simple Python logic
    3. **Filters out DELETE** revisions
    4. **Checks experiment splits** independently
    5. **Applies split filtering** if splits are assigned, otherwise includes all examples

    This independent approach catches bugs that would be missed if we used the same
    implementation code (like get_dataset_example_revisions) for both creating AND verifying.

    ## Split Behavior

    - **Experiment has assigned splits**: Only examples from those splits are expected
    - **Experiment has no splits**: ALL non-deleted examples from the dataset version are expected
    - **Empty subquery behavior**: Consistent with implementation - empty results = no filtering

    Args:
        session: Database session
        experiment_id: Experiment ID (can be global ID string or row ID integer)
        expected_examples: Optional sequence of tuples (dataset_example_id, dataset_example_revision_id).
            Tuples can contain either global ID strings or row ID integers.
            If None, derives expected examples from the experiment's dataset version,
            automatically filtering by assigned splits using independent logic.

    Raises:
        AssertionError: If the junction table doesn't match expectations
    """
    if isinstance(experiment_id, str):
        _, experiment_rowid = from_global_id(GlobalID.from_id(experiment_id))
    else:
        experiment_rowid = experiment_id

    if expected_examples is None:
        experiment = await session.get(models.Experiment, experiment_rowid)
        assert experiment is not None, f"Experiment with ID {experiment_rowid} not found"
        dataset_version_id = experiment.dataset_version_id

        # Independent verification logic
        # Step 1: Get ALL revisions up to and including this dataset version
        all_revisions = (
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(models.DatasetExampleRevision.dataset_version_id <= dataset_version_id)
                .order_by(
                    models.DatasetExampleRevision.dataset_example_id,
                    models.DatasetExampleRevision.created_at.desc(),
                    models.DatasetExampleRevision.id.desc(),
                )
            )
        ).all()

        # Step 2: Find the latest revision for each example (simple Python logic)
        latest_revisions_by_example = {}
        for revision in all_revisions:
            example_id = revision.dataset_example_id
            if example_id not in latest_revisions_by_example:
                # First revision we see for this example (latest due to ordering)
                latest_revisions_by_example[example_id] = revision

        # Step 3: Filter out DELETE revisions
        non_deleted_revisions = [
            revision
            for revision in latest_revisions_by_example.values()
            if revision.revision_kind != "DELETE"
        ]

        # Step 4: Check if experiment has assigned splits
        assigned_splits = (
            await session.scalars(
                select(models.ExperimentDatasetSplit.dataset_split_id).where(
                    models.ExperimentDatasetSplit.experiment_id == experiment_rowid
                )
            )
        ).all()

        # Step 5: Filter by splits if any are assigned
        if assigned_splits:
            # Get examples that belong to the assigned splits
            split_examples = (
                await session.scalars(
                    select(models.DatasetSplitDatasetExample.dataset_example_id).where(
                        models.DatasetSplitDatasetExample.dataset_split_id.in_(assigned_splits)
                    )
                )
            ).all()
            split_example_set = set(split_examples)

            # Only include revisions for examples in the assigned splits
            expected_revisions = [
                revision
                for revision in non_deleted_revisions
                if revision.dataset_example_id in split_example_set
            ]
        else:
            # No splits assigned = include all non-deleted examples
            expected_revisions = non_deleted_revisions

        expected_examples_set = {
            (revision.dataset_example_id, revision.id) for revision in expected_revisions
        }
    else:
        expected_examples_set = set()
        for ex_id, rev_id in expected_examples:
            if isinstance(ex_id, str):
                # Both are global IDs
                assert isinstance(rev_id, str), (
                    "If example_id is global ID, revision_id must be too"
                )
                _, example_rowid = from_global_id(GlobalID.from_id(ex_id))
                _, revision_rowid = from_global_id(GlobalID.from_id(rev_id))
                expected_examples_set.add((example_rowid, revision_rowid))
            else:
                # Both are row IDs
                assert isinstance(rev_id, int), "If example_id is row ID, revision_id must be too"
                expected_examples_set.add((ex_id, rev_id))

    expected_count = len(expected_examples_set)

    junction_records = (
        await session.scalars(
            select(models.ExperimentDatasetExample).where(
                models.ExperimentDatasetExample.experiment_id == experiment_rowid
            )
        )
    ).all()

    assert len(junction_records) == expected_count, (
        f"Expected {expected_count} junction table entries, got {len(junction_records)}"
    )

    actual_examples_set = {
        (record.dataset_example_id, record.dataset_example_revision_id)
        for record in junction_records
    }
    assert actual_examples_set == expected_examples_set, (
        f"Junction table entries {actual_examples_set} don't match expected {expected_examples_set}"
    )
