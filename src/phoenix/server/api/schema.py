import strawberry


@strawberry.type
class Dataset:
    name: str


def get_primary_dataset() -> Dataset:
    return Dataset(name="primary")


def get_reference_dataset() -> Dataset:
    return Dataset(name="reference")


@strawberry.type
class Query:
    primaryDataset: Dataset = strawberry.field(resolver=get_primary_dataset)
    referenceDataset: Dataset = strawberry.field(resolver=get_reference_dataset)


schema = strawberry.Schema(query=Query)
