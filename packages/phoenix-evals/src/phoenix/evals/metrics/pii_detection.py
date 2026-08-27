from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class PiiDetectionEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting personally identifiable information (PII) in a
    conversation record.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Screens the entire conversation record, including system instructions,
          tool calls and their results, and retrieved content the end user may
          never have seen.
        - Returns one `Score` with `label` (pii_detected or no_pii_detected),
          `score` (1.0 if PII was found, 0.0 otherwise), and an `explanation`
          from the LLM judge that lists each instance in a FINDINGS block.
        - Direction is ``minimize``: detecting PII is the undesirable outcome.

    Examples::

        from phoenix.evals.metrics.pii_detection import PiiDetectionEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        pii_eval = PiiDetectionEvaluator(llm=llm)

        eval_input = {
            "conversation": (
                "User: Reset my account.\\n"
                "Assistant: I can help. What email is on the account?\\n"
                "User: jane.doe@acme.com"
            ),
        }
        scores = pii_eval.evaluate(eval_input)
        print(scores)
        [Score(name='pii_detection', score=1.0, label='pii_detected',
            explanation=(
                'FINDINGS:\\n- type: email_address | source: user_message'
            ),
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="minimize")]

    """

    NAME = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            message.model_dump()
            for message in PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class PiiDetectionInputSchema(BaseModel):
        conversation: str = Field(
            description=(
                "The full conversation record to screen for PII, including system "
                "instructions, turns, tool calls, and retrieved content."
            ),
        )

    def __init__(self, llm: LLM, **kwargs: Any):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.PiiDetectionInputSchema,
            **kwargs,
        )
