import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class DeleteAnnotationsInput:
    annotation_ids: list[GlobalID]
