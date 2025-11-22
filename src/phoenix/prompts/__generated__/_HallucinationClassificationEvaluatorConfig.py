# This file is generated. Do not edit by hand.

# ruff: noqa: E501

from phoenix.prompts._models import _ClassificationEvaluatorConfig, _PromptMessage

HallucinationClassificationEvaluatorConfig = _ClassificationEvaluatorConfig(
    name="HallucinationClassificationEvaluatorConfig",
    description="Detects hallucinations\n",
    messages=[
        _PromptMessage(
            role="user",
            content="You are comparing a reference text to a question and answer pair to determine if the answer contains hallucinations.\n\nA hallucination occurs when the answer contains information that is not supported by or contradicts the reference text.\n\nReference text: {{reference}}\nQuestion: {{input}}\nAnswer: {{output}}\n",
        )
    ],
    choices={"hallucinated": 1.0, "factual": 0.0},
)
