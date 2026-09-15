"""Count rows for exact score values and evaluator labels."""

from typing import Optional

import strawberry


@strawberry.type
class EvaluatorScoreValueCount:
    score: float
    count: int = 0


@strawberry.type
class EvaluatorLabelCount:
    label: str
    score: Optional[float] = None
    is_other: bool = False
    count: int = 0
