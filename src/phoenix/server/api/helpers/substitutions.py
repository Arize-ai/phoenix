"""
Substitution expansion logic for classification evaluator templates.

This module provides functions to load substitution definitions and expand
simple template placeholders into full Mustache blocks.

Substitutions are loaded from substitutions/server.yaml which is copied from
prompts/formatters/server.yaml by the compile_prompts tox command.
"""

import logging
import re
from functools import lru_cache
from importlib import resources
from typing import Any

import yaml  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)


def _get_substitutions_path() -> Any:
    """Get the packaged substitutions YAML resource."""
    # Chain joinpath calls for Python 3.10 compatibility (single argument only)
    return resources.files(__package__).joinpath("substitutions").joinpath("server.yaml")


@lru_cache(maxsize=1)
def load_substitutions() -> dict[str, str]:
    """
    Load substitution definitions from the YAML file.

    Returns a dict mapping substitution names to their Mustache template snippets.
    Results are cached for performance.
    """
    substitutions_path = _get_substitutions_path()
    if not substitutions_path.is_file():
        return {}

    substitutions = yaml.safe_load(substitutions_path.read_text(encoding="utf-8"))

    return substitutions if substitutions else {}


def expand_template_placeholders(
    template: str,
    substitutions_mapping: dict[str, str],
    substitutions: dict[str, str] | None = None,
) -> str:
    """
    Replace simple placeholders with expanded Mustache blocks.

    Args:
        template: The template string containing placeholders like {{placeholder}}
        substitutions_mapping: Maps placeholder names to substitution names
            e.g., {"available_tools": "available_tools_descriptions"}
        substitutions: Optional dict of substitution definitions. If not provided,
            loads from the YAML file.

    Returns:
        The template with placeholders replaced by their substitution expansions.
    """
    if substitutions is None:
        substitutions = load_substitutions()

    for placeholder, substitution_name in substitutions_mapping.items():
        if substitution_name not in substitutions:
            logger.warning(
                f"Substitution '{substitution_name}' referenced by placeholder "
                f"'{placeholder}' not found in server.yaml"
            )
            continue

        # Pattern matches {{placeholder}} with optional whitespace
        pattern = rf"{{{{\s*{re.escape(placeholder)}\s*}}}}"
        replacement = substitutions[substitution_name]
        template = re.sub(pattern, lambda _: replacement, template)

    return template


def expand_config_templates(
    config: Any,
    substitutions: dict[str, str] | None = None,
) -> Any:
    """
    Expand placeholders in a classification evaluator config's message content.

    Args:
        config: A ClassificationEvaluatorConfig with optional substitutions mapping
        substitutions: Optional dict of substitution definitions. If not provided,
            loads from the YAML file.

    Returns:
        A new config with expanded message content, or the original if no
        substitutions are defined.
    """
    if not hasattr(config, "substitutions") or not config.substitutions:
        return config

    if substitutions is None:
        substitutions = load_substitutions()

    # Create a copy of the config with expanded messages
    expanded_messages = []
    for msg in config.messages:
        expanded_content = expand_template_placeholders(
            msg.content,
            config.substitutions,
            substitutions,
        )
        # Create a new message with the expanded content
        expanded_messages.append(msg.model_copy(update={"content": expanded_content}))

    # Return a new config with expanded messages
    return config.model_copy(update={"messages": expanded_messages})
