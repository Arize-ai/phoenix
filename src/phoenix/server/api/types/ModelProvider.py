from typing import List

import strawberry


@strawberry.type
class ModelProvider:
    name: str
    model_names: List[str]
