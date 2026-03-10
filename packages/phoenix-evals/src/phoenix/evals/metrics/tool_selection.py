from typing import Any, Optional

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
        prompt_template (optional): Custom prompt template to override the built-in prompt.
            When provided, ``input_schema`` is not applied — template variables are inferred
            automatically from the template. Accepts the same formats as
            :class:`ClassificationEvaluator` (string, message list, or
            :class:`~phoenix.evals.llm.prompts.PromptTemplate`).
        **kwargs: Additional invocation parameters forwarded to the LLM client
            (e.g., ``temperature=0.0``, ``max_tokens=256``).

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

        # Default usage
        tool_selection_eval = ToolSelectionEvaluator(llm=llm)

        # With custom invocation parameters
        tool_selection_eval = ToolSelectionEvaluator(llm=llm, temperature=0.0)

        # With a custom prompt template (input_schema is inferred from template variables)
        custom_template = (
            "Did the agent pick the right tool?\\nContext: {input}"
            "\\nTools: {available_tools}\\nSelected: {tool_selection}"
        )
        tool_selection_eval = ToolSelectionEvaluator(llm=llm, prompt_template=custom_template)

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
        llm: LLM,
        prompt_template: Optional[Any] = None,
        **kwargs: Any,
    ):
        if prompt_template is None:
            super().__init__(
                name=self.NAME,
                llm=llm,
                prompt_template=self.PROMPT.template,
                choices=self.CHOICES,
                direction=self.DIRECTION,
                input_schema=self.ToolSelectionInputSchema,
                **kwargs,
            )
        else:
            super().__init__(
                name=self.NAME,
                llm=llm,
                prompt_template=prompt_template,
                choices=self.CHOICES,
                direction=self.DIRECTION,
                **kwargs,
            )
