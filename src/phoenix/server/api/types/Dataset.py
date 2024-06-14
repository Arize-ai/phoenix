from collections import defaultdict
from datetime import datetime
from typing import AsyncIterable, DefaultDict, List, Optional, Tuple, Union, cast

import strawberry
from sqlalchemy import and_, func, select
from sqlalchemy.orm import joinedload
from sqlalchemy.sql.functions import count
from strawberry import UNSET
from strawberry.relay import Connection, GlobalID, Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DatasetVersionSort import DatasetVersionSort
from phoenix.server.api.types.DatasetExample import DatasetExample
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.pagination import (
    ConnectionArgs,
    CursorString,
    connection_from_list,
)
from phoenix.server.api.types.SortDir import SortDir


@strawberry.type
class RepeatedExperimentRuns:
    runs: List[ExperimentRun]


@strawberry.type
class ExperimentComparison(Node):
    id_attr: NodeID[int]
    example: DatasetExample
    runs: List[Optional[Union[ExperimentRun, RepeatedExperimentRuns]]]  # this could be a resolverf


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
    async def compare_experiments(
        self,
        info: Info[Context, None],
        experiment_ids: List[GlobalID],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[ExperimentComparison]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )

        if not experiment_ids:
            raise ValueError("At least one experiment ID must be provided.")

        OrmExample = models.DatasetExample
        OrmExperiment = models.Experiment
        OrmRun: TypeAlias = models.ExperimentRun
        OrmRevision = models.DatasetExampleRevision
        OrmTrace = models.Trace

        dataset_id = self.id_attr
        decoded_experiment_ids = [
            from_global_id_with_expected_type(experiment_id, OrmExperiment.__name__)
            for experiment_id in experiment_ids
        ]
        baseline_experiment_id = decoded_experiment_ids[0]

        async with info.context.db() as session:
            if (
                baseline_version_id := await session.scalar(
                    select(OrmExperiment.dataset_version_id).where(
                        and_(
                            OrmExperiment.id == baseline_experiment_id,
                            OrmExperiment.dataset_id == dataset_id,
                        )
                    )
                )
            ) is None:
                raise ValueError("Baseline experiment not found.")
            if not (
                baseline_example_ids := (
                    await session.scalars(
                        select(func.distinct(OrmRun.dataset_example_id))
                        .where(OrmRun.experiment_id == baseline_experiment_id)
                        .order_by(OrmRun.dataset_example_id.desc())
                    )
                ).all()
            ):
                raise ValueError("Baseline experiment has no runs.")

            revision_ids = (
                select(func.max(OrmRevision.id))
                .where(
                    and_(
                        OrmRevision.dataset_example_id.in_(baseline_example_ids),
                        OrmRevision.dataset_version_id <= baseline_version_id,
                    )
                )
                .group_by(OrmRevision.dataset_example_id)
                .scalar_subquery()
            )
            examples = {
                example.id: example
                async for example in await session.stream_scalars(
                    select(OrmExample)
                    .join(OrmRevision, OrmExample.id == OrmRevision.dataset_example_id)
                    .where(
                        and_(
                            OrmRevision.id.in_(revision_ids),
                            OrmRevision.revision_kind != "DELETE",
                        )
                    )
                )
            }

            ExampleID: TypeAlias = int
            ExperimentID: TypeAlias = int
            runs: DefaultDict[ExampleID, DefaultDict[ExperimentID, List[OrmRun]]] = defaultdict(
                lambda: defaultdict(list)
            )
            for run in await session.scalars(
                select(OrmRun)
                .where(
                    and_(
                        OrmRun.dataset_example_id.in_(baseline_example_ids),
                        OrmRun.experiment_id.in_(decoded_experiment_ids),
                    )
                )
                .options(joinedload(OrmRun.trace).load_only(OrmTrace.trace_id))
            ):
                runs[run.dataset_example_id][run.experiment_id].append(run)

        comparisons = []
        for example_id in baseline_example_ids:
            example = examples[example_id]
            gql_runs_list = []
            for experiment_id in decoded_experiment_ids:
                repetitions = runs[example_id][experiment_id]
                gql_runs: Optional[Union[ExperimentRun, RepeatedExperimentRuns]]
                if (num_repetitions := len(repetitions)) == 0:
                    gql_runs = None
                elif num_repetitions == 1:
                    gql_runs = to_gql_experiment_run(repetitions[0])
                else:
                    gql_runs = RepeatedExperimentRuns(
                        runs=[to_gql_experiment_run(run) for run in repetitions]
                    )
                gql_runs_list.append(gql_runs)
            comparisons.append(
                ExperimentComparison(
                    id_attr=1,
                    example=DatasetExample(
                        id_attr=example.id,
                        created_at=example.created_at,
                        version_id=baseline_version_id,
                    ),
                    runs=gql_runs_list,
                )
            )
        return connection_from_list(data=comparisons, args=args)


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
