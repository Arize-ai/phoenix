from enum import auto, unique

from phoenix.core.dimension_role import DimensionRole
from phoenix.core.invalid_role import InvalidRole


@unique
class SingularDimensionalRole(DimensionRole):
    """Roles that cannot be assigned to more than one dimension."""

    # The (integer) ordering here is important in that it'll be used
    # as tie-breaker when e.g. the user assigns a column to both prediction
    # label and predicton score, in which case the role with a lower
    # integer value will prevail.
    PREDICTION_ID = 1 + max(InvalidRole)
    TIMESTAMP = auto()
    PREDICTION_LABEL = auto()
    PREDICTION_SCORE = auto()
    ACTUAL_LABEL = auto()
    ACTUAL_SCORE = auto()
    # Large Language Model (LLM) prompt and response pairs
    PROMPT = auto()
    RESPONSE = auto()


PREDICTION_ID = SingularDimensionalRole.PREDICTION_ID
TIMESTAMP = SingularDimensionalRole.TIMESTAMP
PREDICTION_LABEL = SingularDimensionalRole.PREDICTION_LABEL
PREDICTION_SCORE = SingularDimensionalRole.PREDICTION_SCORE
ACTUAL_LABEL = SingularDimensionalRole.ACTUAL_LABEL
ACTUAL_SCORE = SingularDimensionalRole.ACTUAL_SCORE
PROMPT = SingularDimensionalRole.PROMPT
RESPONSE = SingularDimensionalRole.RESPONSE
