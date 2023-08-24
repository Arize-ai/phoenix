import asyncio
from typing import List, Optional

import strawberry
from strawberry.types import Info
from strawberry.unset import UNSET
from typing_extensions import Annotated

from phoenix.config import get_exported_files
from phoenix.core.model_schema import PRIMARY, REFERENCE
from phoenix.server.api.context import Context

from ..input_types.DimensionFilter import DimensionFilter
from ..input_types.Granularity import Granularity
from ..input_types.PerformanceMetricInput import PerformanceMetricInput
from ..input_types.TimeRange import TimeRange
from .Dataset import Dataset
from .DatasetRole import AncillaryDatasetRole, DatasetRole
from .Dimension import Dimension, to_gql_dimension
from .EmbeddingDimension import EmbeddingDimension, to_gql_embedding_dimension
from .ExportedFile import ExportedFile
from .pagination import Connection, ConnectionArgs, Cursor, connection_from_list
from .TimeSeries import (
    PerformanceTimeSeries,
    ensure_timeseries_parameters,
    get_timeseries_data,
)


@strawberry.type
class Model:
    @strawberry.field
    def dimensions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
        include: Optional[DimensionFilter] = UNSET,
        exclude: Optional[DimensionFilter] = UNSET,
    ) -> Connection[Dimension]:
        model = info.context.model
        return connection_from_list(
            [
                to_gql_dimension(index, dimension)
                for index, dimension in enumerate(model.scalar_dimensions)
                if (not isinstance(include, DimensionFilter) or include.matches(dimension))
                and (not isinstance(exclude, DimensionFilter) or not exclude.matches(dimension))
            ],
            args=ConnectionArgs(
                first=first,
                after=after if isinstance(after, Cursor) else None,
                last=last,
                before=before if isinstance(before, Cursor) else None,
            ),
        )

    @strawberry.field
    def primary_dataset(self, info: Info[Context, None]) -> Dataset:
        dataset = info.context.model[PRIMARY]
        start, stop = dataset.time_range
        return Dataset(
            start_time=start,
            end_time=stop,
            record_count=len(dataset),
            dataset=dataset,
            dataset_role=DatasetRole.primary,
            model=info.context.model,
        )

    @strawberry.field
    def reference_dataset(self, info: Info[Context, None]) -> Optional[Dataset]:
        if (dataset := info.context.model[REFERENCE]).empty:
            return None
        start, stop = dataset.time_range
        return Dataset(
            start_time=start,
            end_time=stop,
            record_count=len(dataset),
            dataset=dataset,
            dataset_role=DatasetRole.reference,
            model=info.context.model,
        )

    @strawberry.field
    def corpus_dataset(self, info: Info[Context, None]) -> Optional[Dataset]:
        if info.context.corpus is None:
            return None
        if (dataset := info.context.corpus[PRIMARY]).empty:
            return None
        start, stop = dataset.time_range
        return Dataset(
            start_time=start,
            end_time=stop,
            record_count=len(dataset),
            dataset=dataset,
            dataset_role=AncillaryDatasetRole.corpus,
            model=info.context.corpus,
        )

    @strawberry.field
    def embedding_dimensions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[Cursor] = UNSET,
        before: Optional[Cursor] = UNSET,
    ) -> Connection[EmbeddingDimension]:
        """
        A non-trivial implementation should efficiently fetch only
        the necessary books after the offset.
        For simplicity, here we build the list and then slice it accordingly
        """
        model = info.context.model
        return connection_from_list(
            [
                to_gql_embedding_dimension(index, embedding_dimension)
                for index, embedding_dimension in enumerate(
                    model.embedding_dimensions,
                )
            ],
            args=ConnectionArgs(
                first=first,
                after=after if isinstance(after, Cursor) else None,
                last=last,
                before=before if isinstance(before, Cursor) else None,
            ),
        )

    @strawberry.field(
        description="Returns exported file names sorted by descending modification time.",
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    async def exported_files(
        self,
        info: Info[Context, None],
    ) -> List[ExportedFile]:
        loop = asyncio.get_running_loop()
        return [
            ExportedFile(file_name=path.stem)
            for path in sorted(
                await loop.run_in_executor(
                    None,
                    get_exported_files,
                    info.context.export_path,
                ),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        ]

    @strawberry.field
    def performance_metric(
        self,
        info: Info[Context, None],
        metric: PerformanceMetricInput,
        time_range: Optional[TimeRange] = UNSET,
        dataset_role: Annotated[
            Optional[DatasetRole],
            strawberry.argument(
                description="The dataset (primary or reference) to query",
            ),
        ] = DatasetRole.primary,
    ) -> Optional[float]:
        if not isinstance(dataset_role, DatasetRole):
            dataset_role = DatasetRole.primary
        model = info.context.model
        dataset = model[dataset_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            dataset,
            time_range,
        )
        metric_instance = metric.metric_instance(model)
        data = get_timeseries_data(
            dataset,
            metric_instance,
            time_range,
            granularity,
        )
        return data[0].value if len(data) else None

    @strawberry.field(
        description=(
            "Returns the time series of the specified metric for data within a time range. Data"
            " points are generated starting at the end time and are separated by the sampling"
            " interval. Each data point is labeled by the end instant and contains data from their"
            " respective evaluation windows."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def performance_time_series(
        self,
        info: Info[Context, None],
        metric: PerformanceMetricInput,
        time_range: TimeRange,
        granularity: Granularity,
        dataset_role: Annotated[
            Optional[DatasetRole],
            strawberry.argument(
                description="The dataset (primary or reference) to query",
            ),
        ] = DatasetRole.primary,
    ) -> PerformanceTimeSeries:
        if not isinstance(dataset_role, DatasetRole):
            dataset_role = DatasetRole.primary
        model = info.context.model
        dataset = model[dataset_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            dataset,
            time_range,
            granularity,
        )
        metric_instance = metric.metric_instance(model)
        return PerformanceTimeSeries(
            data=get_timeseries_data(
                dataset,
                metric_instance,
                time_range,
                granularity,
            )
        )
