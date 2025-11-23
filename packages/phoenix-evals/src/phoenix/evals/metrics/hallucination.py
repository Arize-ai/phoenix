from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..templating import Template, TemplateFormat


class HallucinationEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for detecting hallucinations in grounded LLM responses.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether the output to an input is factual or hallucinated based on the context.
        - Returns one `Score` with `label` (factual or hallucinated), `score` (1.0 if factual, 0.0
          if hallucinated), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.hallucination import HallucinationEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        hallucination_eval = HallucinationEvaluator(llm=llm)
        eval_input = {
            "input": "What is the capital of France?",
            "output": "Paris is the capital of France.",
            "context": "Paris is the capital and largest city of France."
            }
        scores = hallucination_eval.evaluate(eval_input)
        print(scores)
        [Score(name='hallucination', score=1.0, label='factual',
            explanation='Information is supported by context', metadata={'model': 'gpt-4o-mini'},
            kind="llm", direction="maximize")]

    """

    NAME = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = Template(
        template=HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.messages[0].content,
        template_format=TemplateFormat.MUSTACHE,
    )
    CHOICES = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.choices

    class HallucinationInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        output: str = Field(description="The response to the query.")
        context: str = Field(description="The context or reference text.")

    def __init__(
        self,
        llm: LLM,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT,
            choices=self.CHOICES,
            direction="maximize",
            input_schema=self.HallucinationInputSchema,
        )
