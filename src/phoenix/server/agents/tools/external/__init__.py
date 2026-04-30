from __future__ import annotations

from importlib import import_module
from pkgutil import iter_modules

from pydantic_ai.tools import ToolDefinition


def get_external_tool_definitions() -> list[ToolDefinition]:
    """Return server-defined tools that are executed outside the backend."""
    definitions: list[ToolDefinition] = []
    for module_info in sorted(iter_modules(__path__), key=lambda info: info.name):
        if module_info.ispkg:
            continue
        module = import_module(f"{__name__}.{module_info.name}")
        definition = getattr(module, "TOOL_DEFINITION", None)
        if isinstance(definition, ToolDefinition):
            definitions.append(definition)
    return definitions


def get_external_tool_names() -> frozenset[str]:
    return frozenset(tool.name for tool in get_external_tool_definitions())
