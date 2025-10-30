from collections.abc import AsyncIterable
from datetime import datetime
from typing import Optional, cast

import strawberry
from sqlalchemy import Text, and_, func, or_, select
from sqlalchemy.sql.functions import count
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.DatasetVersionSort import DatasetVersionSort
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetExperimentAnnotationSummary import (
    DatasetExperimentAnnotationSummary,
)
from phoenix.server.api.types.DatasetLabel import DatasetLabel
from phoenix.server.api.types.DatasetSplit import DatasetSplit
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir


@strawberry.type
class Dataset(Node):
    id: NodeID[int]
    db_record: strawberry.Private[Optional[models.Dataset]] = None

    def __post_init__(self) -> None:
        if self.db_record and self.id != self.db_record.id:
            raise ValueError("Dataset ID mismatch")

    @strawberry.field
    async def name(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            val = self.db_record.name
        else:
            val = await info.context.data_loaders.dataset_fields.load(
                (self.id, models.Dataset.name),
            )
        return val

    @strawberry.field
    async def description(
        self,
        info: Info[Context, None],
    ) -> Optional[str]:
        if self.db_record:
            val = self.db_record.description
        else:
            val = await info.context.data_loaders.dataset_fields.load(
                (self.id, models.Dataset.description),
            )
        return val

    @strawberry.field
    async def metadata(
        self,
        info: Info[Context, None],
    ) -> JSON:
        if self.db_record:
            val = self.db_record.metadata_
        else:
            val = await info.context.data_loaders.dataset_fields.load(
                (self.id, models.Dataset.metadata_),
            )
        return val

    @strawberry.field
    async def created_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.created_at
        else:
            val = await info.context.data_loaders.dataset_fields.load(
                (self.id, models.Dataset.created_at),
            )
        return val

    @strawberry.field
    async def updated_at(
        self,
        info: Info[Context, None],
    ) -> datetime:
        if self.db_record:
            val = self.db_record.updated_at
        else:
            val = await info.context.data_loaders.dataset_fields.load(
                (self.id, models.Dataset.updated_at),
            )
        return val

    @strawberry.field
    async def versions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        sort: Optional[DatasetVersionSort] = UNSET,
    ) -> Connection[DatasetVersion]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        async with info.context.db() as session:
            stmt = select(models.DatasetVersion).filter_by(dataset_id=self.id)
            if sort:
                # For now assume the the column names match 1:1 with the enum values
                sort_col = getattr(models.DatasetVersion, sort.col.value)
                if sort.dir is SortDir.desc:
                    stmt = stmt.order_by(sort_col.desc(), models.DatasetVersion.id.desc())
                else:
                    stmt = stmt.order_by(sort_col.asc(), models.DatasetVersion.id.asc())
            else:
                stmt = stmt.order_by(models.DatasetVersion.created_at.desc())
            versions = await session.scalars(stmt)
        data = [DatasetVersion(id=version.id, db_record=version) for version in versions]
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="Number of examples in a specific version if version is specified, or in the "
        "latest version if version is not specified."
    )  # type: ignore
    async def example_count(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
        split_ids: Optional[list[GlobalID]] = UNSET,
    ) -> int:
        dataset_id = self.id
        version_id = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id,
                expected_type_name=DatasetVersion.__name__,
            )
            if dataset_version_id
            else None
        )

        # Parse split IDs if provided
        split_rowids: Optional[list[int]] = None
        if split_ids:
            split_rowids = []
            for split_id in split_ids:
                try:
                    split_rowid = from_global_id_with_expected_type(
                        global_id=split_id, expected_type_name=models.DatasetSplit.__name__
                    )
                    split_rowids.append(split_rowid)
                except Exception:
                    raise BadRequest(f"Invalid split ID: {split_id}")

        revision_ids = (
            select(func.max(models.DatasetExampleRevision.id))
            .join(models.DatasetExample)
            .where(models.DatasetExample.dataset_id == dataset_id)
            .group_by(models.DatasetExampleRevision.dataset_example_id)
        )
        if version_id:
            version_id_subquery = (
                select(models.DatasetVersion.id)
                .where(models.DatasetVersion.dataset_id == dataset_id)
                .where(models.DatasetVersion.id == version_id)
                .scalar_subquery()
            )
            revision_ids = revision_ids.where(
                models.DatasetExampleRevision.dataset_version_id <= version_id_subquery
            )

        # Build the count query
        if split_rowids:
            # When filtering by splits, count distinct examples that belong to those splits
            stmt = (
                select(count(models.DatasetExample.id.distinct()))
                .join(
                    models.DatasetExampleRevision,
                    onclause=(
                        models.DatasetExample.id == models.DatasetExampleRevision.dataset_example_id
                    ),
                )
                .join(
                    models.DatasetSplitDatasetExample,
                    onclause=(
                        models.DatasetExample.id
                        == models.DatasetSplitDatasetExample.dataset_example_id
                    ),
                )
                .where(models.DatasetExampleRevision.id.in_(revision_ids))
                .where(models.DatasetExampleRevision.revision_kind != "DELETE")
                .where(models.DatasetSplitDatasetExample.dataset_split_id.in_(split_rowids))
            )
        else:
            stmt = (
                select(count(models.DatasetExampleRevision.id))
                .where(models.DatasetExampleRevision.id.in_(revision_ids))
                .where(models.DatasetExampleRevision.revision_kind != "DELETE")
            )

        async with info.context.db() as session:
            return (await session.scalar(stmt)) or 0

    @strawberry.field
    async def examples(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
        split_ids: Optional[list[GlobalID]] = UNSET,
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        filter: Optional[str] = UNSET,
    ) -> Connection[DatasetExample]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        dataset_id = self.id
        version_id = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if dataset_version_id
            else None
        )

        # Parse split IDs if provided
        split_rowids: Optional[list[int]] = None
        if split_ids:
            split_rowids = []
            for split_id in split_ids:
                try:
                    split_rowid = from_global_id_with_expected_type(
                        global_id=split_id, expected_type_name=models.DatasetSplit.__name__
                    )
                    split_rowids.append(split_rowid)
                except Exception:
                    raise BadRequest(f"Invalid split ID: {split_id}")

        revision_ids = (
            select(func.max(models.DatasetExampleRevision.id))
            .join(models.DatasetExample)
            .where(models.DatasetExample.dataset_id == dataset_id)
            .group_by(models.DatasetExampleRevision.dataset_example_id)
        )
        if version_id:
            version_id_subquery = (
                select(models.DatasetVersion.id)
                .where(models.DatasetVersion.dataset_id == dataset_id)
                .where(models.DatasetVersion.id == version_id)
                .scalar_subquery()
            )
            revision_ids = revision_ids.where(
                models.DatasetExampleRevision.dataset_version_id <= version_id_subquery
            )
        query = (
            select(models.DatasetExample)
            .join(
                models.DatasetExampleRevision,
                onclause=models.DatasetExample.id
                == models.DatasetExampleRevision.dataset_example_id,
            )
            .where(
                and_(
                    models.DatasetExampleRevision.id.in_(revision_ids),
                    models.DatasetExampleRevision.revision_kind != "DELETE",
                )
            )
            .order_by(models.DatasetExample.id.desc())
        )

        # Filter by split IDs if provided
        if split_rowids:
            query = (
                query.join(
                    models.DatasetSplitDatasetExample,
                    onclause=(
                        models.DatasetExample.id
                        == models.DatasetSplitDatasetExample.dataset_example_id
                    ),
                )
                .where(models.DatasetSplitDatasetExample.dataset_split_id.in_(split_rowids))
                .distinct()
            )
        # Apply filter if provided - search through JSON fields (input, output, metadata)
        if filter is not UNSET and filter:
            # Create a filter that searches for the filter string in JSON fields
            # Using PostgreSQL's JSON operators for case-insensitive text search
            filter_condition = or_(
                func.cast(models.DatasetExampleRevision.input, Text).ilike(f"%{filter}%"),
                func.cast(models.DatasetExampleRevision.output, Text).ilike(f"%{filter}%"),
                func.cast(models.DatasetExampleRevision.metadata_, Text).ilike(f"%{filter}%"),
            )
            query = query.where(filter_condition)

        async with info.context.db() as session:
            dataset_examples = [
                DatasetExample(
                    id=example.id,
                    db_record=example,
                    version_id=version_id,
                )
                async for example in await session.stream_scalars(query)
            ]
        return connection_from_list(data=dataset_examples, args=args)

    @strawberry.field
    async def splits(self, info: Info[Context, None]) -> list[DatasetSplit]:
        return [
            DatasetSplit(id=split.id, db_record=split)
            for split in await info.context.data_loaders.dataset_dataset_splits.load(self.id)
        ]

    @strawberry.field(
        description="Number of experiments for a specific version if version is specified, "
        "or for all versions if version is not specified."
    )  # type: ignore
    async def experiment_count(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
    ) -> int:
        stmt = select(count(models.Experiment.id)).where(models.Experiment.dataset_id == self.id)
        version_id = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id,
                expected_type_name=DatasetVersion.__name__,
            )
            if dataset_version_id
            else None
        )
        if version_id is not None:
            stmt = stmt.where(models.Experiment.dataset_version_id == version_id)
        async with info.context.db() as session:
            return (await session.scalar(stmt)) or 0

    @strawberry.field
    async def experiments(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
        filter_condition: Optional[str] = UNSET,
        filter_ids: Optional[
            list[GlobalID]
        ] = UNSET,  # this is a stopgap until a query DSL is implemented
    ) -> Connection[Experiment]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        dataset_id = self.id
        row_number = func.row_number().over(order_by=models.Experiment.id).label("row_number")
        query = (
            select(models.Experiment, row_number)
            .where(models.Experiment.dataset_id == dataset_id)
            .order_by(models.Experiment.id.desc())
        )
        if filter_condition is not UNSET and filter_condition:
            # Search both name and description columns with case-insensitive partial matching
            search_filter = or_(
                models.Experiment.name.ilike(f"%{filter_condition}%"),
                models.Experiment.description.ilike(f"%{filter_condition}%"),
            )
            query = query.where(search_filter)

        if filter_ids:
            filter_rowids = []
            for filter_id in filter_ids:
                try:
                    filter_rowids.append(
                        from_global_id_with_expected_type(
                            global_id=filter_id,
                            expected_type_name=Experiment.__name__,
                        )
                    )
                except ValueError:
                    raise BadRequest(f"Invalid filter ID: {filter_id}")
            query = query.where(models.Experiment.id.in_(filter_rowids))

        async with info.context.db() as session:
            experiments = [
                to_gql_experiment(experiment, sequence_number)
                async for experiment, sequence_number in cast(
                    AsyncIterable[tuple[models.Experiment, int]],
                    await session.stream(query),
                )
            ]
        return connection_from_list(data=experiments, args=args)

    @strawberry.field
    async def experiment_annotation_summaries(
        self, info: Info[Context, None]
    ) -> list[DatasetExperimentAnnotationSummary]:
        dataset_id = self.id
        query = (
            select(
                models.ExperimentRunAnnotation.name.label("annotation_name"),
                func.min(models.ExperimentRunAnnotation.score).label("min_score"),
                func.max(models.ExperimentRunAnnotation.score).label("max_score"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .join(
                models.Experiment,
                models.ExperimentRun.experiment_id == models.Experiment.id,
            )
            .where(models.Experiment.dataset_id == dataset_id)
            .group_by(models.ExperimentRunAnnotation.name)
            .order_by(models.ExperimentRunAnnotation.name)
        )
        async with info.context.db() as session:
            return [
                DatasetExperimentAnnotationSummary(
                    annotation_name=scores_tuple.annotation_name,
                    min_score=scores_tuple.min_score,
                    max_score=scores_tuple.max_score,
                )
                async for scores_tuple in await session.stream(query)
            ]

    @strawberry.field
    async def labels(self, info: Info[Context, None]) -> list[DatasetLabel]:
        return [
            DatasetLabel(id=label.id, db_record=label)
            for label in await info.context.data_loaders.dataset_labels.load(self.id)
        ]

    @strawberry.field
    def last_updated_at(self, info: Info[Context, None]) -> Optional[datetime]:
        return info.context.last_updated_at.get(models.Dataset, self.id)
