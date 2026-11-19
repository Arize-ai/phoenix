from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ConcisenessEvaluator(ClassificationEvaluator):
    """
    An evaluator for assessing whether model outputs are concise and free of unnecessary content.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Evaluates whether the output to an input is concise or verbose.
        - Returns one `Score` with `label` (concise or verbose), `score` (1.0 if concise,
          0.0 if verbose), and, when an `LLM` judge is used, an `explanation`
          (decision models return a label and probabilities, not an explanation).
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.conciseness import ConcisenessEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        conciseness_eval = ConcisenessEvaluator(llm=llm)

        # With custom invocation parameters
        conciseness_eval = ConcisenessEvaluator(llm=llm, timeout=30)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris.",
            }
        scores = conciseness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='conciseness', score=1.0, label='concise',
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.97,
                'probabilities': {'concise': 0.98, 'verbose': 0.02}},
            kind="llm", direction="maximize")]

    """

    NAME = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.messages],
    )
    CHOICES = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class ConcisenessInputSchema(BaseModel):
        input: str = Field(description="The input query or question.")
        output: str = Field(description="The response to evaluate for conciseness.")

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
            input_schema=self.ConcisenessInputSchema,
            **kwargs,
        )
