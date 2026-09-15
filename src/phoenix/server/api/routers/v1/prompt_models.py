"""Shared REST prompt schemas and conversions to database models."""

from typing import Any, Optional

from pydantic import field_validator, model_validator
from typing_extensions import Self, assert_never

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptInvocationParameters,
    PromptResponseFormat,
    PromptTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptTools,
    normalize_invocation_parameters_for_write,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel


class PromptData(V1RoutesBaseModel):
    name: Identifier
    description: Optional[str] = None
    source_prompt_id: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Prompt(PromptData):
    id: str


class PromptVersionData(V1RoutesBaseModel):
    description: Optional[str] = None
    model_provider: ModelProvider
    model_name: str
    template: PromptTemplate
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    invocation_parameters: PromptInvocationParameters
    tools: Optional[PromptTools] = None
    response_format: Optional[PromptResponseFormat] = None

    @field_validator("invocation_parameters", mode="after")
    @classmethod
    def normalize_openai_family_invocation_parameters(
        cls, value: PromptInvocationParameters
    ) -> PromptInvocationParameters:
        return normalize_invocation_parameters_for_write(value)

    @model_validator(mode="after")
    def check_template_type_match(self) -> Self:
        if self.template_type is PromptTemplateType.CHAT:
            if self.template.type == "chat":
                return self
        elif self.template_type is PromptTemplateType.STRING:
            if self.template.type == "string":
                return self
        else:
            assert_never(self.template_type)
        raise ValueError("Template type does not match template")


class PromptVersion(PromptVersionData):
    id: str


class PromptVersionTagData(V1RoutesBaseModel):
    name: Identifier
    description: Optional[str] = None


class PromptVersionTag(PromptVersionTagData):
    id: str


def prompt_version_data_from_orm(prompt_version: models.PromptVersion) -> PromptVersionData:
    """Convert stored prompt content to the shared REST representation."""
    return PromptVersionData(
        description=prompt_version.description,
        model_provider=prompt_version.model_provider,
        model_name=prompt_version.model_name,
        template=prompt_version.template,
        template_type=PromptTemplateType(prompt_version.template_type),
        template_format=PromptTemplateFormat(prompt_version.template_format),
        invocation_parameters=prompt_version.invocation_parameters,
        tools=prompt_version.tools,
        response_format=prompt_version.response_format,
    )
