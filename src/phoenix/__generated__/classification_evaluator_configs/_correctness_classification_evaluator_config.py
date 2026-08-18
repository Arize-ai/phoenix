# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import (
    ClassificationEvaluatorConfig,
    EvaluatorCategory,
    EvaluatorInput,
    EvaluatorScope,
    PromptMessage,
)

CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="correctness",
    description="Assess general correctness and completeness of model outputs.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an expert evaluator labeling model outputs for correctness. Your task is to assign a classification based on the following criteria:\n\n<rubric>\n\nCORRECT - The response:\n\n- Provides accurate and complete information with no factual errors\n- Addresses all parts of the question\n- Is logically consistent with no contradictions\n- Uses precise, domain-appropriate terminology\n- Avoids ambiguous or misleading language\n\n\nINCORRECT - The response contains any of:\n\n- Factual errors or inaccuracies\n- Incomplete or partial answers\n- Misleading or ambiguous statements\n- Incorrect terminology\n- Logical inconsistencies\n- Missing key information\n\n</rubric>\n\n<data>\n\n<input>\n{{input}}\n</input>\n\n<output>\n{{output}}\n</output>\n\n</data>\n\nCarefully read the input and output and check for factual accuracy and completeness. Focus on correctness of information rather than verboseness or style.\n\nIs the output correct or incorrect?",
        )
    ],
    choices={"correct": 1.0, "incorrect": 0.0},
    substitutions=None,
    labels=["promoted_dataset_evaluator"],
    scope=EvaluatorScope.SPAN,
    category=EvaluatorCategory.RESPONSE_QUALITY,
    details="A broad, general purpose metric to determine whether an LLM's response is factually accurate, complete, and logically consistent. It evaluates answer quality without requiring external context or reference responses.",
    inputs={
        "input": EvaluatorInput(
            description="The conversational context, whether that is a single input query or a full turn-by-turn conversation."
        ),
        "output": EvaluatorInput(description="The LLM's output response to be evaluated."),
    },
)
