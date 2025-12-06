"""
Helper functions for prompt template formatting in GraphQL operations.
"""

from typing_extensions import assert_never

from phoenix.server.api.helpers.prompts.models import PromptMessageRole, PromptTemplateFormat
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    NoOpFormatter,
    TemplateFormatter,
)


def get_template_formatter(template_format: PromptTemplateFormat) -> TemplateFormatter:
    """
    Returns the appropriate template formatter for the given format.

    Args:
        template_format: The format type (MUSTACHE, F_STRING, or NONE)

    Returns:
        A TemplateFormatter instance for the specified format
    """
    if template_format is PromptTemplateFormat.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_format is PromptTemplateFormat.F_STRING:
        return FStringTemplateFormatter()
    if template_format is PromptTemplateFormat.NONE:
        return NoOpFormatter()
    assert_never(template_format)


def convert_chat_role_to_prompt_role(role: ChatCompletionMessageRole) -> PromptMessageRole:
    """
    Converts a ChatCompletionMessageRole to a PromptMessageRole.

    Args:
        role: The chat completion message role

    Returns:
        The corresponding prompt message role
    """
    if role is ChatCompletionMessageRole.USER:
        return PromptMessageRole.USER
    if role is ChatCompletionMessageRole.SYSTEM:
        return PromptMessageRole.SYSTEM
    if role is ChatCompletionMessageRole.AI:
        return PromptMessageRole.AI
    if role is ChatCompletionMessageRole.TOOL:
        return PromptMessageRole.TOOL
    assert_never(role)
