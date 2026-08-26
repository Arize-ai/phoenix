from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class CompletenessEvaluator(ClassificationEvaluator):
    """
    An evaluator for whether an assistant addressed every distinct user
    intention in a conversation.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Completeness measures whether each distinct user ask was addressed,
          not whether the requested outcome actually happened. A refusal, a
          missing-evidence answer, or a blocking question to the user still
          addresses the intention.
        - Returns one `Score` with `label` (complete or incomplete), `score`
          (1.0 if complete, 0.0 if incomplete), and an `explanation` from the
          LLM judge that lists each intention.

    Examples:

        from phoenix.evals.metrics.completeness import CompletenessEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        completeness_eval = CompletenessEvaluator(llm=llm)

        eval_input = {
            "conversation": (
                "User: Reset my password and update the billing address.\\n"
                "Assistant: Your password has been reset."
            ),
        }
        scores = completeness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='completeness', score=0.0, label='incomplete',
            explanation='The billing-address request was never addressed.',
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="maximize")]

    """

    NAME = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            message.model_dump()
            for message in COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class CompletenessInputSchema(BaseModel):
        conversation: str = Field(
            description=(
                "The full conversation record to judge for coverage of user intentions, "
                "including turns, tool calls, and tool results."
            ),
        )

    def __init__(self, llm: LLM, **kwargs: Any):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.CompletenessInputSchema,
            **kwargs,
        )
