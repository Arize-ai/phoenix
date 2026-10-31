from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET


@strawberry.enum
class ProjectEvaluatorFilterColumn(Enum):
    name = "name"


@strawberry.input(description="A filter for project evaluator connections")
class ProjectEvaluatorFilter:
    col: Optional[ProjectEvaluatorFilterColumn] = None
    value: Optional[str] = None
    annotation_names: Optional[list[str]] = strawberry.field(
        default=UNSET,
        description=(
            "Match evaluators that produce any of these exact annotation names, before pagination. "
            "Single-output evaluators use the project evaluator's name; multiple outputs use "
            "'<evaluator name>.<output name>'. An omitted, null, or empty list does not filter."
        ),
    )
