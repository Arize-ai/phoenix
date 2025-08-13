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
...     "reference": "Paris is the capital and largest city of France."
... }
>>> scores = hallucination_eval(eval_input)
>>> print(scores)
[Score(name='hallucination', score=1.0, label='factual',
explanation='Information is supported by context', metadata={'model': 'mock-model'},
source="llm", direction="maximize")]
"""

from typing import Union

from ..evaluators import ClassificationEvaluator
from ..llm import LLM, AsyncLLM
from ..templating import Template


# --- Built-in LLM evaluator: hallucination ---
class HallucinationEvaluator(ClassificationEvaluator):
    NAME = "hallucination"
    PROMPT = Template(
        template="""
        In this task, you will be presented with a query, a reference text and an answer. The answer
        is generated to the question based on the reference text. The answer may contain false
        information. You must use the reference text to determine if the answer to the question
        contains false information, if the answer is a hallucination of facts. Your objective is to
        determine whether the answer text contains factual information and is not a hallucination. A
        'hallucination' refers to an answer that is not based on the reference text or assumes
        information that is not available in the reference text. Your response should be a single
        word: either 'factual' or 'hallucinated', and it should not include any other text or
        characters. 'hallucinated' indicates that the answer provides factually inaccurate
        information to the query based on the reference text. 'factual' indicates that the answer to
        the question is correct relative to the reference text, and does not contain made up
        information. Please read the query and reference text carefully before determining your
        response.

        [BEGIN DATA]
        ************
        [Query]: {input}
        ************
        [Reference text]: {reference}
        ************
        [Answer]: {output}
        ************
        [END DATA]

        Is the answer above factual or hallucinated based on the query and reference text?
    """
    )
    CHOICES = {"hallucinated": 0.0, "factual": 1.0}

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
        )
