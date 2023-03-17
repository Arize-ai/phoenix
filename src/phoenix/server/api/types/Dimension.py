from typing import List, Optional

import strawberry
from strawberry.types import Info

from phoenix.core import Dimension as CoreDimension
from phoenix.server.api.context import Context

from ..input_types.Granularity import Granularity
from ..input_types.TimeRange import TimeRange
from .DataQualityMetric import DataQualityMetric
from .DimensionDataType import DimensionDataType
from .DimensionType import DimensionType
from .DriftMetric import ScalarDriftMetric
from .node import Node
from .TimeSeries import DataQualityTimeSeries, DriftTimeSeries


@strawberry.type
class Dimension(Node):
    name: str = strawberry.field(description="The name of the dimension (a.k.a. the column name)")
    type: DimensionType = strawberry.field(
        description="Whether the dimension represents a feature, tag, prediction, or actual."
    )

    dataType: DimensionDataType = strawberry.field(
        description="The data type of the column. Categorical or numeric."
    )

    @strawberry.field
    def drift_metric(
        self,
        info: Info[Context, None],
        metric: ScalarDriftMetric,
        time_range: Optional[TimeRange] = None,
    ) -> Optional[float]:
        """
        Computes a drift metric between all reference data and the primary data
        belonging to the input time range (inclusive of the time range start and
        exclusive of the time range end). Returns None if no reference dataset
        exists, if no primary data exists in the input time range, or if the
        input time range is invalid.
        """
        if len(
            data := DriftTimeSeries(
                self.name,
                info.context.model,
                metric,
                time_range,
                dtype=self.dataType,
            ).data
        ):
            return data.pop().value
        return None

    @strawberry.field
    async def data_quality_metric(
        self,
        info: Info[Context, None],
        metric: DataQualityMetric,
        time_range: Optional[TimeRange] = None,
    ) -> Optional[float]:
        if len(
            data := DataQualityTimeSeries(
                self.name,
                info.context.model,
                metric,
                time_range,
            ).data
        ):
            return data.pop().value
        return None

    @strawberry.field(
        description=(
            "Returns the observed categories of a categorical dimension (usually a dimension of"
            " string values) as a list of unique string labels sorted in lexicographical order."
            " Missing values are excluded. Non-categorical dimensions return an empty list."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def categories(self, info: Info[Context, None]) -> List[str]:
        for dim in info.context.model.dimensions:
            if dim.name == self.name:
                return dim.categories
        return []

    @strawberry.field(
        description=(
            "Returns the time series of the specified metric for data within timeRange. Data points"
            " are generated starting at the end time, are separated by the sampling interval. Each"
            " data point is labeled by the end instant of and contains data from their respective"
            " evaluation window."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def data_quality_time_series(
        self,
        info: Info[Context, None],
        metric: DataQualityMetric,
        time_range: TimeRange,
        granularity: Granularity,
    ) -> DataQualityTimeSeries:
        return DataQualityTimeSeries(
            self.name,
            info.context.model,
            metric,
            time_range,
            granularity,
        )

    @strawberry.field(
        description=(
            "Returns the time series of the specified metric for data within timeRange. Data points"
            " are generated starting at the end time, are separated by the sampling interval. Each"
            " data point is labeled by the end instant of and contains data from their respective"
            " evaluation window."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def drift_time_series(
        self,
        info: Info[Context, None],
        metric: ScalarDriftMetric,
        time_range: TimeRange,
        granularity: Granularity,
    ) -> DriftTimeSeries:
        return DriftTimeSeries(
            self.name,
            info.context.model,
            metric,
            time_range,
            granularity,
            dtype=self.dataType,
        )


def to_gql_dimension(id_attr: int, dimension: CoreDimension) -> Dimension:
    """
    Converts a phoenix.core.Dimension to a phoenix.server.api.types.Dimension
    """
    return Dimension(
        id_attr=id_attr,
        name=dimension.name,
        type=DimensionType[dimension.type.value],
        dataType=DimensionDataType[dimension.data_type.value],
    )
