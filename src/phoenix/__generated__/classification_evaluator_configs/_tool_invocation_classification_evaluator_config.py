# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="tool_invocation",
    description="For determining if a tool was invoked correctly with proper arguments, formatting, and safe content.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content='You are an impartial judge evaluating an LLM\'s tool-calling behavior, specifically whether the LLM invoked a tool (or tools) correctly with valid arguments and proper formatting.\n\nYour task: Determine whether the LLM\'s tool invocation(s) were correct or incorrect based on:\n- The full conversation context (including all previous turns, not just the most recent message)\n- The available tool schemas\n- The LLM\'s tool invocation(s) with arguments\n\nIMPORTANT - Tool Invocation vs. Tool Selection:\n- You are ONLY evaluating the tool invocation, not the tool selection.\n- If the tool selection is incorrect or not relevant to the user\'s query, but the tool invocation is correct, return "correct".\n- If the tool selection is correct but the tool invocation is incorrect, return "incorrect".\n\nIMPORTANT - Multi-Tool Invocations:\n- The LLM may invoke MULTIPLE tools in a single response. This is valid and expected for complex requests.\n- When multiple tools are invoked, evaluate EACH tool invocation independently.\n- Return "correct" only if ALL tool invocations are correct.\n- Return "incorrect" if ANY tool invocation has an error.\n\nIMPORTANT - Conversation Context (input):\n- Read the entire conversation history carefully, not just the final user message.\n- Argument values may need to be extracted from EARLIER turns in the conversation (e.g., user mentions a location, date, or quantity in a previous message).\n- The LLM should use context from the full conversation to populate argument values correctly.\n\nCriteria\nReturn "correct" only when ALL of the following are true for EVERY tool invocation:\n- JSON is properly structured (if applicable).\n- All required fields/parameters are present.\n- No hallucinated or nonexistent fields (all fields exist in the tool schema).\n- Argument values match the user\'s intent from the conversation context (correct types, realistic values).\n- No unsafe content (e.g., PII like SSNs, credit card numbers, passwords) in arguments.\n\nReturn "incorrect" if ANY of the following are true for ANY tool invocation:\n- The invocation contains hallucinated or nonexistent fields not in the schema.\n- Required fields/parameters are missing.\n- JSON is improperly formatted or malformed.\n- Argument values are incorrect, hallucinated, or do not match user intent from the conversation.\n- Arguments contain unsafe content (e.g., PII, sensitive data that should not be passed).\n\nBefore providing your final judgment, explain your reasoning and consider:\n- How many tools were invoked? Evaluate each one.\n- Does each tool invocation match the schema for that tool?\n- Are all required parameters provided with appropriate values for each invocation?\n- Are there any extra fields that don\'t exist in the schema?\n- Looking at the FULL input: do the argument values accurately reflect what the user requested across all messages?\n- Is there any unsafe or sensitive content in any of the arguments?\n- Check that you are not evaluating the tool selection, only the tool invocation.\n\n<data>\n<input>\n{{input}}\n</input>\n\n<available_tools>\n{{available_tools}}\n</available_tools>\n\n<output>\n{{tool_selection}}\n</output>\n</data>\n\nGiven the above data, is the tool invocation correct or incorrect?',
        )
    ],
    choices={"correct": 1.0, "incorrect": 0.0},
    substitutions={
        "available_tools": "available_tools_list",
        "tool_selection": "tool_calls_to_string",
    },
    labels=["promoted_dataset_evaluator"],
)
