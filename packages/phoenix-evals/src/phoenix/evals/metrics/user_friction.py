from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class UserFrictionEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting when a user expresses friction with an
    assistant's preceding behavior.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Detects expressed corrections, retries, frustration, and challenges
          directed at the assistant's preceding behavior.
        - The conversation must contain the history before the target user
          message. The target message is supplied separately as
          ``user_message`` so the judge cannot confuse it with earlier turns.
        - Returns one `Score` with `label` (friction or no_friction), `score`
          (1.0 if friction, 0.0 if no_friction), and an `explanation` from the
          LLM judge.
        - `no_friction` does not prove the user was satisfied; users often
          abandon conversations without saying why.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.user_friction import UserFrictionEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        user_friction_eval = UserFrictionEvaluator(llm=llm)

        # With custom invocation parameters
        user_friction_eval = UserFrictionEvaluator(llm=llm, temperature=0.0)

        eval_input = {
            "conversation": (
                "User: Show orders from this week.\\n"
                "Assistant: Here are last month's orders."
            ),
            "user_message": "No, I asked for this week.",
            }
        scores = user_friction_eval.evaluate(eval_input)
        print(scores)
        [Score(name='user_friction', score=1.0, label='friction',
            explanation='The user corrects the assistant for answering the wrong time range.',
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="minimize")]

    """

    NAME = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            message.model_dump()
            for message in USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class UserFrictionInputSchema(BaseModel):
        conversation: str = Field(description="The conversation before the target user message.")
        user_message: str = Field(description="The latest user message to classify.")

    def __init__(self, llm: LLM, **kwargs: Any):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.UserFrictionInputSchema,
            **kwargs,
        )
