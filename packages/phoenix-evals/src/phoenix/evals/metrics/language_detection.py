from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class LanguageDetectionEvaluator(ClassificationEvaluator):
    """
    An evaluator that detects the primary natural language of a given source text.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Classifies the language that carries the majority of substantive content.
        - Labels are ``english``, ``mandarin_chinese``, ``hindi``, ``spanish``,
          ``french``, or ``other``.
        - Every label scores ``1.0``. The result is the label; no language is better
          than another.
        - This metric is descriptive: it does not judge whether the language used
          was correct or expected.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.language_detection import LanguageDetectionEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        language_eval = LanguageDetectionEvaluator(llm=llm)

        eval_input = {
            "session": (
                "User: My deploy keeps failing with an out-of-memory error.\\n"
                "Assistant: Lower the build parallelism or raise the memory limit."
            ),
        }
        scores = language_eval.evaluate(eval_input)
        print(scores)
        [Score(name='language_detection', score=1.0, label='english',
            explanation='Both turns are substantive English.',
            metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="neutral")]

    """

    NAME = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class LanguageDetectionInputSchema(BaseModel):
        session: str = Field(
            description=(
                "User and assistant turns, in chronological order. Do not include tool results."
            )
        )

    def __init__(
        self,
        llm: LLM,
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.LanguageDetectionInputSchema,
            **kwargs,
        )
