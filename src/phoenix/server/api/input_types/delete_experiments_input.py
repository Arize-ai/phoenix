import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class DeleteExperimentsInput:
    experiment_ids: list[GlobalID]
