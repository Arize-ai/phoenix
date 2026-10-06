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
    An evaluator for whether every active user request in a conversation
    was actually completed.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Completeness measures finished work: delivered answers, delivered
          artifacts (including required parts), or actions whose success is
          visible in the record. A refusal, clarifying question, or blocker
          report is not completion. Withdrawn requests are excluded.
        - For agent traces, include tool calls and tool results in
          `conversation` so action success can be verified. If tools are
          omitted, the judge falls back to the visible dialogue.
        - Returns one `Score` with `label` (complete or incomplete), `score`
          (1.0 if complete, 0.0 if incomplete), and an `explanation` from the
          LLM judge that lists each intention.

    Examples::

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
            explanation='The billing-address request was never completed.',
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
                "The full conversation record to judge, including turns, "
                "tool calls, and tool results. Include tools for agent traces "
                "so action success can be verified."
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
