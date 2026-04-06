"""
GraphQL output types for ExperimentPromptTask.

Converts the ORM model into typed GraphQL fields for frontend consumption
(e.g., playground rehydration via ExperimentJob.taskConfig).
"""

from typing import TYPE_CHECKING, Annotated, Optional, Union, cast

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.server.api.context import Context

if TYPE_CHECKING:
    from phoenix.server.api.types.GenerativeModelCustomProvider import (
        GenerativeModelCustomProvider,
    )
from strawberry import Private

from phoenix.db.types import experiment_config as config_types
from phoenix.db.types.prompts import (
    PromptTemplateFormat,
    PromptTemplateType,
    get_raw_invocation_parameters,
)
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.PromptResponseFormat import (
    PromptResponseFormatJSONSchema,
)
from phoenix.server.api.types.PromptTools import PromptTools
from phoenix.server.api.types.PromptVersion import PromptVersion, to_gql_prompt_version
from phoenix.server.api.types.PromptVersionTemplate import (
    PromptTemplate,
    to_gql_template_from_orm,
)

# =============================================================================
# Connection Config (discriminated union — builtin providers only)
# =============================================================================


@strawberry.type
class OpenAIConnectionConfig:
    base_url: Optional[str]
    organization: Optional[str]
    project: Optional[str]
    openai_api_type: OpenAIApiType

    @classmethod
    def from_orm(cls, obj: config_types.OpenAIConnectionConfig) -> "OpenAIConnectionConfig":
        return cls(
            base_url=obj.base_url,
            organization=obj.organization or None,
            project=obj.project or None,
            openai_api_type=OpenAIApiType(obj.openai_api_type),
        )


@strawberry.type
class AzureOpenAIConnectionConfig:
    azure_endpoint: str
    openai_api_type: OpenAIApiType

    @classmethod
    def from_orm(
        cls, obj: config_types.AzureOpenAIConnectionConfig
    ) -> "AzureOpenAIConnectionConfig":
        return cls(
            azure_endpoint=obj.azure_endpoint,
            openai_api_type=OpenAIApiType(obj.openai_api_type),
        )


@strawberry.type
class AnthropicConnectionConfig:
    base_url: Optional[str]

    @classmethod
    def from_orm(cls, obj: config_types.AnthropicConnectionConfig) -> "AnthropicConnectionConfig":
        return cls(base_url=obj.base_url)


@strawberry.type
class AWSBedrockConnectionConfig:
    region_name: Optional[str]
    endpoint_url: Optional[str]

    @classmethod
    def from_orm(cls, obj: config_types.AWSBedrockConnectionConfig) -> "AWSBedrockConnectionConfig":
        return cls(
            region_name=obj.region_name,
            endpoint_url=obj.endpoint_url,
        )


@strawberry.type
class GoogleGenAIConnectionConfig:
    base_url: Optional[str]

    @classmethod
    def from_orm(
        cls, obj: config_types.GoogleGenAIConnectionConfig
    ) -> "GoogleGenAIConnectionConfig":
        return cls(base_url=obj.base_url)


ConnectionConfig = Annotated[
    Union[
        OpenAIConnectionConfig,
        AzureOpenAIConnectionConfig,
        AnthropicConnectionConfig,
        AWSBedrockConnectionConfig,
        GoogleGenAIConnectionConfig,
    ],
    strawberry.union(name="ConnectionConfig"),
]


def _connection_from_orm(obj: config_types.ConnectionConfig) -> ConnectionConfig:
    if obj.type == "openai":
        return OpenAIConnectionConfig.from_orm(obj)
    if obj.type == "azure_openai":
        return AzureOpenAIConnectionConfig.from_orm(obj)
    if obj.type == "anthropic":
        return AnthropicConnectionConfig.from_orm(obj)
    if obj.type == "aws_bedrock":
        return AWSBedrockConnectionConfig.from_orm(obj)
    if obj.type == "google_genai":
        return GoogleGenAIConnectionConfig.from_orm(obj)
    assert_never(obj)


# =============================================================================
# Playground Config
# =============================================================================


@strawberry.type
class PlaygroundConfig:
    template_variables_path: Optional[str]
    appended_messages_path: Optional[str]


# =============================================================================
# Prompt Task Config (maps from ORM ExperimentPromptTask)
# =============================================================================


@strawberry.type
class PromptConfig:
    prompt_version_id: Private[int | None] = None
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    tools: Optional[PromptTools] = None
    response_format: Optional[PromptResponseFormatJSONSchema] = None
    invocation_parameters: JSON = strawberry.field(default_factory=dict)
    model_provider: GenerativeProviderKey = strawberry.field(
        description="The model provider (OPENAI, ANTHROPIC, etc.)"
    )
    model_name: str

    @strawberry.field
    async def prompt_version(self, info: Info[Context, None]) -> PromptVersion | None:
        if self.prompt_version_id is None:
            return None
        prompt_version = await info.context.data_loaders.prompt_versions.load(
            self.prompt_version_id
        )
        if prompt_version is None:
            return None
        return to_gql_prompt_version(prompt_version=prompt_version)


@strawberry.type
class PromptTaskConfig(Node):
    id: NodeID[int]
    prompt: PromptConfig
    connection: Optional[ConnectionConfig] = None
    playground_config: Optional[PlaygroundConfig] = None
    stream_model_output: bool = True

    @classmethod
    def from_orm(cls, obj: models.ExperimentPromptTask) -> "PromptTaskConfig":
        pg = obj.playground_config
        # to_gql_template_from_orm expects an object with .template and
        # .template_type — ExperimentPromptTask has both, so cast is safe.
        template = to_gql_template_from_orm(cast(ORMPromptVersion, obj))
        return cls(
            id=obj.id,
            prompt=PromptConfig(
                prompt_version_id=obj.prompt_version_id,
                template_type=obj.template_type,
                template_format=obj.template_format,
                template=template,
                tools=PromptTools.from_orm(obj.tools) if obj.tools else None,
                response_format=(
                    PromptResponseFormatJSONSchema.from_orm(obj.response_format)
                    if obj.response_format
                    else None
                ),
                invocation_parameters=get_raw_invocation_parameters(obj.invocation_parameters),
                model_provider=GenerativeProviderKey.from_model_provider(obj.model_provider),
                model_name=obj.model_name,
            ),
            connection=_connection_from_orm(obj.connection) if obj.connection else None,
            playground_config=(
                PlaygroundConfig(
                    template_variables_path=pg.template_variables_path,
                    appended_messages_path=pg.appended_messages_path,
                )
                if pg
                else None
            ),
            stream_model_output=obj.stream_model_output,
        )

    @strawberry.field(  # type: ignore[untyped-decorator]
        description="The custom provider used by this experiment, if any. "
        "Resolved from the task config's connection.",
    )
    async def custom_provider(
        self, info: Info[Context, None]
    ) -> (
        Annotated[
            "GenerativeModelCustomProvider",
            strawberry.lazy(".GenerativeModelCustomProvider"),
        ]
        | None
    ):
        from phoenix.server.api.types.GenerativeModelCustomProvider import (
            GenerativeModelCustomProvider,
        )

        async with info.context.db.read() as session:
            prompt_task = await session.get(models.ExperimentPromptTask, self.id)
            if prompt_task is None or prompt_task.custom_provider_id is None:
                return None
            provider = await session.get(
                models.GenerativeModelCustomProvider, prompt_task.custom_provider_id
            )
            if provider is None:
                return None
            return GenerativeModelCustomProvider(id=provider.id, db_record=provider)
