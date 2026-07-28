# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="hallucination",
    description="Detect whether an assistant's latest response contains hallucinations — claims not grounded in the conversation (prior turns, tool calls, and tool results).",
    optimization_direction="minimize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an expert evaluator labeling whether an AI assistant's latest response contains hallucinations. A hallucination is any claim in the response that is not grounded in — that is, not supported by, or that contradicts — the conversation.\n\nThe input is the full conversation the assistant had access to when it produced the response: earlier user and assistant turns, tool calls, tool results, and any retrieved context included inline. Treat the conversation as the only source of truth. You are checking whether the response is GROUNDED in that conversation, not whether it is factually true in general.\n\n<rubric>\n\nHALLUCINATED - The response does any of the following:\n\n- States something that contradicts the conversation (a user statement, an earlier turn, or a tool result)\n- Asserts case-specific details about the subject of the conversation — names, numbers, prices, dates, quotes, IDs, entities, or tool results — that are not present in and cannot be reasonably derived from the conversation\n- Fabricates a tool result, claims a tool returned information it did not, or claims an action was taken when no tool call in the conversation shows it\n- Attributes claims, sources, or actions to the conversation that never appear in it\n\nGROUNDED - The response:\n\n- Makes only claims that are supported by, consistent with, or reasonably inferable from the conversation\n- Answers with uncontroversial, widely-known general knowledge (common facts, definitions, arithmetic, units of time or measure) — this is grounded even when the conversation does not contain it, as long as it does not contradict the conversation. Only case-specific claims about the conversation's own subject must come from the conversation.\n- Declines to answer, expresses uncertainty, or asks a clarifying question without asserting unsupported facts\n\n</rubric>\n\nYou are evaluating ONLY grounding. Do NOT judge helpfulness, completeness, relevance, tone, or writing style. A response can be unhelpful or off-topic and still be grounded, and a fluent, confident-sounding response can still be hallucinated.\n\n<data>\n\n<input>\n{{input}}\n</input>\n\n<output>\n{{output}}\n</output>\n\n</data>\n\nThe input is the full conversation, whose last message is the user turn the response is answering; the output is the assistant's latest response. Compare each claim in the output against the conversation and reason about whether it is grounded before deciding.\n\nIs the response grounded or hallucinated based on the conversation?",
        )
    ],
    choices={"hallucinated": 1.0, "grounded": 0.0},
    substitutions={"output": "output_messages_to_conversation"},
    labels=["promoted_dataset_evaluator"],
)
