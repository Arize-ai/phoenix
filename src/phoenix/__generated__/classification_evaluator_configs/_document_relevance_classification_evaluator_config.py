# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="document_relevance",
    description="For determining if a document is relevant to a given question.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content='You are comparing a document to a question and trying to determine\nif the document text contains information relevant to answering the\nquestion. Here is the data:\n\n<data>\n\n<question>\n{{input}}\n</question>\n\n<document_text>\n{{document_text}}\n</document_text>\n\n</data>\n\nCompare the question above to the document text. You must determine\nwhether the document text contains information that can answer the\nquestion. Please focus on whether the very specific question can be\nanswered by the information in the document text. Your response must be\neither "relevant" or "unrelated". "unrelated" means that the document\ntext does not contain an answer to the question. "relevant" means the\ndocument text contains an answer to the question.',
        )
    ],
    choices={"relevant": 1.0, "unrelated": 0.0},
    substitutions=None,
    labels=[],
)
