# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

TOOL_BYPASS_CLASSIFICATION_EVALUATOR_CONFIG = ClassificationEvaluatorConfig(
    name="tool_bypass",
    description="Detects assistant content that asserts an entity-affecting outcome with no matching tool span in the trace.",
    optimization_direction="maximize",
    messages=[
        PromptMessage(
            role="user",
            content="You are an impartial judge evaluating an LLM agent's claim of having performed an action, specifically whether the assistant asserted an entity-affecting outcome (a state change, a created record, an updated value) without firing a corresponding tool.\n\nYour task: Determine whether the assistant's content represents a \"tool bypass\" failure based on:\n- The assistant's output (what was claimed)\n- The set of tool calls observed in the same trace\n- The available tools the agent could have called\n\nDefinition of tool bypass:\nThe assistant content asserts an entity-affecting outcome AND no tool call in the same trace references the same entity within the trace window.\n\nReturn \"grounded\" only when ALL of the following are true:\n- The assistant's claim of an action is supported by a tool call in the trace.\n- The tool call references the same entity claimed in the assertion (same user, same record, same field).\n- The tool call is consistent in direction with the claim (an \"added\" claim has an additive tool call, not a query).\n\nReturn \"phantom\" if ANY of the following are true:\n- The assistant claims an action was performed and no tool span exists in the trace.\n- A tool call exists but references a different entity than the one claimed.\n- The assistant claims an outcome (e.g. \"logged 16/16\") without a matching tool span confirming that outcome.\n\nImportant boundary cases to handle correctly:\n- Quoted historical claims: if the assistant is summarizing or correcting a prior phantom (e.g. \"you said 16/16 but nothing got logged\"), that is NOT a fresh phantom. Return \"grounded\".\n- Date or numeric collisions: \"4/16\" as a date in a calendar context is NOT a water-cup count and NOT a phantom claim of action.\n- Reading vs. asserting: \"you're at 48g\" as a recall of a prior tool result is grounded if a prior tool call set that state.\n\nBefore providing your final judgment, consider:\n- What entity does the assertion reference (user, record, field, value)?\n- Does any tool call in the trace touch that entity?\n- Is the assertion a fresh action claim or a reading of prior state?\n\n<data>\n<input>\n{{input}}\n</input>\n\n<assistant_output>\n{{assistant_output}}\n</assistant_output>\n\n<tool_spans>\n{{tool_spans}}\n</tool_spans>\n\n<available_tools>\n{{available_tools}}\n</available_tools>\n</data>\n\nGiven the above data, is the assistant's outcome claim grounded or a phantom?",
        )
    ],
    choices={"grounded": 1.0, "phantom": 0.0},
    substitutions={
        "assistant_output": "assistant_response_text",
        "tool_spans": "observed_tool_call_summary",
        "available_tools": "available_tools_list",
    },
    labels=["promoted_dataset_evaluator"],
)
