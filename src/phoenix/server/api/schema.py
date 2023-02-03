import strawberry
from strawberry.types import Info

from .context import Context
from .types.Dataset import Dataset, to_gql_dataset
from .types.Dimension import to_gql_dimension
from .types.EmbeddingDimension import to_gql_embedding_dimension
from .types.Model import Model
from .types.node import GlobalID, Node, from_global_id


@strawberry.type
class Query:
    @strawberry.field
    def primary_dataset(self, info: Info[Context, None]) -> Dataset:
        return to_gql_dataset(info.context.model.primary_dataset)

    @strawberry.field
    def reference_dataset(self, info: Info[Context, None]) -> Dataset:
        return to_gql_dataset(info.context.model.reference_dataset)

    @strawberry.field
    def model(self) -> Model:
        return Model()

    @strawberry.field
    def node(self, id: GlobalID, info: Info[Context, None]) -> Node:
        type_name, node_id = from_global_id(str(id))
        print(f"node: {type_name} {node_id}")
        if type_name == "Dimension":
            dimension = info.context.model.dimensions[node_id]
            return to_gql_dimension(node_id, dimension)
        elif type_name == "EmbeddingDimension":
            embedding_dimension = info.context.model.embedding_dimensions[node_id]
            return to_gql_embedding_dimension(node_id, embedding_dimension)

        raise Exception(f"Unknown node type: {type}")


schema = strawberry.Schema(query=Query)
