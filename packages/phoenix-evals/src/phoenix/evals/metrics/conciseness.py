from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ConcisenessEvaluator(ClassificationEvaluator):
    """
    An evaluator for assessing whether model outputs are concise and free of unnecessary content.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether the output to an input is concise or verbose.
        - Returns one `Score` with `label` (concise or verbose), `score` (1.0 if concise,
          0.0 if verbose), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.conciseness import ConcisenessEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        conciseness_eval = ConcisenessEvaluator(llm=llm)
        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris.",
            }
        scores = conciseness_eval.evaluate(eval_input)
        print(scores)
        [Score(name='conciseness', score=1.0, label='concise',
            explanation='The response directly answers the question with no extra words.',
            metadata={'model': 'gpt-4o-mini'},
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
        llm: LLM,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.ConcisenessInputSchema,
        )
