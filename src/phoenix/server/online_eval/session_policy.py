from typing import TYPE_CHECKING

from sqlalchemy import and_
from sqlalchemy.sql.elements import ColumnElement

if TYPE_CHECKING:
    from phoenix.db import models

DEFAULT_SESSION_EVALUATION_DELAY_SECONDS = 300
MINIMUM_EVALUATION_DELAY_SECONDS = 10


def session_criteria_is_schedulable(
    criteria: type["models.ProjectEvaluatorCriteria"],
) -> ColumnElement[bool]:
    # Session filters shipped in #14101 (#14041); #14038 owns sampling integration.
    return and_(
        criteria.enabled,
        criteria.evaluation_target == "SESSION",
        criteria.filter_condition == "",
        criteria.sampling_rate == 1.0,
    )
