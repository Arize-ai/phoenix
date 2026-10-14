"""
GraphQL output types for the evaluator an experiment task froze when it started.

Mirrors the pydantic union in phoenix.db.types.evaluator_definition, which is imported
here under an alias so the GraphQL types can carry the same names.
"""

from typing import TYPE_CHECKING, Annotated, Optional, Union, cast

import strawberry
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.db.models import PromptVersion as ORMPromptVersion
from phoenix.db.types import evaluator_definition as definition_types
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.prompts import PromptTemplateFormat
from phoenix.server.api.context import Context
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluatorOutputConfig,
    _to_gql_output_config,
)
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.PromptInvocationParameters import (
    PromptInvocationParameters,
    gql_prompt_invocation_parameters_from_orm,
)
from phoenix.server.api.types.PromptResponseFormat import PromptResponseFormatJSONSchema
from phoenix.server.api.types.PromptTools import PromptTools
from phoenix.server.api.types.PromptVersionTemplate import (
    PromptTemplate,
    to_gql_prompt_chat_template_from_orm,
)
from phoenix.server.api.types.SandboxConfig import Language

if TYPE_CHECKING:
    from phoenix.server.api.types.GenerativeModelCustomProvider import (
        GenerativeModelCustomProvider,
    )

_OUTPUT_CONFIG_ID_PREFIX = "EvaluatorTaskDefinition"


def _global_id(type_name: str, rowid: Optional[int]) -> Optional[GlobalID]:
    return GlobalID(type_name, str(rowid)) if rowid is not None else None


@strawberry.type
class EvaluatorTaskSource:
    evaluator_id: Optional[GlobalID]
    prompt_version_id: Optional[GlobalID]
    dataset_evaluator_id: Optional[GlobalID]
    project_evaluator_id: Optional[GlobalID]


def _to_gql_source(
    source: Optional[definition_types.EvaluatorSource], evaluator_type_name: str
) -> Optional[EvaluatorTaskSource]:
    if source is None:
        return None
    return EvaluatorTaskSource(
        evaluator_id=_global_id(evaluator_type_name, source.evaluator_id),
        prompt_version_id=_global_id("PromptVersion", source.prompt_version_id),
        dataset_evaluator_id=_global_id("DatasetEvaluator", source.dataset_evaluator_id),
        project_evaluator_id=_global_id("ProjectEvaluator", source.project_evaluator_id),
    )


def _to_gql_output_configs(
    configs: list[OutputConfigType], evaluator_id: int
) -> list[BuiltInEvaluatorOutputConfig]:
    return [
        _to_gql_output_config(
            config=config,
            annotation_name=config.name,
            id_prefix=_OUTPUT_CONFIG_ID_PREFIX,
            evaluator_id=evaluator_id,
        )
        for config in configs
    ]


@strawberry.type
class InlineLLMEvaluatorDefinition:
    """An LLM evaluator drafted inline, with its judge prompt frozen as drafted."""

    name: str
    description: Optional[str]
    model_provider: GenerativeProviderKey
    model_name: str
    template_format: PromptTemplateFormat
    template: PromptTemplate
    tools: Optional[PromptTools]
    response_format: Optional[PromptResponseFormatJSONSchema]
    invocation_parameters: PromptInvocationParameters
    output_configs: list[BuiltInEvaluatorOutputConfig]
    source: Optional[EvaluatorTaskSource]
    custom_provider_id: strawberry.Private[Optional[int]]

    @classmethod
    def from_orm(
        cls, obj: definition_types.InlineLLMEvaluatorDefinition, evaluator_id: int
    ) -> "InlineLLMEvaluatorDefinition":
        prompt_version = obj.prompt_version
        return cls(
            name=obj.name,
            description=obj.description,
            model_provider=GenerativeProviderKey.from_model_provider(prompt_version.model_provider),
            model_name=prompt_version.model_name,
            template_format=PromptTemplateFormat(prompt_version.template_format),
            # to_gql_prompt_chat_template_from_orm reads only .template, which the frozen
            # prompt version carries.
            template=to_gql_prompt_chat_template_from_orm(cast(ORMPromptVersion, prompt_version)),
            tools=PromptTools.from_orm(prompt_version.tools) if prompt_version.tools else None,
            response_format=(
                PromptResponseFormatJSONSchema.from_orm(prompt_version.response_format)
                if prompt_version.response_format
                else None
            ),
            invocation_parameters=gql_prompt_invocation_parameters_from_orm(
                prompt_version.invocation_parameters
            ),
            output_configs=_to_gql_output_configs(list(obj.output_configs), evaluator_id),
            source=_to_gql_source(obj.source, "LLMEvaluator"),
            custom_provider_id=prompt_version.custom_provider_id,
        )

    @strawberry.field
    async def custom_provider(
        self, info: Info[Context, None]
    ) -> (
        Annotated[
            "GenerativeModelCustomProvider",
            strawberry.lazy(".GenerativeModelCustomProvider"),
        ]
        | None
    ):
        from phoenix.db import models
        from phoenix.server.api.types.GenerativeModelCustomProvider import (
            GenerativeModelCustomProvider,
        )

        if self.custom_provider_id is None:
            return None
        async with info.context.db.read() as session:
            provider = await session.get(
                models.GenerativeModelCustomProvider, self.custom_provider_id
            )
        if provider is None:
            return None
        return GenerativeModelCustomProvider(id=provider.id, db_record=provider)


