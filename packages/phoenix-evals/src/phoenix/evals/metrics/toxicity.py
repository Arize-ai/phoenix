from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToxicityEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting toxic text — hateful, demeaning, abusive, or threatening.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Classifies a single piece of text (a model output or a user input) as toxic
          or non-toxic.
        - Returns one `Score` with `label` (toxic or non-toxic), `score` (1.0 if toxic,
          0.0 if non-toxic), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.toxicity import ToxicityEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        toxicity_eval = ToxicityEvaluator(llm=llm)

        # With custom invocation parameters
        toxicity_eval = ToxicityEvaluator(llm=llm, temperature=0.0)

        eval_input = {"text": "You are a worthless idiot and everyone despises you."}
        scores = toxicity_eval.evaluate(eval_input)
        print(scores)
        [Score(name='toxicity', score=1.0, label='toxic',
            explanation='The text directs abusive, demeaning language at a person.',
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="minimize")]

    """

    NAME = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.messages],
    )
    CHOICES = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class ToxicityInputSchema(BaseModel):
        text: str = Field(description="The text to evaluate for toxicity.")

    def __init__(
        self,
        llm: LLM,
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.ToxicityInputSchema,
            **kwargs,
        )
