import random
import string
from collections import defaultdict
from datetime import datetime, timedelta
from itertools import chain, repeat, starmap
from typing import List, Mapping, Optional

import numpy as np
import numpy.typing as npt
import strawberry
from pandas import DataFrame, Series, to_datetime
from strawberry.scalars import ID
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension
from phoenix.datasets import Dataset, Schema
from phoenix.datasets.dataset import DatasetType
from phoenix.datasets.event import EventId
from phoenix.metrics.embeddings import euclidean_distance
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.pointcloud.pointcloud import PointCloud
from phoenix.pointcloud.projectors import Umap
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TimeRange import TimeRange

from .DriftMetric import DriftMetric
from .DriftTimeSeries import DriftTimeSeries
from .node import Node
from .TimeSeries import TimeSeriesDataPoint
from .UMAPPoints import (
    Cluster,
    EmbeddingMetadata,
    EventMetadata,
    UMAPPoint,
    UMAPPoints,
    to_gql_coordinates,
)

# Default UMAP hyperparameters
DEFAULT_N_COMPONENTS = 3
DEFAULT_MIN_DIST = 0
DEFAULT_N_NEIGHBORS = 30
DEFAULT_N_SAMPLES = 500


def to_gql_clusters(clusters: Mapping[EventId, int]) -> List[Cluster]:
    clusteredEvents = defaultdict(list)
    for event_id, cluster_id in clusters.items():
        clusteredEvents[ID(str(cluster_id))].append(ID(str(event_id)))
    return [
        Cluster(id=cluster_id, point_ids=event_ids)
        for cluster_id, event_ids in clusteredEvents.items()
    ]


DRIFT_EVAL_WINDOW_NUM_INTERVALS = 72
EVAL_INTERVAL_LENGTH = timedelta(hours=1)


