from enum import Enum
from typing import Union

import strawberry


@strawberry.enum
class AnnotationType(Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"


def to_gql_annotation_type(value: Union[str, "AnnotationType"]) -> AnnotationType:
    """Convert a string or db enum value to the GraphQL AnnotationType enum."""
    if isinstance(value, AnnotationType):
        return value
    # Handle both string values and db enum types
    str_value = value.value if hasattr(value, "value") else str(value)
    return AnnotationType(str_value)
