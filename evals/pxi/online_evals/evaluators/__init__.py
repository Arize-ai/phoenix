from evals.pxi.online_evals.evaluators.suggestion_accepted import SUGGESTION_ACCEPTED
from evals.pxi.online_evals.evaluators.tool_count_per_turn import TOOL_COUNT_PER_TURN
from evals.pxi.online_evals.evaluators.user_friction import USER_FRICTION

EVALUATORS = {
    SUGGESTION_ACCEPTED.name: SUGGESTION_ACCEPTED,
    TOOL_COUNT_PER_TURN.name: TOOL_COUNT_PER_TURN,
    USER_FRICTION.name: USER_FRICTION,
}

__all__ = ["EVALUATORS", "SUGGESTION_ACCEPTED", "TOOL_COUNT_PER_TURN", "USER_FRICTION"]
