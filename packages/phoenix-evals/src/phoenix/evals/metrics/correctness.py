from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class CorrectnessEvaluator(ClassificationEvaluator):
    """
    An evaluator for assessing factual accuracy and completeness of model outputs.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Evaluates whether the output to an input is correct or incorrect.
        - Returns one `Score` with `label` (correct or incorrect), `score` (1.0 if correct,
          0.0 if incorrect), and, when an `LLM` judge is used, an `explanation`
          (decision models return a label and probabilities, not an explanation).
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.correctness import CorrectnessEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        correctness_eval = CorrectnessEvaluator(llm=llm)

        # With custom invocation parameters
        correctness_eval = CorrectnessEvaluator(llm=llm, timeout=30)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris is the capital of France.",
            }
        scores = correctness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='correctness', score=1.0, label='correct',
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.98,
                'probabilities': {'correct': 0.99, 'incorrect': 0.01}},
            kind="llm", direction="maximize")]

    """

    NAME = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.messages],
    )
    CHOICES = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class CorrectnessInputSchema(BaseModel):
        input: str = Field(description="The input query or question.")
        output: str = Field(description="The response to evaluate for correctness.")

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
            input_schema=self.CorrectnessInputSchema,
            **kwargs,
        )
