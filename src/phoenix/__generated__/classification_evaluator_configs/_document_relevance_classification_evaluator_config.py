# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, EvaluatorSpecification, PromptMessage

DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="document_relevance",
    description="A specialized evaluator for determining document relevance to a given question.",
    optimization_direction="maximize",
    specification=EvaluatorSpecification(
        use_cases=["rag"],
        measures="grounding",
        requires=["input", "context"],
        level=["document"],
        span_kind=None,
    ),
    messages=[
        PromptMessage(
            role="user",
            content='You are comparing a document to a question and trying to determine if the document text contains information relevant to answering the question. Here is the data:\n\n<data>\n<question>\n{{input}}\n</question>\n<document_text>\n{{document_text}}\n</document_text>\n</data>\n\nCompare the question above to the document text. You must determine whether the document text contains information that can answer the question. Please focus on whether the very specific question can be answered by the information in the document text. Your response must be either "relevant" or "unrelated". "unrelated" means that the document text does not contain an answer to the question. "relevant" means the document text contains an answer to the question.',
        )
    ],
    choices={"relevant": 1.0, "unrelated": 0.0},
)
