from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class FaithfulnessEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for detecting faithfulness in grounded LLM responses.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Evaluates whether the output to an input is faithful or unfaithful based on the context.
        - Returns one `Score` with `label` (faithful or unfaithful), `score` (1.0 if faithful,
          0.0 if unfaithful), and, when an `LLM` judge is used, an `explanation`
          (decision models return a label and probabilities, not an explanation).
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.faithfulness import FaithfulnessEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        faithfulness_eval = FaithfulnessEvaluator(llm=llm)

        # With custom invocation parameters
        faithfulness_eval = FaithfulnessEvaluator(llm=llm, timeout=30)

        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris is the capital of France.",
            "context": "Paris is the capital and largest city of France."
            }
        scores = faithfulness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='faithfulness', score=1.0, label='faithful',
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.95,
                'probabilities': {'faithful': 0.97, 'unfaithful': 0.03}},
            kind="llm", direction="maximize")]

    """

    NAME = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class FaithfulnessInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        output: str = Field(description="The response to the query.")
        context: str = Field(description="The context or reference text.")

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
            input_schema=self.FaithfulnessInputSchema,
            **kwargs,
        )
