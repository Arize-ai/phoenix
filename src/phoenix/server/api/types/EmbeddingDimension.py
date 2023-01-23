import strawberry

from phoenix.core import EmbeddingDimension as CoreEmbeddingDimension

from .node import Node


@strawberry.type
class EmbeddingDimension(Node):
    name: str


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
