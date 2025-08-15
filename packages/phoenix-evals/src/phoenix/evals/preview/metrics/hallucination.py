# ruff: noqa: W291
"""
Description:
A specialized evaluator for detecting hallucinations in grounded LLM responses.
Uses an LLM with a pre-defined prompt and schema to classify responses as factual or hallucinated.


Usage:

>>> from phoenix.evals.metrics.hallucination import HallucinationEvaluator
>>> from phoenix.evals.llm import LLM
>>> llm = LLM(provider="openai", model="gpt-4o-mini", client="openai")
>>> hallucination_eval = HallucinationEvaluator(llm=llm)
>>> eval_input = {
...     "input": "What is the capital of France?",
...     "output": "Paris is the capital of France.",
...     "context": "Paris is the capital and largest city of France."
... }
>>> scores = hallucination_eval(eval_input)
>>> print(scores)
[Score(name='hallucination', score=1.0, label='factual',
explanation='Information is supported by context', metadata={'model': 'mock-model'},
source="llm", direction="maximize")]
"""

from typing import Union

from pydantic import BaseModel, Field

from ..evaluators import ClassificationEvaluator
from ..llm import LLM, AsyncLLM
from ..templating import Template


# --- Built-in LLM evaluator: hallucination ---
class HallucinationEvaluator(ClassificationEvaluator):
    NAME = "hallucination"
    PROMPT = Template(
        template="""
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
    )
    CHOICES = {"hallucinated": 0.0, "factual": 1.0}

    class HallucinationInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        output: str = Field(description="The response to the query.")
        context: str = Field(description="The context or reference text.")

    def __init__(
        self,
        llm: Union[LLM, AsyncLLM],
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT,
            choices=self.CHOICES,
            direction="maximize",
            input_schema=self.HallucinationInputSchema,
        )
