from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class UserFrictionEvaluator(ClassificationEvaluator):
    """Evaluate whether a user message expresses friction with an assistant.

    Args:
        llm: The LLM instance to use for evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client.

    The conversation must contain the history before the target user message.
    The target message is supplied separately as ``user_message`` so the judge
    cannot confuse it with earlier turns.
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
