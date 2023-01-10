#                    Copyright 2023 Arize AI and contributors.
#                     Licensed under the Elastic License 2.0;
#   you may not use this file except in compliance with the Elastic License 2.0.

import strawberry
from strawberry.types import Info

from .context import Context
from .types.Dataset import Dataset
from .types.Dimension import to_gql_dimension
from .types.Model import Model
from .types.node import GlobalID, Node, from_global_id


@strawberry.type
class Query:
    @strawberry.field
    def primary_dataset(self, info: Info[Context, None]) -> Dataset:
        return Dataset(name=info.context.model.primary_dataset.name)

    @strawberry.field
    def reference_dataset(self, info: Info[Context, None]) -> Dataset:
        return Dataset(name=info.context.model.reference_dataset.name)

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

        raise Exception(f"Unknown node type: {type}")


schema = strawberry.Schema(query=Query)