@strawberry.type
class EmbeddingDimension(Node):
    """A embedding dimension of a model. Represents unstructured data"""

    name: str

    # if no reference dataset, what to return? return empty array if no primary
    # filtered points in a particular evaluation window, return none? what if
    # input time range does not begin and end on hour mark? snap to hours? data
    # point refers to statistic computed on data from the evaluation window
    # ending at that timestamp? even if the beginning of the evaluation window
    # is before the start of the input time range?
    @strawberry.field
    def drift_time_series(
        self,
        metric: DriftMetric,
        time_range: Annotated[
            TimeRange,
            strawberry.argument(
                description="The time range of the primary dataset to generate the UMAP points for",
            ),
        ],
        info: Info[Context, None],
    ) -> Optional[DriftTimeSeries]:
        model = info.context.model
        primary_dataset = model.primary_dataset
        reference_dataset = model.reference_dataset
        if reference_dataset is None:
            return DriftTimeSeries(data=[])
        embedding_feature_name = self.name
        timestamp_col_name = primary_dataset.schema.timestamp_column_name
        primary_embeddings_column = primary_dataset.get_embedding_vector_column(
            embedding_feature_name
        )
        reference_embeddings_column = reference_dataset.get_embedding_vector_column(
            embedding_feature_name
        )

        time_series_data_points = []
        if metric is DriftMetric.euclideanDistance:
            reference_centroid = np.mean(
                np.stack(reference_embeddings_column.values, axis=1), axis=1  # type: ignore
            )
            eval_window_end = _round_timestamp_to_next_hour(time_range.start)
            while eval_window_end < time_range.end:
                eval_window_start = (
                    eval_window_end - DRIFT_EVAL_WINDOW_NUM_INTERVALS * EVAL_INTERVAL_LENGTH
                )
                primary_embeddings_df = primary_embeddings_column.to_frame().reset_index()
                filtered_primary_embeddings = apply_query(
                    dataset=primary_dataset,
                    column_names=["text_vector"],
                    start=eval_window_start,
                    end=eval_window_end,
                ).text_vector.values
                distance: Optional[float] = None
                if filtered_primary_embeddings.shape[0] > 0:
                    primary_centroid = np.stack(filtered_primary_embeddings).mean(axis=0)  # type: ignore
                    distance = euclidean_distance(
                        reference_centroid,
                        primary_centroid,
                    )
                time_series_data_points.append(
                    TimeSeriesDataPoint(
                        timestamp=eval_window_end,
                        value=distance,
                    )
                )
                eval_window_end += EVAL_INTERVAL_LENGTH
            return DriftTimeSeries(data=time_series_data_points)
        raise NotImplementedError("")

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
            Optional[float],
            strawberry.argument(
                description="UMAP minimum distance hyperparameter",
            ),
        ] = DEFAULT_MIN_DIST,
        n_neighbors: Annotated[
            Optional[int],
            strawberry.argument(
                description="UMAP N neighbors hyperparameter",
            ),
        ] = DEFAULT_N_NEIGHBORS,
        n_samples: Annotated[
            Optional[int],
            strawberry.argument(
                description="UMAP N samples",
            ),
        ] = DEFAULT_N_SAMPLES,
    ) -> UMAPPoints:
        n_samples = n_samples or DEFAULT_N_SAMPLES

        # TODO validate time_range.

        primary_dataset = info.context.model.primary_dataset
        reference_dataset = info.context.model.reference_dataset

        primary_data = zip(
            starmap(EventId, zip(range(n_samples), repeat(DatasetType.PRIMARY))),
            primary_dataset.get_embedding_vector_column(self.name).to_numpy()[:n_samples],
        )
        if reference_dataset:
            reference_data = zip(
                starmap(EventId, zip(range(n_samples), repeat(DatasetType.REFERENCE))),
                reference_dataset.get_embedding_vector_column(self.name).to_numpy()[:n_samples],
            )
            data = dict(chain(primary_data, reference_data))
        else:
            data = dict(primary_data)

        # validate n_components to be 2 or 3
        n_components = DEFAULT_N_COMPONENTS if n_components is None else n_components
        if not 2 <= n_components <= 3:
            raise Exception(f"n_components must be 2 or 3, got {n_components}")

        min_dist = DEFAULT_MIN_DIST if min_dist is None else min_dist
        n_neighbors = DEFAULT_N_NEIGHBORS if n_neighbors is None else n_neighbors

        vectors, clusters = PointCloud(
            dimensionalityReducer=Umap(n_neighbors=n_neighbors, min_dist=min_dist),
            clustersFinder=Hdbscan(),
        ).generate(data, n_components=n_components)

        primary_points, reference_points = tuple(
            map(
                lambda dataset_id: [
                    UMAPPoint(
                        id=ID(str(event_id)),
                        coordinates=to_gql_coordinates(vector),
                        event_metadata=EventMetadata(
                            prediction_label=random.choices(["A", "B", "C", "D", None])[0],
                            prediction_score=random.random(),
                            actual_label=random.choices(["A", "B", "C", "D", None])[0],
                            actual_score=random.random(),
                        ),
                        embedding_metadata=EmbeddingMetadata(
                            link_to_data="".join(
                                random.choices(string.ascii_uppercase + string.digits, k=25)
                            ),
                            raw_data="".join(
                                random.choices(string.ascii_uppercase + string.digits, k=25)
                            ),
                        ),
                    )
                    for event_id, vector in vectors.items()
                    if event_id.dataset_id == dataset_id
                ],
                (DatasetType.PRIMARY, DatasetType.REFERENCE),
            )
        )

        return UMAPPoints(
            data=primary_points,
            reference_data=reference_points,
            clusters=to_gql_clusters(clusters),
        )

    @strawberry.field
    async def drift_metric(
        self, metric: DriftMetric, time_range: TimeRange, info: Info[Context, None]
    ) -> Optional[float]:
        model = info.context.model
        primary_dataset = model.primary_dataset
        reference_dataset = model.reference_dataset
        if reference_dataset is None:
            return None
        embedding_feature_name = self.name
        primary_embeddings_column = primary_dataset.get_embedding_vector_column(
            embedding_feature_name
        )
        reference_embeddings_column = reference_dataset.get_embedding_vector_column(
            embedding_feature_name
        )
        apply_query(
            dataset=reference_dataset,
            embedding_feature_name=self.name,
            start=time_range.start,
            end=time_range.end,
        )
        primary_centroid = np.stack(primary_embeddings_column.to_numpy()).mean(axis=1)  # type: ignore
        reference_centroid = np.stack(reference_embeddings_column.to_numpy()).mean(axis=1)  # type: ignore
        if metric is DriftMetric.euclideanDistance:
            return euclidean_distance(primary_centroid, reference_centroid)
        raise NotImplementedError(f"Metric {metric} has not been implemented.")


def to_gql_embedding_dimension(
    id_attr: int, embedding_dimension: CoreEmbeddingDimension
) -> EmbeddingDimension:
    """
    Converts a phoenix.core.EmbeddingDimension to a phoenix.server.api.types.EmbeddingDimension
    """
    return EmbeddingDimension(
        id_attr=id_attr,
        name=embedding_dimension.name,
    )


# TODO: Expand to retrieve other columns
def retrieve_columns(dataset: Dataset, embedding_feature_names=List[str]) -> None:
    pass


def apply_query(
    dataset: Dataset,
    embedding_feature_name: str,
    start: datetime,
    end: datetime,
) -> DataFrame:
    dataframe = dataset.dataframe
    schema = dataset.schema
    timestamp_col_name = schema.timestamp_column_name
    if timestamp_col_name is None:
        raise ValueError
    column_names = []
    embedding_vector_column = dataset.get_embedding_vector_column(embedding_feature_name)
    query_string = f'"{start}" <= `{timestamp_col_name}` < "{end}"'
    return (
        dataframe[column_names + [timestamp_col_name]]
        .query(query_string)
        .drop(timestamp_col_name, axis=1)
    )


def _round_timestamp_to_next_hour(timestamp: datetime) -> datetime:
    """
    Rounds input datetime to the next whole hour datetime. If the input datetime
    is a whole hour, returns the same datetime.
    """
    return to_datetime(timestamp).ceil("H").to_pydatetime()


def _compute_mean_vector(embeddings: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    return embeddings.mean()


def time_range_query(timestamp_column_name: str, start: datetime, end: datetime) -> str:
    return f'"{start}" <= `{timestamp_col_name}` < "{end}"'
