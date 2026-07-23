from evals.pxi.online_evals.evaluators.tool_count_per_turn import TOOL_COUNT_PER_TURN
from evals.pxi.online_evals.evaluators.user_friction import USER_FRICTION

EVALUATORS = {
    TOOL_COUNT_PER_TURN.name: TOOL_COUNT_PER_TURN,
    USER_FRICTION.name: USER_FRICTION,
}

__all__ = ["EVALUATORS", "TOOL_COUNT_PER_TURN", "USER_FRICTION"]
