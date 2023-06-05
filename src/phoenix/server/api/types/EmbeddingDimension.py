from collections import defaultdict
from datetime import timedelta
from typing import Dict, Iterator, List, Optional, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
import strawberry
from strawberry import UNSET
from strawberry.scalars import ID
from strawberry.types import Info
from typing_extensions import Annotated

import phoenix.core.model_schema as ms
from phoenix.core.model_schema import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    PREDICTION_ID,
    PREDICTION_LABEL,
    PREDICTION_SCORE,
    PRIMARY,
    REFERENCE,
    Dataset,
    EventId,
)
from phoenix.metrics.timeseries import row_interval_from_sorted_time_index
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.pointcloud.pointcloud import PointCloud
from phoenix.pointcloud.projectors import Umap
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.Cluster import to_gql_clusters
from phoenix.server.api.types.DatasetRole import DatasetRole
from phoenix.server.api.types.VectorDriftMetricEnum import VectorDriftMetric

from ..input_types.Granularity import Granularity
from .DataQualityMetric import DataQualityMetric
from .EmbeddingMetadata import EmbeddingMetadata
from .EventMetadata import EventMetadata
from .node import GlobalID, Node
from .TimeSeries import (
    DataQualityTimeSeries,
    DriftTimeSeries,
    ensure_timeseries_parameters,
    get_data_quality_timeseries_data,
    get_drift_timeseries_data,
)
from .UMAPPoints import UMAPPoint, UMAPPoints, to_gql_coordinates

# Default UMAP hyperparameters
DEFAULT_N_COMPONENTS = 3
DEFAULT_MIN_DIST = 0
DEFAULT_N_NEIGHBORS = 30
DEFAULT_N_SAMPLES = 500
# Default HDBSCAN hyperparameters
DEFAULT_MIN_CLUSTER_SIZE = 10
DEFAULT_MIN_SAMPLES = 1
DEFAULT_CLUSTER_SELECTION_EPSILON = 0

DRIFT_EVAL_WINDOW_NUM_INTERVALS = 72
EVAL_INTERVAL_LENGTH = timedelta(hours=1)


