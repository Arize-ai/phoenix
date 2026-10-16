from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class SentimentEvaluator(ClassificationEvaluator):
    """
    An evaluator for classifying the sentiment a user expresses in a message.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Labels the user's own expressed affect, not the assistant's tone and
          not whether the topic is inherently pleasant or unpleasant.
        - The conversation must contain the history before the target user
          message. The target message is supplied separately as
          ``user_message`` so the judge cannot confuse it with earlier turns.
        - Returns one `Score` with `label` (positive, neutral, or negative),
          `score` (1.0 if positive, 0.0 if neutral, -1.0 if negative), and an
          `explanation` from the LLM judge.
        - Sentiment is descriptive, not a quality signal: the score has no
          preferred direction (`direction="neutral"`). A plain question or a
          routine "thanks" is neutral; weak or ambiguous evidence defaults to
          neutral.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.sentiment import SentimentEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        sentiment_eval = SentimentEvaluator(llm=llm)

        # With custom invocation parameters
        sentiment_eval = SentimentEvaluator(llm=llm, temperature=0.0)

        eval_input = {
            "conversation": (
                "User: My order still hasn't arrived.\\n"
                "Assistant: I'm sorry, let me check on that."
            ),
            "user_message": "This is the third time I've had to ask.",
            }
        scores = sentiment_eval.evaluate(eval_input)
        print(scores)
        [Score(name='sentiment', score=-1.0, label='negative',
            explanation='The user expresses frustration at having to repeat the request.',
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="neutral")]

    """

    NAME = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            message.model_dump() for message in SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class SentimentInputSchema(BaseModel):
        conversation: str = Field(description="The conversation before the target user message.")
        user_message: str = Field(description="The latest user message to classify.")

    def __init__(self, llm: LLM, **kwargs: Any):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.SentimentInputSchema,
            **kwargs,
        )
