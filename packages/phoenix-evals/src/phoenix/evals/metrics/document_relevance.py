import warnings
from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class DocumentRelevanceEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for determining document relevance to a given
    question.

    .. deprecated:: 3.7.0
        Use :class:`~phoenix.evals.metrics.RetrievalRelevanceEvaluator` instead.
        Pass one document as ``context`` to preserve per-document evaluation.
        The input field ``document_text`` becomes ``context``, and the negative
        label ``unrelated`` becomes ``irrelevant``. This class will be removed
        in the next major release.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Evaluates whether a document contains information relevant to
          answering a specific question.
        - Returns one `Score` with `label` (relevant or unrelated), `score` (1.0
          if relevant, 0.0 if unrelated), and an `explanation` from the LLM
          judge.
        - Requires an LLM that supports tool calling or structured output.

    Migration example::

        from phoenix.evals import LLM
        from phoenix.evals.metrics import RetrievalRelevanceEvaluator

        llm = LLM(provider="openai", model="gpt-4o-mini")
        relevance_eval = RetrievalRelevanceEvaluator(llm=llm)
        scores = relevance_eval.evaluate({
            "input": "What is the capital of France?",
            "context": "Paris is the capital and largest city of France.",
        })
        print(scores)
    """

    NAME = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class DocumentRelevanceInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        document_text: str = Field(description="The document being evaluated for relevance.")

    def __init__(
        self,
        llm: LLM,
        **kwargs: Any,
    ):
        warnings.warn(
            "DocumentRelevanceEvaluator is deprecated and will be removed in the "
            "next major release. Use RetrievalRelevanceEvaluator instead. "
            "Rename the 'document_text' input field to 'context', and update code that "
            "checks for the 'unrelated' label to check for 'irrelevant'. Pass one "
            "document as 'context' to preserve per-document evaluation.",
            DeprecationWarning,
            stacklevel=2,
        )
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.DocumentRelevanceInputSchema,
            **kwargs,
        )
