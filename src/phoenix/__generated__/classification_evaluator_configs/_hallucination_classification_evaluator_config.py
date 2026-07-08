# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="hallucination",
    description="A specialized evaluator for detecting hallucinations in grounded LLM responses.",
    optimization_direction="minimize",
    messages=[
        PromptMessage(
            role="user",
            content="In this task, you will be presented with a query, some context and a response. The response is generated to the question based on the context. The response may contain false information. You must use the context to determine if the response to the question contains false information, if the response is hallucinated. \n\nYour objective is to determine whether the response text contains factual information and is factual relative to the context. An 'hallucinated' response refers to a response that is not based on the context or assumes information that is not available in the context. \n\nYour response should be a single word: either 'factual' or 'hallucinated', and it should not include any other text or characters. \n\n'hallucinated' indicates that the response provides factually inaccurate information to the query based on the context. \n\n'factual' indicates that the response to the question is correct relative to the context, and does not contain made up information. \n\nPlease read the query and context carefully before determining your response.\n\n<data>\n\n<query>\n{{input}}\n</query>\n\n<context>\n{{context}}\n</context>\n\n<response>\n{{output}}\n</response>\n\n</data>\n\nIs the response above factual or hallucinated based on the query and context?",
        )
    ],
    choices={"hallucinated": 1.0, "factual": 0.0},
    substitutions=None,
    labels=[],
)
