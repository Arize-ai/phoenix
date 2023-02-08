from typing import Optional

import numpy as np
import strawberry
from strawberry.types import Info
from typing_extensions import Annotated

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension
from phoenix.metrics.embeddings import euclidean_distance
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.TimeRange import TimeRange

from .DriftMetric import DriftMetric
from .node import Node
from .UMAPPoints import UMAPPoints

# Default UMAP hyperparameters
DEFAULT_N_COMPONENTS = 3
DEFAULT_MIN_DIST = 0
DEFAULT_N_NEIGHBORS = 30


@strawberry.type
class EmbeddingDimension(Node):
    """A embedding dimension of a model. Represents unstructured data"""

    name: str

    @strawberry.field
    def UMAPPoints(
        self,
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
    ) -> UMAPPoints:
        # TODO validate time_range.

        # validate n_components to be 2 or 3
        n_components = DEFAULT_N_COMPONENTS if n_components is None else n_components
        if not 2 <= n_components <= 3:
            raise Exception(f"n_components must be 2 or 3, got {n_components}")

        min_dist = DEFAULT_MIN_DIST if min_dist is None else min_dist
        n_neighbors = DEFAULT_N_NEIGHBORS if n_neighbors is None else n_neighbors

        # TODO UMAP generation code goes here
        return UMAPPoints(data=[], reference_data=[], clusters=[])

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
