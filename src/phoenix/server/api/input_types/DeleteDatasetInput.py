import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class DeleteDatasetInput:
    dataset_id: GlobalID
