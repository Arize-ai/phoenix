# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="tool_selection",
    description="A specialized evaluator for determining if the correct tool was selected for a given context. Requires conversation context, a list of available tools, and the agent's tool selections.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an impartial judge evaluating an AI agent's tool-calling behavior, specifically whether the agent selected the most appropriate tool or tools for the task.\nYour task: Determine whether the agent's tool selection was correct or incorrect based on: - The conversation context - The available tools - The agent's tool invocation(s)\nCriteria Return \"correct\" only when ALL of the following are true: - The agent chose the best available tool for the user query OR correctly avoided tools if none were needed. - The tool name exists in the available tools list. - The tool is allowed and safe to call. - The agent selected the correct number of tools for the task.\nReturn \"incorrect\" if ANY of the following are true: - The agent used a hallucinated or nonexistent tool. - The agent selected a tool when none was needed. - The agent did not use a tool when one was required. - The agent chose a suboptimal or irrelevant tool. - The agent selected an unsafe or not-permitted tool. - The tool name does not appear in the available tools list.\nBefore providing your final judgment, explain your reasoning and consider: - What does the input context require? - Can this be answered without tools, or is a tool necessary? - If a tool was selected, does it exist in the available tools? - Does the selected tool's description match the user's needs? - Is the selection safe and appropriate? - Is there a better tool available that should have been chosen instead?\n<data> <context> {{input}} </context>\n<available_tools> {{available_tools}} </available_tools>\n<agent_tool_selection> {{agent_tool_selection}} </agent_tool_selection> </data>\nGiven the above data, is the tool selection correct or incorrect?",
        )
    ],
    choices={"correct": 1.0, "incorrect": 0.0},
)
