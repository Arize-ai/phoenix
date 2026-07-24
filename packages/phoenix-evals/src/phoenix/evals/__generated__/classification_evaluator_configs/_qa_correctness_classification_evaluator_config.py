# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="qa_correctness",
    description="Determine whether an answer correctly and completely answers a question based on a reference text.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an expert evaluator judging whether an answer correctly and completely answers a question, using the reference text as the source of truth.\n\n<rubric>\n\nCORRECT - The answer:\n\n- Correctly and fully answers the question\n- Is consistent with, and supported by, the reference text\n- Contains no factual errors relative to the reference\n\nINCORRECT - The answer does any of the following:\n\n- Does not answer the question, or answers a different question\n- Answers only partially, or omits key information the question asks for\n- Contradicts the reference text or contains factual errors relative to it\n- Makes claims that the reference text does not support\n\n</rubric>\n\nYou are judging ONLY whether the question is correctly and completely answered based on the reference. Do NOT reward or penalize style, length, or tone, and do not penalize extra information that does not affect correctness. When the reference does not contain enough information to answer the question, an answer that fabricates a response is incorrect, while an answer that correctly states the information is unavailable is correct.\n\n<data>\n\n<question>\n{{input}}\n</question>\n\n<reference>\n{{reference}}\n</reference>\n\n<answer>\n{{output}}\n</answer>\n\n</data>\n\nCarefully compare the answer against the question and the reference before deciding. Is the answer correct or incorrect?",
        )
    ],
    choices={"correct": 1.0, "incorrect": 0.0},
    substitutions=None,
    labels=[],
)
