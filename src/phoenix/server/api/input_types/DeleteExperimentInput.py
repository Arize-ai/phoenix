import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class DeleteExperimentInput:
    experiment_id: GlobalID
