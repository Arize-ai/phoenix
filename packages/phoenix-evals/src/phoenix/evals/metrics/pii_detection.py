from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class PiiDetectionEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting personally identifiable information (PII) in a
    conversation record.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Screens the entire conversation record, including system instructions,
          tool calls and their results, and retrieved content the end user may
          never have seen.
        - Returns one `Score` with `label` (pii_detected or no_pii_detected),
          `score` (1.0 if PII was found, 0.0 otherwise), and, when an `LLM` judge is
          used, an `explanation` that lists each instance in a FINDINGS block
          (decision models return a label and probabilities, not an explanation).
        - Direction is ``minimize``: detecting PII is the undesirable outcome.

    Examples::

        from phoenix.evals.metrics.pii_detection import PiiDetectionEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

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
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.98,
                'probabilities': {'pii_detected': 0.99, 'no_pii_detected': 0.01}},
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

    def __init__(self, llm: Union[LLM, DecisionModel], **kwargs: Any):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.PiiDetectionInputSchema,
            **kwargs,
        )
