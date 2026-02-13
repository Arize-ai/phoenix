# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="conciseness",
    description="Evaluate whether model outputs are concise and free of unnecessary content.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content='You are an expert evaluator assessing the conciseness of model outputs. Your task is to determine whether a response uses the minimum number of words necessary to fully answer the question.\n\n<rubric>\n\nCONCISE - The response:\n\n- Contains only the exact information requested\n- Uses the minimum number of words necessary to convey the complete answer\n- Omits pleasantries, hedging language, and unnecessary context\n- Excludes meta-commentary about the answer or the model\'s capabilities\n- Avoids redundant information or restatements\n- Does not include explanations unless explicitly requested\n\n\nVERBOSE - The response contains any of:\n\n- Unnecessary pleasantries, greetings, or filler phrases (e.g., "Great question!", "Sure!", "I\'d be happy to help")\n- Hedging language or excessive qualifiers (e.g., "It\'s worth noting that...", "It\'s important to understand that...")\n- Meta-commentary about the response itself or the model\'s capabilities\n- Redundant restatements of the same information\n- Unsolicited explanations, context, or caveats beyond what was asked\n- Unnecessary formatting, bullet points, or structure for simple answers\n\n</rubric>\n\n<data>\n\n<input>\n{{input}}\n</input>\n\n<output>\n{{output}}\n</output>\n\n</data>\n\nEvaluate only the conciseness of the response. Do not assess correctness, helpfulness, or quality of information. Focus solely on whether the response uses more words than necessary to answer the question.\n\nIs the output concise or verbose?',
        )
    ],
    choices={"concise": 1.0, "verbose": 0.0},
    substitutions=None,
    labels=[],
)
