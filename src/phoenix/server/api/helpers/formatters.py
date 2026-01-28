"""
Formatter expansion logic for classification evaluator templates.

This module provides functions to load formatter definitions and expand
simple template placeholders into full Mustache blocks.
"""

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml


def _get_formatters_path() -> Path:
    """Get the path to the formatters YAML file."""
    # Navigate from this file to the prompts/formatters directory
    # This file: src/phoenix/server/api/helpers/formatters.py
    # Target: prompts/formatters/common.yaml
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent.parent.parent.parent
    return project_root / "prompts" / "formatters" / "common.yaml"


@lru_cache(maxsize=1)
def load_formatters() -> dict[str, str]:
    """
    Load formatter definitions from the YAML file.

    Returns a dict mapping formatter names to their Mustache template snippets.
    Results are cached for performance.
    """
    formatters_path = _get_formatters_path()
    if not formatters_path.exists():
        return {}

    with open(formatters_path, "r", encoding="utf-8") as f:
        formatters = yaml.safe_load(f)

    return formatters if formatters else {}


def expand_template_placeholders(
    template: str,
    formatters_mapping: dict[str, str],
    formatters: dict[str, str] | None = None,
) -> str:
    """
    Replace simple placeholders with expanded Mustache blocks.

    Args:
        template: The template string containing placeholders like {{placeholder}}
        formatters_mapping: Maps placeholder names to formatter names
            e.g., {"available_tools": "available_tools_descriptions"}
        formatters: Optional dict of formatter definitions. If not provided,
            loads from the YAML file.

    Returns:
        The template with placeholders replaced by their formatter expansions.
    """
    if formatters is None:
        formatters = load_formatters()

    for placeholder, formatter_name in formatters_mapping.items():
        if formatter_name not in formatters:
            continue

        # Pattern matches {{placeholder}} with optional whitespace
        pattern = rf"{{{{\s*{re.escape(placeholder)}\s*}}}}"
        replacement = formatters[formatter_name]
        template = re.sub(pattern, replacement, template)

    return template


def expand_config_templates(
    config: Any,
    formatters: dict[str, str] | None = None,
) -> Any:
    """
    Expand placeholders in a classification evaluator config's message content.

    Args:
        config: A ClassificationEvaluatorConfig with optional formatters mapping
        formatters: Optional dict of formatter definitions. If not provided,
            loads from the YAML file.

    Returns:
        A new config with expanded message content, or the original if no
        formatters are defined.
    """
    if not hasattr(config, "formatters") or not config.formatters:
        return config

    if formatters is None:
        formatters = load_formatters()

    # Create a copy of the config with expanded messages
    expanded_messages = []
    for msg in config.messages:
        expanded_content = expand_template_placeholders(
            msg.content,
            config.formatters,
            formatters,
        )
        # Create a new message with the expanded content
        expanded_messages.append(msg.model_copy(update={"content": expanded_content}))

    # Return a new config with expanded messages
    return config.model_copy(update={"messages": expanded_messages})
