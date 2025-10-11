from pydantic import BaseModel, Field

from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..templating import Template

_DEFAULT_HALLUCINATION_TEMPLATE = """\
In this task, you will be presented with a query, some context and a response. The response
is generated to the question based on the context. The response may contain false
information. You must use the context to determine if the response to the question
contains false information, if the response is a hallucination of facts. Your objective is
to determine whether the response text contains factual information and is not a
hallucination. A 'hallucination' refers to a response that is not based on the context or
assumes information that is not available in the context. Your response should be a single
word: either 'factual' or 'hallucinated', and it should not include any other text or
characters. 'hallucinated' indicates that the response provides factually inaccurate
information to the query based on the context. 'factual' indicates that the response to
the question is correct relative to the context, and does not contain made up
information. Please read the query and context carefully before determining your
response.

[BEGIN DATA]
************
[Query]: {input}
************
[Context]: {context}
************
[Response]: {output}
************
[END DATA]

Is the response above factual or hallucinated based on the query and context?
"""


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
            source="llm", direction="maximize")]

    """

    NAME = "hallucination"
    PROMPT = Template(template=_DEFAULT_HALLUCINATION_TEMPLATE)
    CHOICES = {"hallucinated": 0.0, "factual": 1.0}

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
