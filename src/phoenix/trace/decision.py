"""
OpenInference ``DECISION`` span attribute names.

Decision models (TypeSafe System One, OpenAI Decisions) answer typed questions
rather than generating text, so their spans record ``decision.*`` attributes
instead of ``llm.*``. The ``openinference-semconv`` release Phoenix pins
predates these names, so they are spelled out here.

Token counts stay under ``decision.token_count.*`` and are not folded into the
LLM token and cost columns; how to aggregate the two coherently is a separate
piece of work.
"""


class DecisionAttributes:
    SYSTEM = "decision.system"
    PROVIDER = "decision.provider"
    MODEL_NAME = "decision.model_name"
    REQUEST_MODEL_NAME = "decision.request.model_name"
    RESPONSE_MODEL_NAME = "decision.response.model_name"
    TOKEN_COUNT_INPUT = "decision.token_count.input"
    TOKEN_COUNT_OUTPUT = "decision.token_count.output"
