from phoenix.db import models

DEFAULT_SESSION_EVALUATION_DELAY_SECONDS = 300
MINIMUM_EVALUATION_DELAY_SECONDS = 10


def effective_session_evaluation_delay_seconds(
    criteria: models.ProjectEvaluatorCriteria,
) -> int:
    delay = criteria.evaluation_delay_seconds
    return DEFAULT_SESSION_EVALUATION_DELAY_SECONDS if delay is None else delay
