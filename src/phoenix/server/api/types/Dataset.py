from datetime import datetime
from typing import AsyncIterable, List, Optional, Tuple, cast

import strawberry
from sqlalchemy import and_, func, select
from sqlalchemy.sql.functions import count
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DatasetVersionSort import DatasetVersionSort
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.ExperimentAnnotationSummary import ExperimentAnnotationSummary
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir


@strawberry.type
class Dataset(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    metadata: JSON
    created_at: datetime
    updated_at: datetime

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
            stmt = select(models.DatasetVersion).filter_by(dataset_id=self.id_attr)
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
        data = [
            DatasetVersion(
                id_attr=version.id,
                description=version.description,
                metadata=version.metadata_,
                created_at=version.created_at,
            )
            for version in versions
        ]
        return connection_from_list(data=data, args=args)

    @strawberry.field(
        description="Number of examples in a specific version if version is specified, or in the "
        "latest version if version is not specified."
    )  # type: ignore
    async def example_count(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
    ) -> int:
        dataset_id = self.id_attr
        version_id = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id,
                expected_type_name=DatasetVersion.__name__,
            )
            if dataset_version_id
            else None
        )
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
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[DatasetExample]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        dataset_id = self.id_attr
        version_id = (
            from_global_id_with_expected_type(
                global_id=dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if dataset_version_id
            else None
        )
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
            .order_by(models.DatasetExampleRevision.dataset_example_id.desc())
        )
        async with info.context.db() as session:
            dataset_examples = [
                DatasetExample(
                    id_attr=example.id,
                    version_id=version_id,
                    created_at=example.created_at,
                )
                async for example in await session.stream_scalars(query)
            ]
        return connection_from_list(data=dataset_examples, args=args)

    @strawberry.field(
        description="Number of experiments for a specific version if version is specified, "
        "or for all versions if version is not specified."
    )  # type: ignore
    async def experiment_count(
        self,
        info: Info[Context, None],
        dataset_version_id: Optional[GlobalID] = UNSET,
    ) -> int:
        stmt = select(count(models.Experiment.id)).where(
            models.Experiment.dataset_id == self.id_attr
        )
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
    ) -> Connection[Experiment]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )
        dataset_id = self.id_attr
        row_number = func.row_number().over(order_by=models.Experiment.id).label("row_number")
        query = (
            select(models.Experiment, row_number)
            .where(models.Experiment.dataset_id == dataset_id)
            .order_by(models.Experiment.id.desc())
        )
        async with info.context.db() as session:
            experiments = [
                to_gql_experiment(experiment, sequence_number)
                async for experiment, sequence_number in cast(
                    AsyncIterable[Tuple[models.Experiment, int]],
                    await session.stream(query),
                )
            ]
        return connection_from_list(data=experiments, args=args)

    @strawberry.field
    async def experiment_annotation_summaries(
        self, info: Info[Context, None]
    ) -> List[ExperimentAnnotationSummary]:
        dataset_id = self.id_attr
        query = (
            select(
                models.ExperimentRunAnnotation.name,
                func.min(models.ExperimentRunAnnotation.score),
                func.max(models.ExperimentRunAnnotation.score),
                func.avg(models.ExperimentRunAnnotation.score),
                func.count(),
                func.count(models.ExperimentRunAnnotation.error),
            )
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
                ExperimentAnnotationSummary(
                    annotation_name=annotation_name,
                    min_score=min_score,
                    max_score=max_score,
                    mean_score=mean_score,
                    count=count_,
                    error_count=error_count,
                )
                async for (
                    annotation_name,
                    min_score,
                    max_score,
                    mean_score,
                    count_,
                    error_count,
                ) in await session.stream(query)
            ]


def to_gql_dataset(dataset: models.Dataset) -> Dataset:
    """
    Converts an ORM dataset to a GraphQL dataset.
    """
    return Dataset(
        id_attr=dataset.id,
        name=dataset.name,
        description=dataset.description,
        metadata=dataset.metadata_,
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
    )