@strawberry.type
class EmbeddingDimension(Node):
    """A embedding dimension of a model. Represents unstructured data"""

    name: str
    dimension: strawberry.Private[ms.EmbeddingDimension]

    @strawberry.field(
        description=(
            "Computes a drift metric between all reference data and the primary data belonging to"
            " the input time range (inclusive of the time range start and exclusive of the time"
            " range end). Returns None if no reference dataset exists, if no primary data exists in"
            " the input time range, or if the input time range is invalid."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def drift_metric(
        self,
        info: Info[Context, None],
        metric: VectorDriftMetric,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[float]:
        model = info.context.model
        if model[REFERENCE].empty:
            return None
        dataset = model[PRIMARY]
        time_range, granularity = ensure_timeseries_parameters(
            dataset,
            time_range,
        )
        data = get_drift_timeseries_data(
            self.dimension,
            metric,
            time_range,
            granularity,
        )
        return data[0].value if len(data) else None

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
        dataset_role: Annotated[
            Optional[DatasetRole],
            strawberry.argument(
                description="The dataset (primary or reference) to query",
            ),
        ] = DatasetRole.primary,
    ) -> DataQualityTimeSeries:
        if not isinstance(dataset_role, DatasetRole):
            dataset_role = DatasetRole.primary
        dataset = info.context.model[dataset_role.value]
        time_range, granularity = ensure_timeseries_parameters(
            dataset,
            time_range,
            granularity,
        )
        return DataQualityTimeSeries(
            data=get_data_quality_timeseries_data(
                self.dimension,
                metric,
                time_range,
                granularity,
                dataset_role,
            )
        )

    @strawberry.field(
        description=(
            "Computes a drift time-series between the primary and reference datasets. The output"
            " drift time-series contains one data point for each whole hour in the input time range"
            " (inclusive of the time range start and exclusive of the time range end). Each data"
            " point contains the drift metric value between all reference data and the primary data"
            " within the evaluation window ending at the corresponding time. Returns None if no"
            " reference dataset exists or if the input time range is invalid.           "
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def drift_time_series(
        self,
        info: Info[Context, None],
        metric: VectorDriftMetric,
        time_range: TimeRange,
        granularity: Granularity,
    ) -> DriftTimeSeries:
        model = info.context.model
        if model[REFERENCE].empty:
            return DriftTimeSeries(data=[])
        dataset = model[PRIMARY]
        time_range, granularity = ensure_timeseries_parameters(
            dataset,
            time_range,
            granularity,
        )
        return DriftTimeSeries(
            data=get_drift_timeseries_data(
                self.dimension,
                metric,
                time_range,
                granularity,
            )
        )

    @strawberry.field
    def UMAPPoints(
        self,
        info: Info[Context, None],
        time_range: Annotated[
            TimeRange,
            strawberry.argument(
                description="The time range of the primary dataset to generate the UMAP points for",
            ),
        ],
        n_components: Annotated[
            Optional[int],
            strawberry.argument(
                description="UMAP target dimension hyperparameter. Must be 2 or 3",
            ),
        ] = DEFAULT_N_COMPONENTS,
        min_dist: Annotated[
            float,
            strawberry.argument(
                description="UMAP minimum distance hyperparameter",
            ),
        ] = DEFAULT_MIN_DIST,
        n_neighbors: Annotated[
            int,
            strawberry.argument(
                description="UMAP N neighbors hyperparameter",
            ),
        ] = DEFAULT_N_NEIGHBORS,
        n_samples: Annotated[
            int,
            strawberry.argument(
                description="UMAP N samples",
            ),
        ] = DEFAULT_N_SAMPLES,
        min_cluster_size: Annotated[
            int,
            strawberry.argument(
                description="HDBSCAN minimum cluster size",
            ),
        ] = DEFAULT_MIN_CLUSTER_SIZE,
        cluster_min_samples: Annotated[
            int,
            strawberry.argument(
                description="HDBSCAN minimum samples",
            ),
        ] = DEFAULT_MIN_SAMPLES,
        cluster_selection_epsilon: Annotated[
            float,
            strawberry.argument(
                description="HDBSCAN cluster selection epsilon",
            ),
        ] = DEFAULT_CLUSTER_SELECTION_EPSILON,
    ) -> UMAPPoints:
        model = info.context.model
        data: Dict[EventId, npt.NDArray[np.float64]] = {}
        for dataset in model[Dataset]:
            dataset_id = dataset.role
            row_id_start, row_id_stop = 0, len(dataset)
            if dataset_id is PRIMARY:
                row_id_start, row_id_stop = row_interval_from_sorted_time_index(
                    time_index=cast(pd.DatetimeIndex, dataset.index),
                    time_start=time_range.start,
                    time_stop=time_range.end,
                )
            vector_column = self.dimension[dataset_id]
            samples_collected = 0
            for row_id in _row_indices(
                row_id_start,
                row_id_stop,
                shuffle=0 < n_samples < (row_id_stop - row_id_start),
            ):
                if samples_collected >= n_samples:
                    break
                embedding_vector = vector_column.iloc[row_id]
                # Exclude scalar values, e.g. None/NaN, by checking the presence
                # of dunder method __len__.
                if not hasattr(embedding_vector, "__len__"):
                    continue
                event_id = EventId(row_id, dataset_id)
                data[event_id] = embedding_vector
                samples_collected += 1

        # validate n_components to be 2 or 3
        n_components = DEFAULT_N_COMPONENTS if n_components is None else n_components
        if not 2 <= n_components <= 3:
            raise Exception(f"n_components must be 2 or 3, got {n_components}")

        vectors, clustered_events = PointCloud(
            dimensionalityReducer=Umap(n_neighbors=n_neighbors, min_dist=min_dist),
            clustersFinder=Hdbscan(
                min_cluster_size=min_cluster_size,
                min_samples=cluster_min_samples,
                cluster_selection_epsilon=cluster_selection_epsilon,
            ),
        ).generate(data, n_components=n_components)

        points: Dict[ms.DatasetRole, List[UMAPPoint]] = defaultdict(list)
        for event_id, vector in vectors.items():
            row_id = event_id.row_id
            dataset_id = event_id.dataset_id
            dataset = model[dataset_id]
            points[dataset_id].append(
                UMAPPoint(
                    id=GlobalID(f"{type(self).__name__}:{str(dataset_id)}", row_id),
                    event_id=ID(str(event_id)),
                    coordinates=to_gql_coordinates(vector),
                    event_metadata=EventMetadata(
                        prediction_label=dataset[PREDICTION_LABEL][row_id],
                        prediction_score=dataset[PREDICTION_SCORE][row_id],
                        actual_label=dataset[ACTUAL_LABEL][row_id],
                        actual_score=dataset[ACTUAL_SCORE][row_id],
                    ),
                    embedding_metadata=EmbeddingMetadata(
                        prediction_id=dataset[PREDICTION_ID][row_id],
                        link_to_data=dataset[self.dimension.link_to_data][row_id],
                        raw_data=dataset[self.dimension.raw_data][row_id],
                    ),
                )
            )

        return UMAPPoints(
            data=points[PRIMARY],
            reference_data=points[REFERENCE],
            clusters=to_gql_clusters(
                clustered_events=clustered_events,
            ),
        )


def _row_indices(
    start: int,
    stop: int,
    /,
    shuffle: bool = False,
) -> Iterator[int]:
    if not shuffle:
        yield from range(start, stop)
        return
    shuffled_indices = np.arange(start, stop)
    np.random.shuffle(shuffled_indices)
    yield from shuffled_indices


def to_gql_embedding_dimension(
    id_attr: int,
    embedding_dimension: ms.EmbeddingDimension,
) -> EmbeddingDimension:
    """
    Converts a phoenix.core.model_schema.EmbeddingDimension to a
    phoenix.server.api.types.EmbeddingDimension
    """
    return EmbeddingDimension(
        id_attr=id_attr,
        name=embedding_dimension.display_name,
        dimension=embedding_dimension,
    )
