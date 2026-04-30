# This file is generated. Do not edit by hand.

from ._models import PairwiseEvaluatorConfig, PromptMessage

PAIRWISE_QUALITY_EVALUATOR_CONFIG = PairwiseEvaluatorConfig(
    name="pairwise_quality",
    description="Compare two responses and choose the one with better overall quality.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="""You are comparing two assistant responses for overall quality.

Evaluate the responses using the following criteria:
- correctness and factual accuracy
- completeness and relevance to the user input
- clarity, helpfulness, and appropriate level of detail
- safety and instruction following

User input:
{{input}}

Response A:
{{item_1}}

Response B:
{{item_2}}

Choose the response with better overall quality. If both responses are similarly good or similarly flawed, choose tie.""",
        )
    ],
)
