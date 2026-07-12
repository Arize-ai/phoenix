import asyncio
from collections.abc import Sequence
from datetime import datetime
from typing import Any, Optional, cast

import strawberry
from openinference.semconv.trace import (
    MessageAttributes,
    MessageContentAttributes,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay.types import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.helpers import get_eval_trace_ids_for_datasets, get_project_names_for_datasets
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.dataset_helpers import (
    get_dataset_example_input,
    get_dataset_example_output,
)
from phoenix.server.api.input_types.AddExamplesToDatasetInput import AddExamplesToDatasetInput
from phoenix.server.api.input_types.AddSpansToDatasetInput import AddSpansToDatasetInput
from phoenix.server.api.input_types.CreateDatasetInput import CreateDatasetInput
from phoenix.server.api.input_types.DeleteDatasetExamplesInput import DeleteDatasetExamplesInput
from phoenix.server.api.input_types.DeleteDatasetInput import DeleteDatasetInput
from phoenix.server.api.input_types.PatchDatasetExamplesInput import (
    DatasetExamplePatch,
    PatchDatasetExamplesInput,
)
from phoenix.server.api.input_types.PatchDatasetInput import PatchDatasetInput
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.api.utils import delete_projects, delete_traces
from phoenix.server.dml_event import DatasetDeleteEvent, DatasetInsertEvent

_MAX_REPORTED_EXTERNAL_ID_CONFLICTS = 10
_MAX_REPORTED_EXAMPLE_IDS = 10


async def _find_conflicting_external_ids(
    session: AsyncSession,
    *,
    dataset_id: int,
    external_ids: Sequence[str],
) -> list[str]:
    """
    The custom IDs that already belong to an example in this dataset, capped so a
    bad bulk write reports a readable sample rather than thousands of IDs.

    Deleting an example only writes a DELETE revision — the example row, and with
    it the custom ID, survives. So an ID belonging to a deleted example still
    counts as taken, which the conflict message spells out.
    """
    return [
        external_id
        for external_id in (
            await session.scalars(
                select(models.DatasetExample.external_id)
                .where(models.DatasetExample.dataset_id == dataset_id)
                .where(models.DatasetExample.external_id.in_(external_ids))
                .limit(_MAX_REPORTED_EXTERNAL_ID_CONFLICTS)
            )
        ).all()
        if external_id is not None
    ]


def _external_id_conflict_message(conflicting_external_ids: Sequence[str]) -> str:
    return (
        f"Custom IDs {list(conflicting_external_ids)!r} are already taken in this dataset. "
        "A custom ID stays taken even after its example is deleted."
    )


def _to_global_ids(type_name: str, rowids: Sequence[int]) -> str:
    """
    Renders row IDs as the global IDs the caller sent us, capped so that a bad
    bulk write reports a readable sample rather than thousands of IDs.
    """
    reported = [
        str(GlobalID(type_name, str(rowid))) for rowid in rowids[:_MAX_REPORTED_EXAMPLE_IDS]
    ]
    remaining = len(rowids) - len(reported)
    listed = ", ".join(reported)
    return f"{listed} (and {remaining} more)" if remaining > 0 else listed


@strawberry.type
class DatasetMutationPayload:
    dataset: Dataset


@strawberry.type
class DatasetMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset(
        self,
        info: Info[Context, None],
        input: CreateDatasetInput,
    ) -> DatasetMutationPayload:
        name = input.name
        description = input.description if input.description is not UNSET else None
        metadata = input.metadata
        async with info.context.db() as session:
            try:
                dataset = await session.scalar(
                    insert(models.Dataset)
                    .values(
                        name=name,
                        description=description,
                        metadata_=metadata,
                        user_id=info.context.user_id,
                    )
                    .returning(models.Dataset)
                )
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                # ``name`` is the only unique constraint on ``datasets``, so an
                # integrity error here means that name is already taken.
                raise Conflict(f"A dataset named {name!r} already exists.")
            assert dataset is not None
        info.context.event_queue.put(DatasetInsertEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_dataset(
        self,
        info: Info[Context, None],
        input: PatchDatasetInput,
    ) -> DatasetMutationPayload:
        dataset_id = from_global_id_with_expected_type(
            global_id=input.dataset_id, expected_type_name=Dataset.__name__
        )
        patch = {
            column.key: patch_value
            for column, patch_value, column_is_nullable in (
                (models.Dataset.name, input.name, False),
                (models.Dataset.description, input.description, True),
                (models.Dataset.metadata_, input.metadata, False),
            )
            if patch_value is not UNSET and (patch_value is not None or column_is_nullable)
        }
        async with info.context.db() as session:
            dataset = await session.scalar(
                update(models.Dataset)
                .where(models.Dataset.id == dataset_id)
                .returning(models.Dataset)
                .values(**patch)
            )
            assert dataset is not None
        info.context.event_queue.put(DatasetInsertEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def add_spans_to_dataset(
        self,
        info: Info[Context, None],
        input: AddSpansToDatasetInput,
    ) -> DatasetMutationPayload:
        dataset_id = input.dataset_id
        span_ids = input.span_ids
        dataset_version_description = (
            input.dataset_version_description
            if isinstance(input.dataset_version_description, str)
            else None
        )
        dataset_version_metadata = input.dataset_version_metadata
        dataset_rowid = from_global_id_with_expected_type(
            global_id=dataset_id, expected_type_name=Dataset.__name__
        )
        span_rowids = {
            from_global_id_with_expected_type(global_id=span_id, expected_type_name=Span.__name__)
            for span_id in set(span_ids)
        }
        async with info.context.db() as session:
            if (
                dataset := await session.scalar(
                    select(models.Dataset).where(models.Dataset.id == dataset_rowid)
                )
            ) is None:
                raise ValueError(
                    f"Unknown dataset: {dataset_id}"
                )  # todo: implement error types https://github.com/Arize-ai/phoenix/issues/3221
            dataset_version = models.DatasetVersion(
                dataset_id=dataset_rowid,
                description=dataset_version_description,
                metadata_=dataset_version_metadata or {},
                user_id=info.context.user_id,
            )
            session.add(dataset_version)
            await session.flush()
            spans = (
                (
                    await session.scalars(
                        select(models.Span)
                        .outerjoin(
                            models.SpanAnnotation,
                            models.Span.id == models.SpanAnnotation.span_rowid,
                        )
                        .outerjoin(models.User, models.SpanAnnotation.user_id == models.User.id)
                        .order_by(
                            models.Span.id,
                            models.SpanAnnotation.name,
                            models.User.username,
                        )
                        .where(models.Span.id.in_(span_rowids))
                        .options(
                            contains_eager(models.Span.span_annotations).contains_eager(
                                models.SpanAnnotation.user
                            )
                        )
                    )
                )
                .unique()
                .all()
            )
            if span_rowids - {span.id for span in spans}:
                raise NotFound("Some spans could not be found")

            DatasetExample = models.DatasetExample
            dataset_example_rowids = (
                await session.scalars(
                    insert(DatasetExample).returning(DatasetExample.id),
                    [
                        {
                            DatasetExample.dataset_id.key: dataset_rowid,
                            DatasetExample.span_rowid.key: span.id,
                        }
                        for span in spans
                    ],
                )
            ).all()
            assert len(dataset_example_rowids) == len(spans)
            assert all(map(lambda id: isinstance(id, int), dataset_example_rowids))
            DatasetExampleRevision = models.DatasetExampleRevision

            all_span_attributes = {
                **SpanAttributes.__dict__,
                **MessageAttributes.__dict__,
                **MessageContentAttributes.__dict__,
                **ToolCallAttributes.__dict__,
                **ToolAttributes.__dict__,
            }
            nonprivate_span_attributes = {
                k: v for k, v in all_span_attributes.items() if not k.startswith("_")
            }

            await session.execute(
                insert(DatasetExampleRevision),
                [
                    {
                        DatasetExampleRevision.dataset_example_id.key: dataset_example_rowid,
                        DatasetExampleRevision.dataset_version_id.key: dataset_version.id,
                        DatasetExampleRevision.input.key: get_dataset_example_input(span),
                        DatasetExampleRevision.output.key: get_dataset_example_output(span),
                        DatasetExampleRevision.metadata_.key: {
                            **(span.attributes.get(SpanAttributes.METADATA) or dict()),
                            **{
                                k: v
                                for k, v in span.attributes.items()
                                if k in nonprivate_span_attributes
                            },
                            "span_kind": span.span_kind,
                            "annotations": _gather_span_annotations_by_name(span.span_annotations),
                        },
                        DatasetExampleRevision.revision_kind.key: "CREATE",
                    }
                    for dataset_example_rowid, span in zip(dataset_example_rowids, spans)
                ],
            )
        info.context.event_queue.put(DatasetInsertEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def add_examples_to_dataset(
        self, info: Info[Context, None], input: AddExamplesToDatasetInput
    ) -> DatasetMutationPayload:
        dataset_id = input.dataset_id
        # Extract the span rowids from the input examples if they exist
        span_ids = [example.span_id for example in input.examples if example.span_id]
        span_rowids = {
            from_global_id_with_expected_type(global_id=span_id, expected_type_name=Span.__name__)
            for span_id in set(span_ids)
        }
        dataset_version_description = (
            input.dataset_version_description if input.dataset_version_description else None
        )
        dataset_version_metadata = input.dataset_version_metadata
        dataset_rowid = from_global_id_with_expected_type(
            global_id=dataset_id, expected_type_name=Dataset.__name__
        )
        async with info.context.db() as session:
            if (
                dataset := await session.scalar(
                    select(models.Dataset).where(models.Dataset.id == dataset_rowid)
                )
            ) is None:
                raise ValueError(
                    f"Unknown dataset: {dataset_id}"
                )  # todo: implement error types https://github.com/Arize-ai/phoenix/issues/3221
            dataset_version_rowid = await session.scalar(
                insert(models.DatasetVersion)
                .values(
                    dataset_id=dataset_rowid,
                    description=dataset_version_description,
                    metadata_=dataset_version_metadata,
                    user_id=info.context.user_id,
                )
                .returning(models.DatasetVersion.id)
            )

            # Fetch spans and span annotations
            spans = (
                await session.execute(
                    select(models.Span.id)
                    .select_from(models.Span)
                    .where(models.Span.id.in_(span_rowids))
                )
            ).all()

            span_annotations = (
                await session.execute(
                    select(
                        models.SpanAnnotation.span_rowid,
                        models.SpanAnnotation.name,
                        models.SpanAnnotation.label,
                        models.SpanAnnotation.score,
                        models.SpanAnnotation.explanation,
                        models.SpanAnnotation.metadata_,
                        models.SpanAnnotation.annotator_kind,
                    )
                    .select_from(models.SpanAnnotation)
                    .where(models.SpanAnnotation.span_rowid.in_(span_rowids))
                )
            ).all()

            span_annotations_by_span: dict[int, dict[Any, Any]] = {span.id: {} for span in spans}
            for annotation in span_annotations:
                span_id = annotation.span_rowid
                if span_id not in span_annotations_by_span:
                    span_annotations_by_span[span_id] = dict()
                span_annotations_by_span[span_id][annotation.name] = {
                    "label": annotation.label,
                    "score": annotation.score,
                    "explanation": annotation.explanation,
                    "metadata": annotation.metadata_,
                    "annotator_kind": annotation.annotator_kind,
                }

            DatasetExample = models.DatasetExample

            input_external_ids = [
                example.external_id for example in input.examples if example.external_id
            ]
            seen_external_ids: set[str] = set()
            for external_id in input_external_ids:
                if external_id in seen_external_ids:
                    # A duplicate within one request is a malformed request, not a
                    # collision with what is already stored — same as in
                    # patchDatasetExamples.
                    raise BadRequest(
                        f"Custom ID {external_id!r} appears more than once in the input."
                    )
                seen_external_ids.add(external_id)

            dataset_examples = [
                DatasetExample(
                    dataset_id=dataset_rowid,
                    span_rowid=from_global_id_with_expected_type(
                        global_id=example.span_id,
                        expected_type_name=Span.__name__,
                    )
                    if example.span_id
                    else None,
                    external_id=example.external_id if example.external_id else None,
                )
                for example in input.examples
            ]
            try:
                async with session.begin_nested():
                    session.add_all(dataset_examples)
                    await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
                error_message = str(error)
                has_external_id_conflict = (
                    "dataset_id" in error_message and "external_id" in error_message
                )
                if has_external_id_conflict and input_external_ids:
                    existing_external_ids = await _find_conflicting_external_ids(
                        session,
                        dataset_id=dataset_rowid,
                        external_ids=input_external_ids,
                    )
                    if existing_external_ids:
                        raise Conflict(_external_id_conflict_message(existing_external_ids))
                raise
            dataset_example_rowids = [example.id for example in dataset_examples]
            assert len(dataset_example_rowids) == len(input.examples)
            assert all(map(lambda id: isinstance(id, int), dataset_example_rowids))
            DatasetExampleRevision = models.DatasetExampleRevision

            dataset_example_revisions = []
            for dataset_example_rowid, example in zip(dataset_example_rowids, input.examples):
                span_annotation = {}
                if example.span_id:
                    span_id = from_global_id_with_expected_type(
                        global_id=example.span_id,
                        expected_type_name=Span.__name__,
                    )
                    span_annotation = span_annotations_by_span.get(span_id, {})
                dataset_example_revisions.append(
                    {
                        DatasetExampleRevision.dataset_example_id.key: dataset_example_rowid,
                        DatasetExampleRevision.dataset_version_id.key: dataset_version_rowid,
                        DatasetExampleRevision.input.key: example.input,
                        DatasetExampleRevision.output.key: example.output,
                        DatasetExampleRevision.metadata_.key: {
                            **cast(dict[str, Any], example.metadata or {}),
                            "annotations": span_annotation,
                        },
                        DatasetExampleRevision.revision_kind.key: "CREATE",
                    }
                )
            await session.execute(
                insert(DatasetExampleRevision),
                dataset_example_revisions,
            )
        info.context.event_queue.put(DatasetInsertEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_dataset(
        self,
        info: Info[Context, None],
        input: DeleteDatasetInput,
    ) -> DatasetMutationPayload:
        try:
            dataset_id = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise NotFound(f"Unknown dataset: {input.dataset_id}")
        project_names_stmt = get_project_names_for_datasets(dataset_id)
        eval_trace_ids_stmt = get_eval_trace_ids_for_datasets(dataset_id)
        stmt = (
            delete(models.Dataset).where(models.Dataset.id == dataset_id).returning(models.Dataset)
        )
        async with info.context.db() as session:
            project_names = await session.scalars(project_names_stmt)
            eval_trace_ids = await session.scalars(eval_trace_ids_stmt)
            if not (dataset := await session.scalar(stmt)):
                raise NotFound(f"Unknown dataset: {input.dataset_id}")
        await asyncio.gather(
            delete_projects(info.context.db, *project_names),
            delete_traces(info.context.db, *eval_trace_ids),
            return_exceptions=True,
        )
        info.context.event_queue.put(DatasetDeleteEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_dataset_examples(
        self,
        info: Info[Context, None],
        input: PatchDatasetExamplesInput,
    ) -> DatasetMutationPayload:
        """Commit additions, patches, and deletions as one dataset version."""
        additions = input.additions
        patches = input.patches
        example_ids_to_delete = input.example_ids_to_delete
        if not (additions or patches or example_ids_to_delete):
            raise BadRequest("Must provide at least one dataset example change.")

        try:
            dataset_id = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset ID: {input.dataset_id}")
        try:
            patch_ids = [
                from_global_id_with_expected_type(
                    global_id=patch.example_id,
                    expected_type_name=DatasetExample.__name__,
                )
                for patch in patches
            ]
            delete_ids = [
                from_global_id_with_expected_type(
                    global_id=example_id,
                    expected_type_name=DatasetExample.__name__,
                )
                for example_id in example_ids_to_delete
            ]
        except ValueError:
            raise BadRequest("Received one or more invalid dataset example IDs.")
        if len(set(patch_ids)) != len(patch_ids):
            raise BadRequest("Cannot patch the same example more than once per mutation.")
        if len(set(delete_ids)) != len(delete_ids):
            raise BadRequest("Cannot delete the same example more than once per mutation.")
        if set(patch_ids) & set(delete_ids):
            raise BadRequest("Cannot patch and delete the same example in one mutation.")
        if any(patch.is_empty() for patch in patches):
            raise BadRequest("Received one or more empty patches that contain no fields to update.")
        if any(
            not isinstance(value, dict)
            for patch in patches
            for value in (patch.input, patch.output, patch.metadata)
            if value is not UNSET
        ):
            raise BadRequest("Patched example input, output, and metadata must be JSON objects.")
        if any(
            not all(
                isinstance(value, dict)
                for value in (addition.input, addition.output, addition.metadata)
            )
            for addition in additions
        ):
            raise BadRequest("Added example input, output, and metadata must be JSON objects.")

        # A blank custom ID means "no custom ID" — normalize once so the conflict
        # check and the insert below cannot drift apart.
        external_id_by_addition = [
            addition.external_id
            if isinstance(addition.external_id, str) and addition.external_id
            else None
            for addition in additions
        ]
        external_ids = [
            external_id for external_id in external_id_by_addition if external_id is not None
        ]
        if len(set(external_ids)) != len(external_ids):
            raise BadRequest("Custom IDs for added examples must be unique within the change set.")

        # A blank description is no description — store NULL rather than "".
        version_description = (
            input.version_description
            if isinstance(input.version_description, str) and input.version_description
            else None
        )
        # `versionMetadata` is a JSON scalar, so anything type-checks at the GraphQL
        # layer. Reject a non-object rather than quietly storing {} in its place.
        if (
            input.version_metadata is not UNSET
            and input.version_metadata is not None
            and not isinstance(input.version_metadata, dict)
        ):
            raise BadRequest("Version metadata must be a JSON object.")
        version_metadata: dict[str, Any] = (
            input.version_metadata if isinstance(input.version_metadata, dict) else {}
        )
        existing_example_ids = patch_ids + delete_ids

        async with info.context.db() as session:
            dataset = await session.scalar(
                select(models.Dataset).where(models.Dataset.id == dataset_id)
            )
            if dataset is None:
                raise NotFound(f"Unknown dataset: {input.dataset_id}")

            latest_revisions_by_example_id: dict[int, models.DatasetExampleRevision] = {}
            if existing_example_ids:
                dataset_examples = (
                    await session.scalars(
                        select(models.DatasetExample).where(
                            models.DatasetExample.id.in_(existing_example_ids)
                        )
                    )
                ).all()
                examples_by_id = {example.id: example for example in dataset_examples}
                # An example in another dataset is not addressable by a caller who
                # scoped the write to this one, so it reads as missing rather than
                # as a malformed request.
                unreachable_example_ids = [
                    example_id
                    for example_id in existing_example_ids
                    if (example := examples_by_id.get(example_id)) is None
                    or example.dataset_id != dataset_id
                ]
                if unreachable_example_ids:
                    raise NotFound(
                        "Examples "
                        f"{_to_global_ids(DatasetExample.__name__, unreachable_example_ids)} "
                        "could not be found in this dataset."
                    )

                latest_revision_ids = (
                    select(func.max(models.DatasetExampleRevision.id))
                    .where(
                        models.DatasetExampleRevision.dataset_example_id.in_(existing_example_ids)
                    )
                    .group_by(models.DatasetExampleRevision.dataset_example_id)
                    .scalar_subquery()
                )
                latest_revisions = (
                    await session.scalars(
                        select(models.DatasetExampleRevision).where(
                            models.DatasetExampleRevision.id.in_(latest_revision_ids)
                        )
                    )
                ).all()
                latest_revisions_by_example_id = {
                    revision.dataset_example_id: revision for revision in latest_revisions
                }
                if unrevised_example_ids := [
                    example_id
                    for example_id in existing_example_ids
                    if example_id not in latest_revisions_by_example_id
                ]:
                    raise NotFound(
                        "Examples "
                        f"{_to_global_ids(DatasetExample.__name__, unrevised_example_ids)} "
                        "have no revision."
                    )
                if deleted_example_ids := [
                    example_id
                    for example_id in existing_example_ids
                    if latest_revisions_by_example_id[example_id].revision_kind == "DELETE"
                ]:
                    raise Conflict(
                        "Examples "
                        f"{_to_global_ids(DatasetExample.__name__, deleted_example_ids)} "
                        "have already been deleted."
                    )

            if external_ids:
                conflicting_external_ids = await _find_conflicting_external_ids(
                    session, dataset_id=dataset_id, external_ids=external_ids
                )
                if conflicting_external_ids:
                    raise Conflict(_external_id_conflict_message(conflicting_external_ids))

            version_id = await session.scalar(
                insert(models.DatasetVersion)
                .values(
                    dataset_id=dataset_id,
                    description=version_description,
                    metadata_=version_metadata,
                    user_id=info.context.user_id,
                )
                .returning(models.DatasetVersion.id)
            )
            assert version_id is not None

            if additions:
                added_examples = [
                    models.DatasetExample(dataset_id=dataset_id, external_id=external_id)
                    for external_id in external_id_by_addition
                ]
                try:
                    # The conflict check above is check-then-insert, so a concurrent
                    # add can still trip the (dataset_id, external_id) unique
                    # constraint. Report it as a conflict rather than a server error.
                    async with session.begin_nested():
                        session.add_all(added_examples)
                        await session.flush()
                except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
                    error_message = str(error)
                    has_external_id_conflict = (
                        "dataset_id" in error_message and "external_id" in error_message
                    )
                    if has_external_id_conflict and external_ids:
                        # The savepoint rolled the insert back, so ask which custom
                        # IDs actually collided rather than blaming every ID sent.
                        conflicting_external_ids = await _find_conflicting_external_ids(
                            session, dataset_id=dataset_id, external_ids=external_ids
                        )
                        if conflicting_external_ids:
                            raise Conflict(_external_id_conflict_message(conflicting_external_ids))
                    raise
                await session.execute(
                    insert(models.DatasetExampleRevision),
                    [
                        {
                            models.DatasetExampleRevision.dataset_example_id.key: added_example.id,
                            models.DatasetExampleRevision.dataset_version_id.key: version_id,
                            models.DatasetExampleRevision.input.key: addition.input,
                            models.DatasetExampleRevision.output.key: addition.output,
                            models.DatasetExampleRevision.metadata_.key: addition.metadata,
                            models.DatasetExampleRevision.revision_kind.key: "CREATE",
                        }
                        for added_example, addition in zip(added_examples, additions)
                    ],
                )

            if patches:
                await session.execute(
                    insert(models.DatasetExampleRevision),
                    [
                        _to_orm_revision(
                            existing_revision=latest_revisions_by_example_id[example_id],
                            patch=patch,
                            example_id=example_id,
                            version_id=version_id,
                        )
                        for example_id, patch in zip(patch_ids, patches)
                    ],
                )

            if delete_ids:
                await session.execute(
                    insert(models.DatasetExampleRevision),
                    [
                        {
                            models.DatasetExampleRevision.dataset_example_id.key: example_id,
                            models.DatasetExampleRevision.dataset_version_id.key: version_id,
                            models.DatasetExampleRevision.input.key: {},
                            models.DatasetExampleRevision.output.key: {},
                            models.DatasetExampleRevision.metadata_.key: {},
                            models.DatasetExampleRevision.revision_kind.key: "DELETE",
                        }
                        for example_id in delete_ids
                    ],
                )

        info.context.event_queue.put(DatasetInsertEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_dataset_examples(
        self, info: Info[Context, None], input: DeleteDatasetExamplesInput
    ) -> DatasetMutationPayload:
        timestamp = datetime.now()
        example_db_ids = [
            from_global_id_with_expected_type(global_id, models.DatasetExample.__name__)
            for global_id in input.example_ids
        ]
        # Guard against empty input
        if not example_db_ids:
            raise ValueError("Must provide examples to delete")
        dataset_version_description = (
            input.dataset_version_description
            if isinstance(input.dataset_version_description, str)
            else None
        )
        dataset_version_metadata = input.dataset_version_metadata
        async with info.context.db() as session:
            # Check if the examples are from a single dataset
            datasets = (
                await session.scalars(
                    select(models.Dataset)
                    .join(
                        models.DatasetExample, models.Dataset.id == models.DatasetExample.dataset_id
                    )
                    .where(models.DatasetExample.id.in_(example_db_ids))
                    .distinct()
                    .limit(2)  # limit to 2 to check if there are more than 1 dataset
                )
            ).all()
            if len(datasets) > 1:
                raise ValueError("Examples must be from the same dataset")
            elif not datasets:
                raise ValueError("Examples not found")

            dataset = datasets[0]
            _check_dataset_scope(dataset, input.dataset_id)

            dataset_version_rowid = await session.scalar(
                insert(models.DatasetVersion)
                .values(
                    dataset_id=dataset.id,
                    description=dataset_version_description,
                    metadata_=dataset_version_metadata,
                    user_id=info.context.user_id,
                    created_at=timestamp,
                )
                .returning(models.DatasetVersion.id)
            )

            # If the examples already have a delete revision, skip the deletion
            existing_delete_revisions = (
                await session.scalars(
                    select(models.DatasetExampleRevision).where(
                        models.DatasetExampleRevision.dataset_example_id.in_(example_db_ids),
                        models.DatasetExampleRevision.revision_kind == "DELETE",
                    )
                )
            ).all()

            if existing_delete_revisions:
                raise ValueError(
                    "Provided examples contain already deleted examples. Delete aborted."
                )

            DatasetExampleRevision = models.DatasetExampleRevision
            await session.execute(
                insert(DatasetExampleRevision),
                [
                    {
                        DatasetExampleRevision.dataset_example_id.key: dataset_example_rowid,
                        DatasetExampleRevision.dataset_version_id.key: dataset_version_rowid,
                        DatasetExampleRevision.input.key: {},
                        DatasetExampleRevision.output.key: {},
                        DatasetExampleRevision.metadata_.key: {},
                        DatasetExampleRevision.revision_kind.key: "DELETE",
                        DatasetExampleRevision.created_at.key: timestamp,
                    }
                    for dataset_example_rowid in example_db_ids
                ],
            )
        info.context.event_queue.put(DatasetInsertEvent((dataset.id,)))
        return DatasetMutationPayload(dataset=Dataset(id=dataset.id, db_record=dataset))


def _check_dataset_scope(dataset: models.Dataset, dataset_gid: Optional[GlobalID]) -> None:
    """When the caller scoped the write to a dataset, reject the mutation if
    the examples' owning dataset is a different one — guards against stale or
    mistyped example ids silently editing another dataset."""
    if not dataset_gid:
        return
    try:
        expected_dataset_id = from_global_id_with_expected_type(
            global_id=dataset_gid, expected_type_name=Dataset.__name__
        )
    except ValueError:
        raise BadRequest(f"Invalid dataset ID: {dataset_gid}")
    if dataset.id != expected_dataset_id:
        raise BadRequest(
            f"The examples belong to dataset '{dataset.name}', not the specified dataset."
        )


def _span_attribute(semconv: str) -> Any:
    """
    Extracts an attribute from the ORM span attributes column and labels the
    result.

    E.g., "input.value" -> Span.attributes["input"]["value"].label("input_value")
    """
    attribute_value: Any = models.Span.attributes
    for key in semconv.split("."):
        attribute_value = attribute_value[key]
    return attribute_value.label(semconv.replace(".", "_"))


def _to_orm_revision(
    *,
    existing_revision: models.DatasetExampleRevision,
    patch: DatasetExamplePatch,
    example_id: int,
    version_id: int,
) -> dict[str, Any]:
    """
    Creates a new revision from an existing revision and a patch. The output is a
    dictionary suitable for insertion into the database using the sqlalchemy
    bulk insertion API.
    """

    db_rev = models.DatasetExampleRevision
    # A field the caller left out falls back to the existing revision. Values that
    # were sent are validated up front, so anything present here is a JSON object.
    input = existing_revision.input if patch.input is UNSET else patch.input
    output = existing_revision.output if patch.output is UNSET else patch.output
    metadata = existing_revision.metadata_ if patch.metadata is UNSET else patch.metadata
    return {
        str(db_column.key): patch_value
        for db_column, patch_value in (
            (db_rev.dataset_example_id, example_id),
            (db_rev.dataset_version_id, version_id),
            (db_rev.input, input),
            (db_rev.output, output),
            (db_rev.metadata_, metadata),
            (db_rev.revision_kind, "PATCH"),
        )
    }


def _gather_span_annotations_by_name(
    span_annotations: list[models.SpanAnnotation],
) -> dict[str, list[dict[str, Any]]]:
    span_annotations_by_name: dict[str, list[dict[str, Any]]] = {}
    for span_annotation in span_annotations:
        if span_annotation.name not in span_annotations_by_name:
            span_annotations_by_name[span_annotation.name] = []
        span_annotations_by_name[span_annotation.name].append(
            _to_span_annotation_dict(span_annotation)
        )
    return span_annotations_by_name


def _to_span_annotation_dict(span_annotation: models.SpanAnnotation) -> dict[str, Any]:
    return {
        "label": span_annotation.label,
        "score": span_annotation.score,
        "explanation": span_annotation.explanation,
        "metadata": span_annotation.metadata_,
        "annotator_kind": span_annotation.annotator_kind,
        "user_id": str(GlobalID(models.User.__name__, str(user_id)))
        if (user_id := span_annotation.user_id) is not None
        else None,
        "username": user.username if (user := span_annotation.user) is not None else None,
        "email": user.email if user is not None else None,
    }


INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
LLM_PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS
