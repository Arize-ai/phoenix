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

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether a document contains information relevant to
          answering a specific question.
        - Returns one `Score` with `label` (relevant or unrelated), `score` (1.0
          if relevant, 0.0 if unrelated), and an `explanation` from the LLM
          judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.document_relevance import DocumentRelevanceEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        relevance_eval = DocumentRelevanceEvaluator(llm=llm)
        eval_input = {
            "input": "What is the capital of France?",
            "document_text": "Paris is the capital and largest city of France"
            }
        scores = relevance_eval.evaluate(eval_input)
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
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.DocumentRelevanceInputSchema,
        )
