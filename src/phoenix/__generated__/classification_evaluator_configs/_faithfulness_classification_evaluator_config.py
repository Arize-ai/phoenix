# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="faithfulness",
    description="A specialized evaluator for detecting faithfulness in grounded LLM responses.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="In this task, you will be presented with a query, some context and a response. The response\nis generated to the question based on the context. The response may contain false\ninformation. You must use the context to determine if the response to the question\ncontains false information, if the response is unfaithful to the facts. Your objective is\nto determine whether the response text contains factual information and is faithful to\nthe context. An 'unfaithful' response refers to a response that is not based on the context or\nassumes information that is not available in the context. Your response should be a single\nword: either 'faithful' or 'unfaithful', and it should not include any other text or\ncharacters. 'unfaithful' indicates that the response provides factually inaccurate\ninformation to the query based on the context. 'faithful' indicates that the response to\nthe question is correct relative to the context, and does not contain made up\ninformation. Please read the query and context carefully before determining your\nresponse.\n\n<data>\n\n<query>\n{{input}}\n</query>\n\n<context>\n{{context}}\n</context>\n\n<response>\n{{output}}\n</response>\n\n</data>\n\nIs the response above faithful or unfaithful based on the query and context?",
        )
    ],
    choices={"faithful": 1.0, "unfaithful": 0.0},
    formatters=None,
)
