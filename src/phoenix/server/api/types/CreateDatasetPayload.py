import strawberry

from phoenix.server.api.types.Dataset import Dataset


@strawberry.type
class CreateDatasetPayload:
    dataset: Dataset
