from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToxicityEvaluator(ClassificationEvaluator):
    """
    An evaluator for detecting toxic text — hateful, demeaning, abusive, or threatening.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Classifies a single piece of text (a model output or a user input) as toxic
          or non-toxic.
        - Returns one `Score` with `label` (toxic or non-toxic), `score` (1.0 if toxic,
          0.0 if non-toxic), and, when an `LLM` judge is used, an `explanation`
          (decision models return a label and probabilities, not an explanation).
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.toxicity import ToxicityEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        toxicity_eval = ToxicityEvaluator(llm=llm)

        # With custom invocation parameters
        toxicity_eval = ToxicityEvaluator(llm=llm, timeout=30)

        eval_input = {"text": "You are a worthless idiot and everyone despises you."}
        scores = toxicity_eval.evaluate(eval_input)
        print(scores)
        [Score(name='toxicity', score=1.0, label='toxic',
            metadata={'model': 'gpt-6-luna', 'model_id': 'gpt-6-luna', 'confidence': 0.96,
                'probabilities': {'toxic': 0.98, 'non-toxic': 0.02}},
            kind="llm", direction="minimize")]

    """

    NAME = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[msg.model_dump() for msg in TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.messages],
    )
    CHOICES = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class ToxicityInputSchema(BaseModel):
        text: str = Field(description="The text to evaluate for toxicity.")

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
            input_schema=self.ToxicityInputSchema,
            **kwargs,
        )
