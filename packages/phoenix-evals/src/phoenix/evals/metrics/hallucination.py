"""
Deprecated: This evaluator is maintained for backwards compatibility.

Please use FaithfulnessEvaluator instead, which uses updated terminology:
- 'faithful'/'unfaithful' labels instead of 'factual'/'hallucinated'
- Maximizes score (1.0=faithful) instead of minimizing it
"""

import warnings
from typing import Any, Optional

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
        prompt_template (optional): Custom prompt template to override the built-in prompt.
            When provided, ``input_schema`` is not applied — template variables are inferred
            automatically from the template. Accepts the same formats as
            :class:`ClassificationEvaluator` (string, message list, or
            :class:`~phoenix.evals.llm.prompts.PromptTemplate`).
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Evaluates whether the output to an input is factual or hallucinated based on the context.
        - Returns one `Score` with `label` (factual or hallucinated), `score` (1.0 if hallucinated,
          0.0 if factual), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.hallucination import HallucinationEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        hallucination_eval = HallucinationEvaluator(llm=llm)

        # With custom invocation parameters
        hallucination_eval = HallucinationEvaluator(llm=llm, temperature=0.0)

        # With a custom prompt template (input_schema is inferred from template variables)
        custom_template = (
            "Is this hallucinated?\\nQuestion: {input}\\nAnswer: {output}\\nContext: {context}"
        )
        hallucination_eval = HallucinationEvaluator(llm=llm, prompt_template=custom_template)

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
        prompt_template: Optional[Any] = None,
        **kwargs: Any,
    ):
        warnings.warn(
            "HallucinationEvaluator is deprecated and will be removed in a future version. "
            "Please use FaithfulnessEvaluator instead. The new evaluator uses "
            "'faithful'/'unfaithful' labels and maximizes score (1.0=faithful) instead of "
            "minimizing it (0.0=factual).",
            DeprecationWarning,
            stacklevel=2,
        )
        if prompt_template is None:
            super().__init__(
                name=self.NAME,
                llm=llm,
                prompt_template=self.PROMPT.template,
                choices=self.CHOICES,
                direction=self.DIRECTION,
                input_schema=self.HallucinationInputSchema,
                **kwargs,
            )
        else:
            super().__init__(
                name=self.NAME,
                llm=llm,
                prompt_template=prompt_template,
                choices=self.CHOICES,
                direction=self.DIRECTION,
                **kwargs,
            )
