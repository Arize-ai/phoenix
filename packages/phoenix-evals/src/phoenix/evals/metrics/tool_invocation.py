from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToolInvocationEvaluator(ClassificationEvaluator):
    """
    Determines if a tool was invoked correctly with proper
    arguments, formatting, and safe content.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether an AI agent's tool invocation was correct or incorrect based on
          the conversation context, available tool schemas, and the agent's tool invocation(s).
        - This metric evaluates the correctness of the tool invocation (arguments, formatting,
          safety), not the correctness of the tool selection itself.
        - Returns one `Score` with `label` (correct or incorrect), `score` (1.0 if correct,
          0.0 if incorrect), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Criteria for Correct Invocation:
        - JSON is properly structured (if applicable).
        - All required fields/parameters are present.
        - No hallucinated or nonexistent fields (all fields exist in the tool schema).
        - Argument values match the user query and schema expectations.
        - No unsafe content (e.g., PII) in arguments.

    Criteria for Incorrect Invocation:
        - Hallucinated or nonexistent fields not in the schema.
        - Missing required fields/parameters.
        - Improperly formatted or malformed JSON.
        - Incorrect, hallucinated, or mismatched argument values.
        - Unsafe content (e.g., PII, sensitive data) in arguments.

    Examples::

        from phoenix.evals.metrics.tool_invocation import ToolInvocationEvaluator
        from phoenix.evals import LLM

        llm = LLM(provider="openai", model="gpt-4o-mini")
        tool_invocation_eval = ToolInvocationEvaluator(llm=llm)

        # Example with JSON schema format for available tools
        eval_input = {
            "input": "User: Book a flight from NYC to LA for tomorrow",
            "available_tools": '''
            {
                "name": "book_flight",
                "description": "Book a flight between two cities",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "origin": {"type": "string", "description": "Departure city code"},
                        "destination": {"type": "string", "description": "Arrival city code"},
                        "date": {"type": "string", "description": "Flight date in YYYY-MM-DD"}
                    },
                    "required": ["origin", "destination", "date"]
                }
            }
            ''',
            "tool_selection": '''
            book_flight(origin="NYC", destination="LA", date="2024-01-15")
            '''
        }
        scores = tool_invocation_eval.evaluate(eval_input)
        print(scores)

        # Example with human-readable format for available tools
        eval_input_readable = {
            "input": "User: What's the weather in San Francisco?",
            "available_tools": '''
            WeatherTool:
              Description: Get the current weather for a location
              Parameters:
                - location (required): The city name or coordinates
                - units (optional): Temperature units (celsius or fahrenheit)
            ''',
            "tool_selection": "WeatherTool(location='San Francisco', units='fahrenheit')"
        }
        scores = tool_invocation_eval.evaluate(eval_input_readable)
        print(scores)
    """

    NAME = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class ToolInvocationInputSchema(BaseModel):
        input: str = Field(description="The input query or conversation context.")
        available_tools: str = Field(
            description="The available tool schemas, either as JSON schema or human-readable \
            format."
        )
        tool_selection: str = Field(
            description="The tool invocation(s) made by the LLM, including arguments."
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
            input_schema=self.ToolInvocationInputSchema,
        )
