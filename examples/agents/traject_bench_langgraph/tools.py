# mypy: ignore-errors
"""
Mock tool factory for TRAJECT-Bench tasks.

Creates @tool decorated functions dynamically from TRAJECT-Bench tool definitions.
Each tool returns the pre-recorded `executed_output` from the dataset when invoked,
giving the agent realistic API responses to reason over.

Tools are created fresh per task since each task has a different set of tools.
"""

from __future__ import annotations

import re
from typing import Any

from langchain_core.tools import tool


def sanitize_tool_name(name: str) -> str:
    """Convert a TRAJECT-Bench tool name to a valid Python function name.

    Examples:
        "Wayfair: reviews/list" → "wayfair_reviews_list"
        "Aliexpress DataHub: Aliexpress - User Basic Parameters" → "aliexpress_datahub_aliexpress_user_basic_parameters"
        "ASOS: /countries/list" → "asos_countries_list"
    """
    # Replace special characters with underscores
    name = name.lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    # Remove leading/trailing underscores
    name = name.strip("_")
    # Ensure it doesn't start with a digit
    if name and name[0].isdigit():
        name = "tool_" + name
    # OpenAI enforces a 64-character limit on function names
    if len(name) > 64:
        name = name[:64].rstrip("_")
    return name


def _build_param_description(params: list[dict]) -> str:
    """Build a parameter description string from TRAJECT-Bench parameter list."""
    if not params:
        return ""
    parts = []
    for p in params:
        name = p.get("name", "unknown")
        value = p.get("value", "")
        parts.append(f"  - {name}: (e.g. {value!r})")
    return "\n".join(parts)


def create_mock_tools(tool_defs: list[dict]) -> list:
    """Create LangChain @tool functions from TRAJECT-Bench tool definitions.

    Each tool:
    - Has a name derived from the 'tool name' field
    - Has a docstring from 'tool description'
    - Accepts **kwargs (since parameters vary per tool)
    - Returns the pre-recorded 'executed_output'

    For sequential tasks with execution_status == "failed", the tool returns
    the error output (which is already in executed_output).

    Args:
        tool_defs: List of tool definition dicts from the TRAJECT-Bench dataset.

    Returns:
        List of LangChain tool objects.
    """
    tools = []

    for i, tool_def in enumerate(tool_defs):
        original_name = tool_def.get("tool name", f"tool_{i}")
        func_name = sanitize_tool_name(original_name)
        description = tool_def.get("tool description", "No description available.")
        executed_output = tool_def.get("executed_output", "")

        # Build parameter info for the docstring
        required_params = tool_def.get("required parameters", [])
        optional_params = tool_def.get("optional parameters", [])

        # Build a descriptive docstring that includes parameter info
        docstring_parts = [description]
        if required_params:
            docstring_parts.append(
                f"\nRequired parameters:\n{_build_param_description(required_params)}"
            )
        if optional_params:
            docstring_parts.append(
                f"\nOptional parameters:\n{_build_param_description(optional_params)}"
            )
        full_docstring = "\n".join(docstring_parts)

        # Build the list of expected parameter names
        all_param_names = [p["name"] for p in required_params] + [
            p["name"] for p in optional_params
        ]

        # Create the mock tool function using a closure
        mock_tool = _make_mock_tool(
            func_name=func_name,
            original_name=original_name,
            docstring=full_docstring,
            executed_output=executed_output,
            param_names=all_param_names,
        )

        tools.append(mock_tool)

    return tools


def _make_mock_tool(
    func_name: str,
    original_name: str,
    docstring: str,
    executed_output: str,
    param_names: list[str],
) -> Any:
    """Create a single mock tool with the LangChain @tool decorator.

    Uses a kwargs-based approach: the tool accepts a single `parameters` dict
    argument, which lets us handle varying parameter sets without needing
    to dynamically construct function signatures.
    """

    @tool(func_name, parse_docstring=False)
    def mock_func(parameters: dict[str, str] | None = None) -> str:
        """Mock tool that returns pre-recorded output."""
        # Always return the pre-recorded output regardless of parameters.
        # The ground truth comparison happens in the evaluation step, not here.
        return str(executed_output) if executed_output else "No output available."

    # Override the description with the full docstring (tool name + description + params)
    mock_func.description = f"[{original_name}] {docstring}"

    return mock_func


def get_expected_tool_calls(tool_defs: list[dict]) -> list[dict]:
    """Extract the expected tool calls from task tool definitions.

    Returns a list of dicts with tool name, expected parameters, and expected output
    for ground truth comparison.
    """
    expected = []
    for tool_def in tool_defs:
        original_name = tool_def.get("tool name", "")
        func_name = sanitize_tool_name(original_name)
        required_params = {p["name"]: p["value"] for p in tool_def.get("required parameters", [])}
        optional_params = {p["name"]: p["value"] for p in tool_def.get("optional parameters", [])}

        entry = {
            "original_name": original_name,
            "func_name": func_name,
            "required_parameters": required_params,
            "optional_parameters": optional_params,
            "executed_output": tool_def.get("executed_output", ""),
        }

        # Sequential-specific fields
        if "execution_status" in tool_def:
            entry["execution_status"] = tool_def["execution_status"]
        if "sequence_step" in tool_def:
            entry["sequence_step"] = tool_def["sequence_step"]

        expected.append(entry)

    return expected
