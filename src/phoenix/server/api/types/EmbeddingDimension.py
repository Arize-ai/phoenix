import strawberry

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension

from .node import Node
from .UMAPPoints import UMAPPoints, UMAPPointsData


@strawberry.type
class EmbeddingDimension(Node):
    name: str

    @strawberry.field
    def UMAPPoints(self) -> UMAPPoints:
        # UMAP code goes here
        data = UMAPPointsData(coordinates=[])
        return UMAPPoints(data=data)


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
