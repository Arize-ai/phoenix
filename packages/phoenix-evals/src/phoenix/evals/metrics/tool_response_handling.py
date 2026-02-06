from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToolResponseHandlingEvaluator(ClassificationEvaluator):
    """
    Determines if an AI agent properly handled a tool's response, including
    error handling, data extraction, transformation, and safe information disclosure.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether an AI agent correctly processed the tool result to produce
          an appropriate output.
        - This metric evaluates what happens AFTER the tool returns, NOT whether the
          right tool was selected (tool_selection) or invoked correctly (tool_invocation).
        - Returns one `Score` with `label` (correct or incorrect), `score` (1.0 if correct,
          0.0 if incorrect), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Criteria for Correct Handling:
        - Data is extracted accurately from the tool result (no hallucination).
        - Dates, numbers, and structured fields are properly transformed.
        - Results are accurately summarized to address the user's query.
        - Error responses are handled appropriately (retries, corrections, user notification).
        - No disclosure of sensitive information (credentials, internal URLs, PII).
        - The agent's response actually uses the tool result.

    Criteria for Incorrect Handling:
        - Hallucinated data not present in the tool result.
        - Misinterpretation or misrepresentation of tool data.
        - Improper transformation of dates, numbers, or structured data.
        - Missing retry on retryable errors (rate limits, timeouts).
        - Missing correction after invalid argument errors.
        - Repeated identical calls that continue to fail.
        - Disclosure of sensitive information.
        - Agent's response ignores tool results.

    Examples::

        from phoenix.evals.metrics.tool_response_handling import ToolResponseHandlingEvaluator
        from phoenix.evals import LLM

        llm = LLM(provider="openai", model="gpt-4o-mini")
        tool_response_eval = ToolResponseHandlingEvaluator(llm=llm)

        # Example: Correct extraction from tool result
        eval_input = {
            "input": "What's the weather in Seattle?",
            "tool_call": 'get_weather(location="Seattle")',
            "tool_result": '{"temperature": 58, "conditions": "cloudy"}',
            "output": "Seattle is currently 58°F and cloudy."
        }
        scores = tool_response_eval.evaluate(eval_input)
        print(scores)

        # Example: Hallucinated data (incorrect)
        eval_input_hallucinated = {
            "input": "What restaurants are nearby?",
            "tool_call": 'search_restaurants(location="downtown")',
            "tool_result": '{"results": [{"name": "Cafe Luna", "rating": 4.2}]}',
            "output": "I found Cafe Luna and Mario's Italian nearby."
        }
        scores = tool_response_eval.evaluate(eval_input_hallucinated)
        print(scores)  # Should be incorrect - Mario's Italian was hallucinated

        # Example: Error handling with retry
        eval_input_retry = {
            "input": "Find my recent orders",
            "tool_call": "get_orders(user_id='123')",
            "tool_result": '{"error": "rate_limit_exceeded", "retry_after": 30}',
            "output": "[Retried] Your order (ORD-001) has shipped."
        }
        scores = tool_response_eval.evaluate(eval_input_retry)
        print(scores)
    """

    NAME = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump()
            for msg in TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class ToolResponseHandlingInputSchema(BaseModel):
        input: str = Field(description="The user query or conversation context.")
        tool_call: str = Field(
            description="The tool invocation(s) made by the agent, including arguments."
        )
        tool_result: str = Field(
            description="The tool's response (data, errors, or partial results)."
        )
        output: str = Field(
            description="The agent's handling after receiving the tool result "
            "(may include retries, follow-ups, or final response)."
        )

    def __init__(
        self,
        llm: LLM,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.ToolResponseHandlingInputSchema,
        )