@strawberry.type
class InlineCodeEvaluatorDefinition:
    """A code evaluator drafted inline, frozen with the sandbox it ran in."""

    name: str
    description: Optional[str]
    language: Language
    source_code: str
    sandbox_config_id: GlobalID
    output_configs: list[BuiltInEvaluatorOutputConfig]
    source: Optional[EvaluatorTaskSource]

    @classmethod
    def from_orm(
        cls, obj: definition_types.InlineCodeEvaluatorDefinition, evaluator_id: int
    ) -> "InlineCodeEvaluatorDefinition":
        return cls(
            name=obj.name,
            description=obj.description,
            language=Language(obj.language),
            source_code=obj.source_code,
            sandbox_config_id=GlobalID("SandboxConfig", str(obj.sandbox_config_id)),
            output_configs=_to_gql_output_configs(list(obj.output_configs), evaluator_id),
            source=_to_gql_source(obj.source, "CodeEvaluator"),
        )


@strawberry.type
class StoredCodeEvaluatorDefinition:
    """A stored code evaluator, pinned to the version the experiment started on."""

    code_evaluator_id: GlobalID
    code_evaluator_version_id: Optional[GlobalID]
    source: Optional[EvaluatorTaskSource]

    @classmethod
    def from_orm(
        cls, obj: definition_types.StoredCodeEvaluatorDefinition
    ) -> "StoredCodeEvaluatorDefinition":
        return cls(
            code_evaluator_id=GlobalID("CodeEvaluator", str(obj.code_evaluator_id)),
            code_evaluator_version_id=_global_id(
                "CodeEvaluatorVersion", obj.code_evaluator_version_id
            ),
            source=_to_gql_source(obj.source, "CodeEvaluator"),
        )


@strawberry.type
class BuiltInEvaluatorDefinition:
    """One of Phoenix's built-in evaluators."""

    built_in_evaluator_id: GlobalID

    @classmethod
    def from_orm(
        cls, obj: definition_types.BuiltInEvaluatorDefinition
    ) -> "BuiltInEvaluatorDefinition":
        return cls(
            built_in_evaluator_id=GlobalID("BuiltInEvaluator", str(obj.builtin_evaluator_id))
        )


EvaluatorTaskDefinition = Annotated[
    Union[
        InlineLLMEvaluatorDefinition,
        InlineCodeEvaluatorDefinition,
        StoredCodeEvaluatorDefinition,
        BuiltInEvaluatorDefinition,
    ],
    strawberry.union(name="EvaluatorTaskDefinition"),
]


def to_gql_evaluator_task_definition(
    definition: definition_types.EvaluatorDefinition, evaluator_id: int
) -> EvaluatorTaskDefinition:
    if isinstance(definition, definition_types.InlineLLMEvaluatorDefinition):
        return InlineLLMEvaluatorDefinition.from_orm(definition, evaluator_id)
    if isinstance(definition, definition_types.InlineCodeEvaluatorDefinition):
        return InlineCodeEvaluatorDefinition.from_orm(definition, evaluator_id)
    if isinstance(definition, definition_types.StoredCodeEvaluatorDefinition):
        return StoredCodeEvaluatorDefinition.from_orm(definition)
    if isinstance(definition, definition_types.BuiltInEvaluatorDefinition):
        return BuiltInEvaluatorDefinition.from_orm(definition)
    assert_never(definition)
