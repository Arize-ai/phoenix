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
            content="In this task, you will be presented with a query, some context and a response. The response\nis generated to the question based on the context. The response may contain false\ninformation. You must use the context to determine if the response to the question\ncontains false information, if the response is a hallucination of facts. Your objective is\nto determine whether the response text contains factual information and is not a\nhallucination. A 'hallucination' refers to a response that is not based on the context or\nassumes information that is not available in the context. Your response should be a single\nword: either 'factual' or 'hallucinated', and it should not include any other text or\ncharacters. 'hallucinated' indicates that the response provides factually inaccurate\ninformation to the query based on the context. 'factual' indicates that the response to\nthe question is correct relative to the context, and does not contain made up\ninformation. Please read the query and context carefully before determining your\nresponse.\n\n\n<data>\n\n<query>\n\n{{input}}\n\n</query>\n\n<context>\n\n{{context}}\n\n</context>\n\n<response>\n\n{{output}}\n\n</response>\n\n</data>\n\n\nIs the response above factual or hallucinated based on the query and context?",
        )
    ],
    choices={"hallucinated": 1.0, "factual": 0.0},
)
