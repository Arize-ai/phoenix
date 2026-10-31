"""
Helper functions for prompt role conversions in GraphQL operations.
"""

from typing_extensions import assert_never

from phoenix.db.types.prompts import PromptMessageRole
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole


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
