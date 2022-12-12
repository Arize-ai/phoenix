import strawberry


@strawberry.type
class Dataset:
    name: str


def get_primary_dataset() -> Dataset:
    from phoenix.server.app import app

    name = app.state.primary
    return Dataset(name=name)


def get_reference_dataset() -> Dataset:
    from phoenix.server.app import app

    name = app.state.primary
    return Dataset(name=name)


@strawberry.type
class Query:
    primaryDataset: Dataset = strawberry.field(resolver=get_primary_dataset)
    referenceDataset: Dataset = strawberry.field(resolver=get_reference_dataset)


schema = strawberry.Schema(query=Query)
