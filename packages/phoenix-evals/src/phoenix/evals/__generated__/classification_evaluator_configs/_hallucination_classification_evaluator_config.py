# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="hallucination",
    description="Detect whether an assistant response contains hallucinations — claims not supported by the conversation.",
    optimization_direction="minimize",
    messages=[
        PromptMessage(
            role="user",
            content='You are an expert evaluator labeling whether an AI assistant\'s response contains hallucinations. A hallucination is any claim in the response that is not supported by, or that contradicts, the information available in the conversation.\n\nThe conversation contains what the assistant had access to when responding: earlier user and assistant turns, tool calls, tool results, and any retrieved context. Treat it as the source of truth. It may contain markers such as "[... N earlier messages omitted ...]" or "...[truncated]..." indicating that content was elided to fit a length limit. Do not treat elided content as missing or as evidence of fabrication; judge only the claims you can actually check against the visible conversation.\n\n<rubric>\n\nHALLUCINATED - The response does any of the following:\n\n- States facts that contradict the conversation\n- Asserts specific details (names, numbers, dates, quotes, entities, tool results, or events) that are not present in and cannot be reasonably derived from the conversation\n- Attributes claims, sources, or actions to the conversation that never appear in it\n\nFACTUAL - The response:\n\n- Makes only claims that are supported by, consistent with, or reasonably inferable from the conversation\n- Relies on uncontroversial general knowledge that does not conflict with the conversation\n- Declines to answer, expresses uncertainty, or asks a clarifying question without asserting unsupported facts\n\n</rubric>\n\nYou are evaluating ONLY hallucination. Do NOT judge helpfulness, completeness, relevance, tone, or writing style. A response can be unhelpful or off-topic and still be factual, and a fluent, confident-sounding response can still be hallucinated.\n\n<data>\n\n<conversation>\n{{conversation}}\n</conversation>\n\n<input>\n{{input}}\n</input>\n\n<output>\n{{output}}\n</output>\n\n</data>\n\nThe input is the latest user message the response is answering. Carefully compare each factual claim in the output against the conversation and reason about whether it is supported before deciding. When the response asserts specifics that the conversation does not support, label it hallucinated.\n\nIs the response above factual or hallucinated based on the conversation?',
        )
    ],
    choices={"hallucinated": 1.0, "factual": 0.0},
    substitutions=None,
    labels=[],
)
