from typing import Any

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class QACorrectnessEvaluator(ClassificationEvaluator):
    """
    An evaluator for whether an answer correctly answers a question, judged
    against a reference text.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

    Notes:
        - Evaluates whether the response correctly and completely answers the
          question, using the reference text as the source of truth. This is a
          system-level Q&A check, distinct from retrieval relevance.
        - Returns one `Score` with `label` (correct or incorrect), `score`
          (1.0 if correct, 0.0 if incorrect), and an `explanation` from the LLM
          judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.qa_correctness import QACorrectnessEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")

        # Default usage
        qa_correctness_eval = QACorrectnessEvaluator(llm=llm)

        # With custom invocation parameters
        qa_correctness_eval = QACorrectnessEvaluator(llm=llm, temperature=0.0)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "The capital of France is Paris.",
            "reference": "Paris is the capital and largest city of France.",
            }
        scores = qa_correctness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='qa_correctness', score=1.0, label='correct',
            explanation='The answer is supported by the reference.',
            metadata={'model': 'gpt-4o-mini'}, kind="llm", direction="maximize")]

    """

    NAME = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class QACorrectnessInputSchema(BaseModel):
        input: str = Field(description="The question the answer is responding to.")
        output: str = Field(description="The answer to evaluate.")
        reference: str = Field(description="The reference text used as the source of truth.")

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
            input_schema=self.QACorrectnessInputSchema,
            **kwargs,
        )
