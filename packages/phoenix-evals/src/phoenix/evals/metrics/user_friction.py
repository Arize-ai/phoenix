from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class UserFrictionEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting when a user expresses friction with an
    assistant's preceding behavior.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Detects expressed corrections, retries, frustration, and challenges
          directed at the assistant's preceding behavior.
        - The conversation must contain the history before the target user
          message. The target message is supplied separately as
          ``user_message`` so the judge cannot confuse it with earlier turns.
        - Returns one `Score` with `label` (friction or no_friction), `score`
          (1.0 if friction, 0.0 if no_friction), and, when an `LLM` judge is used,
          an `explanation` (decision models return a label and probabilities, not an
          explanation).
        - `no_friction` does not prove the user was satisfied; users often
          abandon conversations without saying why.
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.user_friction import UserFrictionEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        user_friction_eval = UserFrictionEvaluator(llm=llm)

        # With custom invocation parameters
        user_friction_eval = UserFrictionEvaluator(llm=llm, timeout=30)

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
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.91,
                'probabilities': {'friction': 0.94, 'no_friction': 0.06}},
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

    def __init__(self, llm: Union[LLM, DecisionModel], **kwargs: Any):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.UserFrictionInputSchema,
            **kwargs,
        )
