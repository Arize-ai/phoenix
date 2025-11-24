# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="document_relevance",
    description="A specialized evaluator for determining document relevance to a given question.",
    messages=[
        PromptMessage(
            role="user",
            content='You are comparing a document text to a question and trying to determine\nif the document text contains information relevant to answering the\nquestion. Here is the data:\n\n[BEGIN DATA]\n************\n[Question]: {{input}}\n************\n[Document text]: {{document}}\n************\n[END DATA]\n\nCompare the question above to the document text. You must determine\nwhether the document text contains information that can answer the\nquestion. Please focus on whether the very specific question can be\nanswered by the information in the document text. Your response must be\neither "relevant" or "unrelated". "unrelated" means that the document\ntext does not contain an answer to the question. "relevant" means the\ndocument text contains an answer to the question.\n',
        )
    ],
    choices={"unrelated": 0.0, "relevant": 1.0},
)
