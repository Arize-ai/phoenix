from collections import defaultdict
from typing import Any, Dict, List, Optional

import pandas as pd
import strawberry
from strawberry import UNSET
from strawberry.relay import Node, NodeID
from strawberry.types import Info
from typing_extensions import Annotated

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import CONTINUOUS, PRIMARY, REFERENCE, ScalarDimension
from phoenix.metrics import binning
from phoenix.metrics.metrics import Count
from phoenix.metrics.timeseries import row_interval_from_sorted_time_index

from ..context import Context
from ..input_types.Granularity import Granularity
from ..input_types.TimeRange import TimeRange
from .DataQualityMetric import DataQualityMetric
from .DatasetValues import DatasetValues
from .DimensionDataType import DimensionDataType
from .DimensionShape import DimensionShape
from .DimensionType import DimensionType
from .InferencesRole import InferencesRole
from .ScalarDriftMetricEnum import ScalarDriftMetric
from .Segments import (
    GqlBinFactory,
    Segment,
    Segments,
)
from .TimeSeries import (
    DataQualityTimeSeries,
    DriftTimeSeries,
    ensure_timeseries_parameters,
    get_data_quality_timeseries_data,
    get_drift_timeseries_data,
)


@strawberry.type
class Dimension(Node):
    id_attr: NodeID[int]
    name: str = strawberry.field(description="The name of the dimension (a.k.a. the column name)")
    type: DimensionType = strawberry.field(
        description="Whether the dimension represents a feature, tag, prediction, or actual."
    )
    dataType: DimensionDataType = strawberry.field(
        description="The data type of the column. Categorical or numeric."
    )
    shape: DimensionShape = strawberry.field(
        description="Whether the dimension data is continuous or discrete."
    )
    dimension: strawberry.Private[ScalarDimension]

    @strawberry.field
    def drift_metric(
        self,
        info: Info[Context, None],
        metric: ScalarDriftMetric,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[float]:
        """
        Computes a drift metric between all reference data and the primary data
        belonging to the input time range (inclusive of the time range start and
        exclusive of the time range end). Returns None if no reference inferences
        exist, if no primary data exists in the input time range, or if the
        input time range is invalid.
        """
        model = info.context.model
        if model[REFERENCE].empty:
            return None
        inferences = model[PRIMARY]
        time_range, granularity = ensure_timeseries_parameters(
            inferences,
            time_range,
        )
        data = get_drift_timeseries_data(
            self.dimension,
            metric,
            time_range,
            granularity,
            pd.DataFrame(
                {self.dimension.name: self.dimension[REFERENCE]},
                copy=False,
            ),
        )
        return data[0].value if len(data) else None

    @strawberry.field
    async def data_quality_metric(
        self,
        info: Info[Context, None],
        metric: DataQualityMetric,
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
        inferences = info.context.model[inferences_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            inferences,
            time_range,
        )
        data = get_data_quality_timeseries_data(
            self.dimension,
            metric,
            time_range,
            granularity,
            inferences_role,
        )
        return data[0].value if len(data) else None

    @strawberry.field(
        description=(
            "Returns the observed categories of a categorical dimension (usually a dimension of"
            " string values) as a list of unique string labels sorted in lexicographical order."
            " Missing values are excluded. Non-categorical dimensions return an empty list."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def categories(self) -> List[str]:
        return list(self.dimension.categories)

    @strawberry.field(
        description=(
            "Returns the time series of the specified metric for data within a time range. Data"
            " points are generated starting at the end time and are separated by the sampling"
            " interval. Each data point is labeled by the end instant and contains data from their"
            " respective evaluation windows."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def data_quality_time_series(
        self,
        info: Info[Context, None],
        metric: DataQualityMetric,
        time_range: TimeRange,
        granularity: Granularity,
        inferences_role: Annotated[
            Optional[InferencesRole],
            strawberry.argument(
                description="The inferences (primary or reference) to query",
            ),
        ] = InferencesRole.primary,
    ) -> DataQualityTimeSeries:
        if not isinstance(inferences_role, InferencesRole):
            inferences_role = InferencesRole.primary
        inferences = info.context.model[inferences_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            inferences,
            time_range,
            granularity,
        )
        return DataQualityTimeSeries(
            data=get_data_quality_timeseries_data(
                self.dimension,
                metric,
                time_range,
                granularity,
                inferences_role,
            )
        )

    @strawberry.field(
        description=(
            "The time series of the specified metric for data within a time range. Data"
            " points are generated starting at the end time and are separated by the sampling"
            " interval. Each data point is labeled by the end instant and contains data from their"
            " respective evaluation windows."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def drift_time_series(
        self,
        info: Info[Context, None],
        metric: ScalarDriftMetric,
        time_range: TimeRange,
        granularity: Granularity,
    ) -> DriftTimeSeries:
        model = info.context.model
        if model[REFERENCE].empty:
            return DriftTimeSeries(data=[])
        inferences = model[PRIMARY]
        time_range, granularity = ensure_timeseries_parameters(
            inferences,
            time_range,
            granularity,
        )
        return DriftTimeSeries(
            data=get_drift_timeseries_data(
                self.dimension,
                metric,
                time_range,
                granularity,
                pd.DataFrame(
                    {self.dimension.name: self.dimension[REFERENCE]},
                    copy=False,
                ),
            )
        )

    @strawberry.field(
        description="The segments across both inference sets and returns the counts per segment",
    )  # type: ignore
    def segments_comparison(
        self,
        info: Info[Context, None],
        primary_time_range: Optional[TimeRange] = UNSET,
    ) -> Segments:
        # TODO: Implement binning across primary and reference

        model = info.context.model
        count = Count()
        summaries = defaultdict(pd.DataFrame)
        binning_method = (
            binning.QuantileBinning(
                reference_series=self.dimension[REFERENCE],
            )
            if self.dimension.data_type is CONTINUOUS
            else binning.CategoricalBinning()
        )
        for role, time_range in (
            (PRIMARY, primary_time_range),
            (REFERENCE, None),
        ):
            if (df := model[role]).empty:
                continue
            if time_range:
                start, stop = row_interval_from_sorted_time_index(
                    df.index,
                    time_range.start,
                    time_range.end,
                )
                df = df.iloc[start:stop]
            summaries[role] = binning_method.segmented_summary(
                self.dimension,
                df,
                (count,),
            )
        segments = Segments()
        lbound, ubound = self.dimension.min_max
        gql_bin_factory = GqlBinFactory(
            numeric_lbound=lbound,
            numeric_ubound=ubound,
        )
        all_bins = summaries[PRIMARY].index.union(summaries[REFERENCE].index)
        if isinstance(binning_method, binning.IntervalBinning) and binning_method.bins is not None:
            all_bins = all_bins.union(binning_method.bins)
        for bin in all_bins:
            values: Dict[ms.InferencesRole, Any] = defaultdict(lambda: None)
            for role in ms.InferencesRole:
                if model[role].empty:
                    continue
                try:
                    result = summaries[role].loc[bin]
                except KeyError:
                    result = {}
                values[role] = count.get_value(result)
            segments.append(
                Segment(
                    bin=gql_bin_factory(bin),
                    counts=DatasetValues(
                        primary_value=values[PRIMARY],
                        reference_value=values[REFERENCE],
                    ),
                )
            )
        return segments


def to_gql_dimension(id_attr: int, dimension: ScalarDimension) -> Dimension:
    """
    Converts a phoenix.core.Dimension to a phoenix.server.api.types.Dimension
    """
    return Dimension(
        id_attr=id_attr,
        name=dimension.name,
        type=DimensionType.from_dimension(dimension),
        dataType=DimensionDataType.from_dimension(dimension),
        dimension=dimension,
        shape=DimensionShape.from_dimension(dimension),
    )
