from collections import defaultdict
from itertools import chain, repeat, starmap
from typing import List, Mapping, Optional

import numpy as np
import strawberry
from strawberry.scalars import ID
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension
from phoenix.datasets.dataset import DatasetType
from phoenix.datasets.errors import SchemaError
from phoenix.datasets.event import EventId
from phoenix.metrics.embeddings import euclidean_distance
from phoenix.pointcloud.clustering import Hdbscan
from phoenix.pointcloud.pointcloud import PointCloud
from phoenix.pointcloud.projectors import Umap
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TimeRange import TimeRange

from .DriftMetric import DriftMetric
from .EmbeddingMetadata import EmbeddingMetadata
from .node import Node
from .UMAPPoints import (
    Cluster,
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


@strawberry.type
class EmbeddingDimension(Node):
    """A embedding dimension of a model. Represents unstructured data"""

    name: str

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

        datasets = {DatasetType.PRIMARY: primary_dataset, DatasetType.REFERENCE: reference_dataset}

        points = defaultdict(list)

        for event_id, vector in vectors.items():
            row_id, dataset_id = event_id
            dataset = datasets[dataset_id]
            if dataset is None:
                continue

            prediction_label = None
            prediction_score = None
            actual_label = None
            actual_score = None
            link_to_data = None
            raw_data = None

            try:
                prediction_label = dataset.get_prediction_label_column()[row_id]
            except SchemaError:
                pass

            try:
                prediction_score = dataset.get_prediction_score_column()[row_id]
            except SchemaError:
                pass

            try:
                actual_label = dataset.get_actual_label_column()[row_id]
            except SchemaError:
                pass

            try:
                actual_score = dataset.get_actual_score_column()[row_id]
            except SchemaError:
                pass

            try:
                link_to_data = dataset.get_embedding_link_to_data_column(self.name)[row_id]
            except SchemaError:
                pass

            try:
                raw_data = dataset.get_embedding_raw_data_column(self.name)[row_id]
            except SchemaError:
                pass

            points[dataset_id].append(
                UMAPPoint(
                    id=ID(str(event_id)),
                    coordinates=to_gql_coordinates(vector),
                    event_metadata=EventMetadata(
                        prediction_label=prediction_label,
                        prediction_score=prediction_score,
                        actual_label=actual_label,
                        actual_score=actual_score,
                    ),
                    embedding_metadata=EmbeddingMetadata(
                        link_to_data=link_to_data,
                        raw_data=raw_data,
                    ),
                )
            )

        return UMAPPoints(
            data=points[DatasetType.PRIMARY],
            reference_data=points[DatasetType.REFERENCE],
            clusters=to_gql_clusters(clusters),
        )

    @strawberry.field
    async def driftMetric(self, metric: DriftMetric, info: Info[Context, None]) -> Optional[float]:
        model = info.context.model
        primary_dataset = model.primary_dataset
        reference_dataset = model.reference_dataset
        if reference_dataset is None:
            return None
        embedding_feature_name = self.name
        primary_embeddings = primary_dataset.get_embedding_vector_column(embedding_feature_name)
        reference_embeddings = reference_dataset.get_embedding_vector_column(embedding_feature_name)
        if metric is DriftMetric.euclideanDistance:
            return euclidean_distance(
                np.stack(primary_embeddings.to_numpy()),  # type: ignore
                np.stack(reference_embeddings.to_numpy()),  # type: ignore
            )
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
