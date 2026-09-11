"""Shared REST prompt schemas and conversions to database models."""

from typing import Any, Optional

from pydantic import field_validator, model_validator
from strawberry.relay import GlobalID
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
from phoenix.server.api.helpers.prompts.validation import (
    validate_invocation_parameters_match_provider,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.types.node import from_global_id_with_expected_type


class PromptData(V1RoutesBaseModel):
    name: Identifier
    description: Optional[str] = None
    source_prompt_id: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class Prompt(PromptData):
    id: str


class PromptVersionData(V1RoutesBaseModel):
    """Prompt content shared by prompt and evaluator APIs."""

    description: Optional[str] = None
    model_provider: ModelProvider
    model_name: str
    template: PromptTemplate
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    invocation_parameters: PromptInvocationParameters
    tools: Optional[PromptTools] = None
    response_format: Optional[PromptResponseFormat] = None
    custom_provider_id: Optional[str] = None

    @field_validator("custom_provider_id")
    @classmethod
    def validate_custom_provider_id(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            from_global_id_with_expected_type(
                GlobalID.from_id(value), "GenerativeModelCustomProvider"
            )
        return value

    def to_orm(self, *, user_id: Optional[int] = None) -> models.PromptVersion:
        """Build an unpersisted version with validated invocation parameters.

        The caller assigns the prompt and validates provider existence in its
        write transaction. Metadata starts empty.
        """
        validate_invocation_parameters_match_provider(
            self.model_provider, self.invocation_parameters
        )
        custom_provider_id = (
            from_global_id_with_expected_type(
                GlobalID.from_id(self.custom_provider_id), "GenerativeModelCustomProvider"
            )
            if self.custom_provider_id is not None
            else None
        )
        return models.PromptVersion(
            user_id=user_id,
            description=self.description,
            model_provider=self.model_provider,
            model_name=self.model_name,
            template=self.template,
            template_type=self.template_type,
            template_format=self.template_format,
            invocation_parameters=self.invocation_parameters,
            tools=self.tools,
            response_format=self.response_format,
            custom_provider_id=custom_provider_id,
            metadata_={},
        )

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
        custom_provider_id=str(
            GlobalID("GenerativeModelCustomProvider", str(prompt_version.custom_provider_id))
        )
        if prompt_version.custom_provider_id is not None
        else None,
    )
