from collections import defaultdict
from datetime import timedelta
from itertools import chain, repeat
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple, Union, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID, Node, NodeID
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
    PROMPT,
    REFERENCE,
    Inferences,
)
from phoenix.metrics.timeseries import row_interval_from_sorted_time_index
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.pointcloud.pointcloud import PointCloud
from phoenix.pointcloud.projectors import Umap
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.Cluster import to_gql_clusters
from phoenix.server.api.types.InferencesRole import AncillaryInferencesRole, InferencesRole
from phoenix.server.api.types.VectorDriftMetricEnum import VectorDriftMetric

from ..input_types.Granularity import Granularity
from .DataQualityMetric import DataQualityMetric
from .EmbeddingMetadata import EmbeddingMetadata
from .Event import create_event_id, unpack_event_id
from .EventMetadata import EventMetadata
from .Retrieval import Retrieval
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

CORPUS = "CORPUS"


@strawberry.type
class EmbeddingDimension(Node):
    """A embedding dimension of a model. Represents unstructured data"""

    id_attr: NodeID[int]
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
            pd.DataFrame(
                {self.dimension.name: self.dimension[REFERENCE]},
                copy=False,
            ),
        )
        return data[0].value if len(data) else None

    @strawberry.field(
        description=(
            "Computes a retrieval metric between corpus data and the primary data belonging to"
            " the input time range (inclusive of the time range start and exclusive of the time"
            " range end). Returns None if no reference dataset exists, if no primary data exists in"
            " the input time range, or if the input time range is invalid."
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def retrieval_metric(
        self,
        info: Info[Context, None],
        metric: VectorDriftMetric,
        time_range: Optional[TimeRange] = UNSET,
    ) -> Optional[float]:
        if (corpus := info.context.corpus) is None:
            return None
        model = info.context.model
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
            pd.DataFrame(
                {self.dimension.name: self.dimension(corpus[PRIMARY])},
                copy=False,
            ),
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
        inferences_role: Annotated[
            Optional[InferencesRole],
            strawberry.argument(
                description="The dataset (primary or reference) to query",
            ),
        ] = InferencesRole.primary,
    ) -> DataQualityTimeSeries:
        if not isinstance(inferences_role, InferencesRole):
            inferences_role = InferencesRole.primary
        dataset = info.context.model[inferences_role.value]
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
                inferences_role,
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
                pd.DataFrame(
                    {self.dimension.name: self.dimension[REFERENCE]},
                    copy=False,
                ),
            )
        )

    @strawberry.field(
        description=(
            "Computes a retrieval metric between the primary and corpus datasets. The output"
            " time-series contains one data point for each whole hour in the input time range"
            " (inclusive of the time range start and exclusive of the time range end). Each data"
            " point contains the metric value between all corpus data and the primary data"
            " within the evaluation window ending at the corresponding time. Returns None if no"
            " corpus dataset exists or if the input time range is invalid.           "
        )
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    def retrieval_metric_time_series(
        self,
        info: Info[Context, None],
        metric: VectorDriftMetric,
        time_range: TimeRange,
        granularity: Granularity,
    ) -> DriftTimeSeries:
        if (corpus := info.context.corpus) is None:
            return DriftTimeSeries(data=[])
        model = info.context.model
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
                pd.DataFrame(
                    {self.dimension.name: self.dimension(corpus[PRIMARY])},
                    copy=False,
                ),
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
        data: Dict[ID, npt.NDArray[np.float64]] = {}
        retrievals: List[Tuple[ID, Any, Any]] = []
        for inferences in model[Inferences]:
            inferences_id = inferences.role
            row_id_start, row_id_stop = 0, len(inferences)
            if inferences_id is PRIMARY:
                row_id_start, row_id_stop = row_interval_from_sorted_time_index(
                    time_index=cast(pd.DatetimeIndex, inferences.index),
                    time_start=time_range.start,
                    time_stop=time_range.end,
                )
            vector_column = self.dimension[inferences_id]
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
                event_id = create_event_id(row_id, inferences_id)
                data[event_id] = embedding_vector
                samples_collected += 1
                if isinstance(
                    self.dimension,
                    ms.RetrievalEmbeddingDimension,
                ):
                    retrievals.append(
                        (
                            event_id,
                            self.dimension.context_retrieval_ids(inferences).iloc[row_id],
                            self.dimension.context_retrieval_scores(inferences).iloc[row_id],
                        )
                    )

        context_retrievals: List[Retrieval] = []
        if isinstance(
            self.dimension,
            ms.RetrievalEmbeddingDimension,
        ) and (corpus := info.context.corpus):
            corpus_inferences = corpus[PRIMARY]
            for row_id, document_embedding_vector in enumerate(corpus_inferences[PROMPT]):
                if not hasattr(document_embedding_vector, "__len__"):
                    continue
                event_id = create_event_id(row_id, AncillaryInferencesRole.corpus)
                data[event_id] = document_embedding_vector
            corpus_primary_key = corpus_inferences.primary_key
            for event_id, retrieval_ids, retrieval_scores in retrievals:
                if not isinstance(retrieval_ids, Iterable):
                    continue
                for document_id, document_score in zip(
                    retrieval_ids,
                    chain(
                        retrieval_scores
                        if isinstance(
                            retrieval_scores,
                            Iterable,
                        )
                        else (),
                        repeat(np.nan),
                    ),
                ):
                    try:
                        document_row_id = corpus_primary_key.get_loc(
                            document_id,
                        )
                    except KeyError:
                        continue
                    document_embedding_vector = corpus_inferences[PROMPT].iloc[document_row_id]
                    if not hasattr(document_embedding_vector, "__len__"):
                        continue
                    context_retrievals.append(
                        Retrieval(
                            query_id=event_id,
                            document_id=create_event_id(
                                document_row_id,
                                AncillaryInferencesRole.corpus,
                            ),
                            relevance=document_score,
                        )
                    )

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

        points: Dict[Union[InferencesRole, AncillaryInferencesRole], List[UMAPPoint]] = defaultdict(
            list
        )
        for event_id, vector in vectors.items():
            row_id, inferences_role = unpack_event_id(event_id)
            if isinstance(inferences_role, InferencesRole):
                dataset = model[inferences_role.value]
                embedding_metadata = EmbeddingMetadata(
                    prediction_id=dataset[PREDICTION_ID][row_id],
                    link_to_data=dataset[self.dimension.link_to_data][row_id],
                    raw_data=dataset[self.dimension.raw_data][row_id],
                )
            elif (corpus := info.context.corpus) is not None:
                dataset = corpus[PRIMARY]
                dimension = cast(ms.EmbeddingDimension, corpus[PROMPT])
                embedding_metadata = EmbeddingMetadata(
                    prediction_id=dataset[PREDICTION_ID][row_id],
                    link_to_data=dataset[dimension.link_to_data][row_id],
                    raw_data=dataset[dimension.raw_data][row_id],
                )
            else:
                continue
            points[inferences_role].append(
                UMAPPoint(
                    id=GlobalID(
                        type_name=f"{type(self).__name__}:{str(inferences_role)}",
                        node_id=str(row_id),
                    ),
                    event_id=event_id,
                    coordinates=to_gql_coordinates(vector),
                    event_metadata=EventMetadata(
                        prediction_label=dataset[PREDICTION_LABEL][row_id],
                        prediction_score=dataset[PREDICTION_SCORE][row_id],
                        actual_label=dataset[ACTUAL_LABEL][row_id],
                        actual_score=dataset[ACTUAL_SCORE][row_id],
                    ),
                    embedding_metadata=embedding_metadata,
                )
            )

        return UMAPPoints(
            data=points[InferencesRole.primary],
            reference_data=points[InferencesRole.reference],
            clusters=to_gql_clusters(
                clustered_events=clustered_events,
            ),
            corpus_data=points[AncillaryInferencesRole.corpus],
            context_retrievals=context_retrievals,
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
