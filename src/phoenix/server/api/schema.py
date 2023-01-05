import strawberry
from strawberry.types import Info

from phoenix.server.api.types.context import Context
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Model import Model


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


schema = strawberry.Schema(query=Query)
