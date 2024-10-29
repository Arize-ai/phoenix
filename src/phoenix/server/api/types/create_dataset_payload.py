import strawberry

from .dataset import Dataset


@strawberry.type
class CreateDatasetPayload:
    dataset: Dataset
