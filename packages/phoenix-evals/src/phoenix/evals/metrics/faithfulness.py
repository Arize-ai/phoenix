from typing import Any, Optional

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class FaithfulnessEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for detecting faithfulness in grounded LLM responses.

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
        - Evaluates whether the output to an input is faithful or unfaithful based on the context.
        - Returns one `Score` with `label` (faithful or unfaithful), `score` (1.0 if faithful,
          0.0 if unfaithful), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.faithfulness import FaithfulnessEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        faithfulness_eval = FaithfulnessEvaluator(llm=llm)

        # With custom invocation parameters
        faithfulness_eval = FaithfulnessEvaluator(llm=llm, temperature=0.0)

        # With a custom prompt template (input_schema is inferred from template variables)
        custom_template = (
            "Is this faithful?\\nQuery: {input}\\nResponse: {output}\\nContext: {context}"
        )
        faithfulness_eval = FaithfulnessEvaluator(llm=llm, prompt_template=custom_template)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris is the capital of France.",
            "context": "Paris is the capital and largest city of France."
            }
        scores = faithfulness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='faithfulness', score=1.0, label='faithful',
            explanation='Information is supported by context', metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="maximize")]

    """

    NAME = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class FaithfulnessInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        output: str = Field(description="The response to the query.")
        context: str = Field(description="The context or reference text.")

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
                input_schema=self.FaithfulnessInputSchema,
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
