"""
Deprecated: This evaluator is maintained for backwards compatibility.

Please use FaithfulnessEvaluator instead, which uses updated terminology:
- 'faithful'/'unfaithful' labels instead of 'factual'/'hallucinated'
- Maximizes score (1.0=faithful) instead of minimizing it
"""

import warnings

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class HallucinationEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for detecting hallucinations in grounded LLM responses.

    .. deprecated::
        HallucinationEvaluator is deprecated. Please use FaithfulnessEvaluator instead.
        The new evaluator uses 'faithful'/'unfaithful' labels and maximizes score (1.0=faithful).

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether the output to an input is factual or hallucinated based on the context.
        - Returns one `Score` with `label` (factual or hallucinated), `score` (1.0 if hallucinated,
          0.0 if factual), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.hallucination import HallucinationEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        hallucination_eval = HallucinationEvaluator(llm=llm)
        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris is the capital of France.",
            "context": "Paris is the capital and largest city of France."
            }
        scores = hallucination_eval.evaluate(eval_input)
        print(scores)
        [Score(name='hallucination', score=0.0, label='factual',
            explanation='Information is supported by context', metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="minimize")]

    """

    NAME = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class HallucinationInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        output: str = Field(description="The response to the query.")
        context: str = Field(description="The context or reference text.")

    def __init__(
        self,
        llm: LLM,
    ):
        warnings.warn(
            "HallucinationEvaluator is deprecated and will be removed in a future version. "
            "Please use FaithfulnessEvaluator instead. The new evaluator uses "
            "'faithful'/'unfaithful' labels and maximizes score (1.0=faithful) instead of "
            "minimizing it (0.0=factual).",
            DeprecationWarning,
            stacklevel=2,
        )
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.HallucinationInputSchema,
        )
