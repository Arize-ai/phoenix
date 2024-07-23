import asyncio
from typing import List, Optional

import strawberry
from strawberry import UNSET, Info
from strawberry.relay import Connection
from typing_extensions import Annotated

from phoenix.config import get_exported_files
from phoenix.core.model_schema import PRIMARY, REFERENCE
from phoenix.server.api.context import Context

from ..input_types.DimensionFilter import DimensionFilter
from ..input_types.Granularity import Granularity
from ..input_types.PerformanceMetricInput import PerformanceMetricInput
from ..input_types.TimeRange import TimeRange
from .Dimension import Dimension, to_gql_dimension
from .EmbeddingDimension import EmbeddingDimension, to_gql_embedding_dimension
from .ExportedFile import ExportedFile
from .Inferences import Inferences
from .InferencesRole import AncillaryInferencesRole, InferencesRole
from .pagination import ConnectionArgs, CursorString, connection_from_list
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
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
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
                after=after if isinstance(after, CursorString) else None,
                last=last,
                before=before if isinstance(before, CursorString) else None,
            ),
        )

    @strawberry.field
    def primary_inferences(self, info: Info[Context, None]) -> Inferences:
        inferences = info.context.model[PRIMARY]
        start, stop = inferences.time_range
        return Inferences(
            start_time=start,
            end_time=stop,
            record_count=len(inferences),
            inferences=inferences,
            inferences_role=InferencesRole.primary,
            model=info.context.model,
        )

    @strawberry.field
    def reference_inferences(self, info: Info[Context, None]) -> Optional[Inferences]:
        if (inferences := info.context.model[REFERENCE]).empty:
            return None
        start, stop = inferences.time_range
        return Inferences(
            start_time=start,
            end_time=stop,
            record_count=len(inferences),
            inferences=inferences,
            inferences_role=InferencesRole.reference,
            model=info.context.model,
        )

    @strawberry.field
    def corpus_inferences(self, info: Info[Context, None]) -> Optional[Inferences]:
        if info.context.corpus is None:
            return None
        if (inferences := info.context.corpus[PRIMARY]).empty:
            return None
        start, stop = inferences.time_range
        return Inferences(
            start_time=start,
            end_time=stop,
            record_count=len(inferences),
            inferences=inferences,
            inferences_role=AncillaryInferencesRole.corpus,
            model=info.context.corpus,
        )

    @strawberry.field
    def embedding_dimensions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
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
                after=after if isinstance(after, CursorString) else None,
                last=last,
                before=before if isinstance(before, CursorString) else None,
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
        inferences_role: Annotated[
            Optional[InferencesRole],
            strawberry.argument(
                description="The inferences (primary or reference) to query",
            ),
        ] = InferencesRole.primary,
    ) -> Optional[float]:
        if not isinstance(inferences_role, InferencesRole):
            inferences_role = InferencesRole.primary
        model = info.context.model
        inferences = model[inferences_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            inferences,
            time_range,
        )
        metric_instance = metric.metric_instance(model)
        data = get_timeseries_data(
            inferences,
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
        inferences_role: Annotated[
            Optional[InferencesRole],
            strawberry.argument(
                description="The inferences (primary or reference) to query",
            ),
        ] = InferencesRole.primary,
    ) -> PerformanceTimeSeries:
        if not isinstance(inferences_role, InferencesRole):
            inferences_role = InferencesRole.primary
        model = info.context.model
        inferences = model[inferences_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            inferences,
            time_range,
            granularity,
        )
        metric_instance = metric.metric_instance(model)
        return PerformanceTimeSeries(
            data=get_timeseries_data(
                inferences,
                metric_instance,
                time_range,
                granularity,
            )
        )
