import strawberry

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension
from phoenix.server.api.input_types.TimeRange import TimeRange

from .node import Node
from .UMAPPoints import UMAPPoints


@strawberry.type
class EmbeddingDimension(Node):
    name: str

    @strawberry.field
    def UMAPPoints(self, time_range: TimeRange) -> UMAPPoints:
        # UMAP code goes here
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
