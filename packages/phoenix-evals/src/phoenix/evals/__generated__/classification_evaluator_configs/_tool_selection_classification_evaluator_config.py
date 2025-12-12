# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="tool_selection",
    description="A specialized evaluator for determining if the correct tool was selected for a given context.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an impartial judge evaluating an AI agent’s tool-calling behavior, specifically whether the agent selected the most appropriate tool for the task.\n\nYour task:  Determine whether the agent's tool selection was correct or incorrect based on:\n- The conversation context\n- The available tools\n- The agent's tool invocation(s)\n\n<Data to Evaluate>\n<Context>\n{{input}}\n</Context>\n\n<Available Tools>\n{{available_tools}}\n</Available Tools>\n\n<Agent Response>\n{{agent_tool_invocations}}\n</Agent Response>\n</Data to Evaluate>\n\nCriteria \nReturn \"correct\" only when ALL of the following are true:\n- The agent chose the best available tool for the user query OR correctly avoided tools if none were needed.\n- The tool name exists in the available tools list.\n- The tool is allowed and safe to call.\n\nReturn \"incorrect\" if ANY of the following are true:\n- The agent used a hallucinated or nonexistent tool.\n- The agent selected a tool when none was needed.\n- The agent failed to call a required tool.\n- The agent chose a suboptimal or irrelevant tool.\n- The agent selected an unsafe or not-permitted tool.\n- The tool name does not appear in the available tools list.\n\nBefore providing your final judgment, explain your reasoning and consider:\n- What does the input context require?\n- Can this be answered without tools, or is a tool necessary?\n- If a tool was selected, does it exist in the available tools?\n- Does the selected tool's description match the user's needs?\n- Is the selection safe and appropriate?\n- Is there a better tool available that should have been chosen instead?\n",
        )
    ],
    choices={"correct": 1.0, "incorrect": 0.0},
)
