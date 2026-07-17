from typing import TYPE_CHECKING, Optional

from sqlalchemy import and_
from sqlalchemy.sql.elements import ColumnElement

if TYPE_CHECKING:
    from phoenix.db import models

DEFAULT_SESSION_EVALUATION_DELAY_SECONDS = 300
MINIMUM_EVALUATION_DELAY_SECONDS = 10


def effective_session_evaluation_delay_seconds(
    delay_seconds: Optional[int],
) -> int:
    return DEFAULT_SESSION_EVALUATION_DELAY_SECONDS if delay_seconds is None else delay_seconds


def session_criteria_is_schedulable(
    criteria: type["models.ProjectEvaluatorCriteria"],
) -> ColumnElement[bool]:
    return and_(
        criteria.enabled,
        criteria.evaluation_target == "SESSION",
        criteria.filter_condition == "",
        criteria.sampling_rate == 1.0,
    )
