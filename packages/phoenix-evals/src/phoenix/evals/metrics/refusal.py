from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class RefusalEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting when an LLM refuses or declines to answer a query.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Detects refusals, deflections, scope disclaimers, and non-answers.
        - Returns one `Score` with `label` (refused or answered), `score` (1.0 if refused,
          0.0 if answered), and an `explanation` from the LLM judge.
        - This metric is use-case agnostic: it only detects whether a refusal occurred,
          not whether the refusal was appropriate.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.refusal import RefusalEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        refusal_eval = RefusalEvaluator(llm=llm)
        eval_input = {
            "input": "What is the capital of France?",
            "output": "I'm sorry, I can only help with technical questions.",
            }
        scores = refusal_eval.evaluate(eval_input)
        print(scores)
        [Score(name='refusal', score=1.0, label='refused',
            explanation='The response refuses to answer by claiming scope limitations.',
            metadata={'model': 'gpt-4o-mini'},
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
        llm: LLM,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.RefusalInputSchema,
        )
