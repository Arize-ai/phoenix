# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="retrieval_relevance",
    description="Determine whether the external information retrieved during a step is relevant to the request it was serving, regardless of the source (vector search, tool call, MCP server, or web search).",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an expert evaluator judging whether the external information retrieved during a single step is RELEVANT to the request it was meant to serve.\n\nThe retrieved information may come from any source: a vector-database / semantic search, a tool or function call, an MCP server, a web search, or a database query. Treat them all the same way — you are judging the retrieved information as a whole against the request.\n\n<rubric>\n\nRELEVANT - The retrieved information contains content that materially helps address the request. This includes when it:\n\n- Directly answers the request, or\n- Provides facts, data, or context needed to answer the request, or\n- Is on-topic and useful even if it only partially covers the request, or is mixed with some unrelated material.\n\nIf ANY meaningful part of the retrieved information helps address the request, label it RELEVANT.\n\nIRRELEVANT - The retrieved information does NOT contain content that helps address the request. For example when it:\n\n- Is about a different topic, entity, or time period than the request, or\n- Is only superficially or tangentially related and does not help answer the request, or\n- Is empty, an error, or contains no usable information.\n\n</rubric>\n\nYou are judging ONLY whether the retrieved information is relevant to the request. Do NOT judge whether any final answer is correct, whether an answer is faithful to this information, how complete or well-written it is, or the trustworthiness of the source. Consider only whether the retrieved information bears on the request.\n\n<data>\n\n<request>\n{{input}}\n</request>\n\n<retrieved_information>\n{{retrieved_context}}\n</retrieved_information>\n\n</data>\n\nCarefully reason about whether the retrieved information helps address the request before deciding. Is the retrieved information relevant or irrelevant?",
        )
    ],
    choices={"relevant": 1.0, "irrelevant": 0.0},
    substitutions=None,
    labels=[],
)
