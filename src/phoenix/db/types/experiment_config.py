"""
Pydantic models for experiment execution configuration.

These models are used as JSON column types in the experiment_prompt_tasks table:
- ConnectionConfig: SDK-specific connection overrides (discriminated union)
- PlaygroundConfig: Evolving playground-specific settings
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import ConfigDict, Field

from phoenix.db.types.db_helper_types import DBBaseModel

# =============================================================================
# Connection Config (HOW to reach the model)
# =============================================================================


class OpenAIConnectionConfig(DBBaseModel):
    """Non-sensitive connection options for OpenAI SDK clients."""

    model_config = ConfigDict(frozen=True)

    type: Literal["openai"]
    base_url: str | None = None
    organization: str | None = None
    project: str | None = None
    openai_api_type: Literal["chat_completions", "responses"]


class AzureOpenAIConnectionConfig(DBBaseModel):
    """Non-sensitive connection options for Azure OpenAI SDK clients."""

    model_config = ConfigDict(frozen=True)

    type: Literal["azure_openai"]
    azure_endpoint: str
    openai_api_type: Literal["chat_completions", "responses"]


class AnthropicConnectionConfig(DBBaseModel):
    """Non-sensitive connection options for Anthropic SDK clients."""

    model_config = ConfigDict(frozen=True)

    type: Literal["anthropic"]
    base_url: str | None = None


class AWSBedrockConnectionConfig(DBBaseModel):
    """Non-sensitive connection options for AWS Bedrock SDK clients."""

    model_config = ConfigDict(frozen=True)

    type: Literal["aws_bedrock"]
    region_name: str | None = None
    endpoint_url: str | None = None


class GoogleGenAIConnectionConfig(DBBaseModel):
    """Non-sensitive connection options for Google GenAI SDK clients."""

    model_config = ConfigDict(frozen=True)

    type: Literal["google_genai"]
    base_url: str | None = None


ConnectionConfig = Annotated[
    Union[
        OpenAIConnectionConfig,
        AzureOpenAIConnectionConfig,
        AnthropicConnectionConfig,
        AWSBedrockConnectionConfig,
        GoogleGenAIConnectionConfig,
    ],
    Field(discriminator="type"),
]


# =============================================================================
# Playground Config (evolving playground-specific settings)
# =============================================================================


class PlaygroundConfig(DBBaseModel):
    """Playground-specific settings that evolve independently from prompt/model config."""

    model_config = ConfigDict(frozen=True)

    template_variables_path: str | None = None
    appended_messages_path: str | None = None
