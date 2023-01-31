from typing import Annotated, Optional

import strawberry

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension
from phoenix.server.api.input_types.TimeRange import TimeRange

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
                description="The time range of the primary dataset to generate the UMAP points for"
            ),
        ],
        n_components: Annotated[
            Optional[int],
            strawberry.argument(description="UMAP target dimension hyperparameter. Must be 2 or 3"),
        ],
        min_dist: Annotated[
            Optional[int],
            strawberry.argument(description="UMAP minimum distance hyperparameter"),
        ],
        n_neighbors: Annotated[
            Optional[int],
            strawberry.argument(description="UMAP N neighbors hyperparameter"),
        ],
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
