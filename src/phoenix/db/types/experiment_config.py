"""
Pydantic models for experiment execution configuration.

These types define the structure of provider, task, and evaluator configs stored in the database.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptInvocationParameters,
    PromptResponseFormat,
    PromptTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptTools,
)

# =============================================================================
# Prompt Version Config (mirrors models.PromptVersion structure)
# =============================================================================


class PromptVersionConfig(BaseModel):
    """
    Prompt version configuration for experiment execution.

    This structure mirrors models.PromptVersion to maintain consistency
    between stored prompts and experiment task configurations.
    """

    model_config = ConfigDict(frozen=True)

    # Template definition
    template_type: PromptTemplateType  # CHAT or STR
    template_format: PromptTemplateFormat  # F_STRING, MUSTACHE, or NONE
    template: PromptTemplate

    # Model configuration
    model_provider: ModelProvider
    model_name: str

    # Optional parameters
    invocation_parameters: PromptInvocationParameters | None = None
    tools: PromptTools | None = None
    response_format: PromptResponseFormat | None = None

    # Custom provider ID (if using custom provider instead of builtin)
    # None = use builtin provider with secrets/env vars
    custom_provider_id: int | None = None


# =============================================================================
# Task Config Types
# =============================================================================


class TaskConfig(BaseModel):
    """Configuration for running LLM tasks in an experiment."""

    model_config = ConfigDict(frozen=True)

    # Prompt configuration (mirrors PromptVersion)
    prompt_version: PromptVersionConfig

    # Experiment-specific settings (not part of PromptVersion)
    template_variables_path: str | None = None
    appended_messages_path: str | None = None


# =============================================================================
# Evaluator Config Types
# =============================================================================


class EvaluatorConfig(BaseModel):
    """Configuration for a single evaluator."""

    model_config = ConfigDict(frozen=True)

    # Evaluator database ID (numeric)
    # Negative IDs are builtin evaluators, positive IDs are LLM evaluators
    evaluator_id: int

    name: Identifier
    input_mapping: dict[str, Any] | None = None
    output_config: dict[str, Any] | None = None


class EvaluatorConfigs(BaseModel):
    """Configuration for all evaluators in an experiment."""

    model_config = ConfigDict(frozen=True)

    evaluators: list[EvaluatorConfig] = Field(default_factory=list)
