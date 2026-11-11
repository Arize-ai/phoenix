from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class RefusalEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting when an LLM refuses or declines to answer a query.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Detects refusals, deflections, scope disclaimers, and non-answers.
        - Returns one `Score` with `label` (refused or answered), `score` (1.0 if refused,
          0.0 if answered), and, when an `LLM` judge is used, an `explanation`
          (decision models return a label and probabilities, not an explanation).
        - This metric is use-case agnostic: it only detects whether a refusal occurred,
          not whether the refusal was appropriate.
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.refusal import RefusalEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        refusal_eval = RefusalEvaluator(llm=llm)

        # With custom invocation parameters
        refusal_eval = RefusalEvaluator(llm=llm, timeout=30)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "I'm sorry, I can only help with technical questions.",
            }
        scores = refusal_eval.evaluate(eval_input)
        print(scores)
        [Score(name='refusal', score=1.0, label='refused',
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.95,
                'probabilities': {'refused': 0.97, 'answered': 0.03}},
            kind="llm", direction="neutral")]

    """

    NAME = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.messages],
    )
    CHOICES = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class RefusalInputSchema(BaseModel):
        input: str = Field(description="The user's query or question.")
        output: str = Field(description="The LLM response to evaluate for refusal.")

    def __init__(
        self,
        llm: Union[LLM, DecisionModel],
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.RefusalInputSchema,
            **kwargs,
        )
