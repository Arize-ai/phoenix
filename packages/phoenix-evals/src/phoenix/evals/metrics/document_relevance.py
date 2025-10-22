from pydantic import BaseModel, Field

from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..templating import Template

_DEFAULT_DOCUMENT_RELEVANCY_TEMPLATE = """\
You are comparing a document text to a question and trying to determine
if the document text contains information relevant to answering the
question. Here is the data:

[BEGIN DATA]
************
[Question]: {input}
************
[Document text]: {document}
************
[END DATA]

Compare the question above to the document text. You must determine
whether the document text contains information that can answer the
question. Please focus on whether the very specific question can be
answered by the information in the document text. Your response must be
either "relevant" or "unrelated". "unrelated" means that the document
text does not contain an answer to the question. "relevant" means the
document text contains an answer to the question.
"""


class DocumentRelevanceEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for determining document relevance to a given
    question.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether a document contains information relevant to
          answering a specific question.
        - Returns one `Score` with `label` (relevant or unrelated), `score` (1.0
          if relevant, 0.0 if unrelated), and an `explanation` from the LLM
          judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.document_relevance import DocumentRelevanceEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        relevance_eval = DocumentRelevanceEvaluator(llm=llm)
        eval_input = {
            "input": "What is the capital of France?",
            "document": "Paris is the capital and largest city of France"
            }
        scores = relevance_eval.evaluate(eval_input)
        print(scores)
    """

    NAME = "document_relevance"
    PROMPT = Template(template=_DEFAULT_DOCUMENT_RELEVANCY_TEMPLATE)
    CHOICES = {"unrelated": 0.0, "relevant": 1.0}

    class DocumentRelevanceInputSchema(BaseModel):
        input: str = Field(description="The input query.")
        document: str = Field(description="The document being evaluated for relevance.")

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
            input_schema=self.DocumentRelevanceInputSchema,
        )
