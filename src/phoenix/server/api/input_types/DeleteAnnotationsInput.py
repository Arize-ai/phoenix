from typing import List

import strawberry
from strawberry.relay import GlobalID


@strawberry.input
class DeleteAnnotationsInput:
    annotation_ids: List[GlobalID]
