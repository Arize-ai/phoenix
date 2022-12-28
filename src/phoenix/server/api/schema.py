import strawberry

from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Model import Model


def get_primary_dataset() -> Dataset:
    from phoenix.server.app import app

    name = app.state.primary
    return Dataset(name=name)


def get_reference_dataset() -> Dataset:
    from phoenix.server.app import app

    name = app.state.reference
    return Dataset(name=name)


def get_model() -> Model:
    return Model()


@strawberry.type
class Query:
    primaryDataset: Dataset = strawberry.field(resolver=get_primary_dataset)
    referenceDataset: Dataset = strawberry.field(resolver=get_reference_dataset)
    model: Model = strawberry.field(resolver=get_model)


schema = strawberry.Schema(query=Query)
