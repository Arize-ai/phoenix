from typing import List

import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class DeleteExperimentsInput:
    experiment_ids: List[GlobalID]
