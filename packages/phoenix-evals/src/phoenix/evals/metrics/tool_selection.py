from typing import Any, Union

from pydantic import BaseModel, Field

from ..__generated__.classification_evaluator_configs import (
    TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG,
)
from ..decision import DecisionModel
from ..evaluators import ClassificationEvaluator
from ..llm import LLM
from ..llm.prompts import PromptTemplate


class ToolSelectionEvaluator(ClassificationEvaluator):
    """
    A specialized evaluator for determining if the correct tool was selected for a given context.

    Args:
        llm (Union[LLM, DecisionModel]): The LLM or decision model to use for the evaluation.
        **kwargs: Additional invocation parameters forwarded to the judge. What is accepted
            depends on the judge: an ``LLM`` accepts generation parameters (e.g.
            ``temperature``, ``max_tokens``); a decision model accepts request options (e.g.
            ``timeout``).

    Notes:
        - Evaluates whether an AI agent's tool selection was correct or incorrect based on
          the conversation context, available tools, and the agent's tool invocations.
        - The agent's tool selection can be a single tool or a list of tools.
        - This metric evaluates the correctness of the tool selection, not the correctness of the
          tool invocations or the tool outputs.
        - Returns one `Score` with `label` (correct or incorrect), `score` (1.0 if correct,
          0.0 if incorrect), and, when an `LLM` judge is used, an `explanation`
          (decision models return a label and probabilities, not an explanation).
        - When backed by an `LLM`, requires one that supports tool calling or structured
          output; decision models answer through a typed choices API, so this does not apply.

    Examples::

        from phoenix.evals.metrics.tool_selection import ToolSelectionEvaluator
        from phoenix.evals import DecisionModel
        llm = DecisionModel(provider="openai", model="gpt-6-luna")

        # Default usage
        tool_selection_eval = ToolSelectionEvaluator(llm=llm)

        # With custom invocation parameters
        tool_selection_eval = ToolSelectionEvaluator(llm=llm, timeout=30)

        eval_input = {
            "input": "User: What is the weather in San Francisco?",
            "available_tools": (
                "WeatherTool: Get the current weather for a location.\\n"
                "NewsTool: Stay connected to global events with our up-to-date news.\\n"
                "MusicTool: Create playlists, search for music, and check music trends."
            ),
            "tool_selection": "WeatherTool(location='San Francisco')" # input args optional
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
        llm: Union[LLM, DecisionModel],
        **kwargs: Any,
    ):
        super().__init__(
            name=self.NAME,
            llm=llm,
            prompt_template=self.PROMPT.template,
            choices=self.CHOICES,
            direction=self.DIRECTION,
            input_schema=self.ToolSelectionInputSchema,
            **kwargs,
        )
