from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToolSelectionEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for determining if the correct tool was selected for a given context.

    Args:
        llm (LLM): The LLM instance to use for the evaluation.

    Notes:
        - Evaluates whether an AI agent's tool selection was correct or incorrect based on
          the conversation context, available tools, and the agent's tool invocations.
        - The agent's tool selection can be a single tool or a list of tools.
        - This metric evaluates the correctness of the tool selection, not the correctness of the
          tool invocations or the tool outputs.
        - Returns one `Score` with `label` (correct or incorrect), `score` (1.0 if correct,
          0.0 if incorrect), and an `explanation` from the LLM judge.
        - Requires an LLM that supports tool calling or structured output.

    Examples::

        from phoenix.evals.metrics.tool_selection import ToolSelectionEvaluator
        from phoenix.evals import LLM
        llm = LLM(provider="openai", model="gpt-4o-mini")
        tool_selection_eval = ToolSelectionEvaluator(llm=llm)
        eval_input = {
            "input": "User: What is the weather in San Francisco?",
            "available_tools": "WeatherTool: Get the current weather for a location.\n
            NewsTool: Stay connected to global events with our up-to-date news around the world.\n
            MusicTool: Create playlists, search for music, and check the latest music trends.",
            "agent_tool_selection": "WeatherTool(location='San Francisco')" # input args optional
        }
        scores = tool_selection_eval.evaluate(eval_input)
        print(scores)
    """

    NAME = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.name
    PROMPT = PromptTemplate(
        template=[
            msg.model_dump() for msg in TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.messages
        ],
    )
    CHOICES = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.choices
    DIRECTION = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.optimization_direction

    class ToolSelectionInputSchema(BaseModel):
        input: str = Field(description="The input query or conversation.")
        available_tools: str = Field(
            description="A list of available tools that the LLM could use."
        )
        tool_selection: str = Field(description="The tool or tools selected by the LLM.")

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
            input_schema=self.ToolSelectionInputSchema,
        )
