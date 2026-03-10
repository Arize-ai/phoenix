from typing import Any, Optional

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class CorrectnessEvaluator(ClassificationEvaluator):
    """
    An evaluator for assessing factual accuracy and completeness of model outputs.

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
        - Evaluates whether the output to an input is correct or incorrect.
        - Returns one `Score` with `label` (correct or incorrect), `score` (1.0 if correct,
          0.0 if incorrect), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.correctness import CorrectnessEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        correctness_eval = CorrectnessEvaluator(llm=llm)

        # With custom invocation parameters
        correctness_eval = CorrectnessEvaluator(llm=llm, temperature=0.0)

        # With a custom prompt template (input_schema is inferred from template variables)
        custom_template = "Is this answer correct?\\nQuestion: {input}\\nAnswer: {output}"
        correctness_eval = CorrectnessEvaluator(llm=llm, prompt_template=custom_template)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris is the capital of France.",
            }
        scores = correctness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='correctness', score=1.0, label='correct',
            explanation='The response accurately states that Paris is the capital of France.',
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="maximize")]

    """

    NAME = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.messages],
    )
    CHOICES = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class CorrectnessInputSchema(BaseModel):
        input: str = Field(description="The input query or question.")
        output: str = Field(description="The response to evaluate for correctness.")

    def __init__(
        self,
        llm: LLM,
        prompt_template: Optional[Any] = None,
        **kwargs: Any,
    ):
        if prompt_template is None:
            super().__init__(
                name=self.NAME,
                llm=llm,
                prompt_template=self.PROMPT.template,
                choices=self.CHOICES,
                direction=self.DIRECTION,
                input_schema=self.CorrectnessInputSchema,
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
