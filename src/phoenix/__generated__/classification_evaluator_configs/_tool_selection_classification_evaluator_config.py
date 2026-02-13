# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="tool_selection",
    description="For determining if the correct tool was selected for a given context.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an impartial judge evaluating an LLM's tool-calling behavior, specifically whether the LLM selected the most appropriate tool or tools for the task.\n\nYour task: Determine whether the LLM's tool selection was correct or incorrect based on:\n- The conversation context (input)\n- The available tools\n- The LLM's output and tool invocation(s)\n\nCriteria\nReturn \"correct\" only when ALL of the following are true:\n- The LLM chose the best available tool for the user query OR correctly avoided tools if none were needed.\n- The tool name exists in the available tools list.\n- The tool is allowed and safe to call.\n- The LLM selected the correct number of tools for the task.\n\nReturn \"incorrect\" if ANY of the following are true:\n- The LLM used a hallucinated or nonexistent tool.\n- The LLM selected a tool when none was needed.\n- The LLM did not use a tool when one was required.\n- The LLM chose a suboptimal or irrelevant tool.\n- The LLM selected an unsafe or not-permitted tool.\n- The tool name does not appear in the available tools list.\n\nBefore providing your final judgment, explain your reasoning and consider:\n- What does the input context require?\n- Can this be answered without tools, or is a tool necessary?\n- If a tool was selected, does it exist in the available tools?\n- Does the selected tool's description match the user's needs?\n- Is the selection safe and appropriate?\n- Is there a better tool available that should have been chosen instead?\n\n<data>\n<input>\n{{input}}\n</input>\n\n<available_tools>\n{{available_tools}}\n</available_tools>\n\n<output>\n{{tool_selection}}\n</output>\n</data>\n\nGiven the above data, is the tool selection correct or incorrect?",
        )
    ],
    choices={"correct": 1.0, "incorrect": 0.0},
    substitutions={
        "available_tools": "available_tools_list",
        "tool_selection": "tool_calls_to_string",
    },
    labels=["promoted_dataset_evaluator"],
)
