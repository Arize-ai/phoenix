from datetime import datetime
from typing import Optional

import strawberry
from sqlalchemy import select
from strawberry import Private
from strawberry.relay import Node, NodeID
from strawberry.scalars import JSON
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.prompts.models import (
    PromptTemplateFormat,
    PromptTemplateType,
    denormalize_response_format,
    denormalize_tools,
    get_raw_invocation_parameters,
)
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag, to_gql_prompt_version_tag
from phoenix.server.api.types.PromptVersionTemplate import (
    PromptTemplate,
    to_gql_template_from_orm,
)

from .ResponseFormat import ResponseFormat
from .ToolDefinition import ToolDefinition
from .User import User, to_gql_user


@strawberry.type
class PromptVersion(Node):
    id_attr: NodeID[int]
    user_id: strawberry.Private[Optional[int]]
    description: Optional[str]
    template_type: PromptTemplateType
    template_format: PromptTemplateFormat
    template: PromptTemplate
    invocation_parameters: Optional[JSON] = None
    tools: list[ToolDefinition]
    response_format: Optional[ResponseFormat] = None
    model_name: str
    model_provider: ModelProvider
    metadata: JSON
    created_at: datetime
    cached_sequence_number: Private[Optional[int]] = None

    @strawberry.field
    async def tags(self, info: Info[Context, None]) -> list[PromptVersionTag]:
        async with info.context.db() as session:
            stmt = select(models.PromptVersionTag).where(
                models.PromptVersionTag.prompt_version_id == self.id_attr
            )
            return [
                to_gql_prompt_version_tag(tag) async for tag in await session.stream_scalars(stmt)
            ]

    @strawberry.field
    async def user(self, info: Info[Context, None]) -> Optional[User]:
        if self.user_id is None:
            return None
        async with info.context.db() as session:
            user = await session.get(models.User, self.user_id)
        return to_gql_user(user) if user is not None else None

    @strawberry.field
    async def previous_version(self, info: Info[Context, None]) -> Optional["PromptVersion"]:
        async with info.context.db() as session:
            current_version = await session.get(models.PromptVersion, self.id_attr)
            if current_version is None:
                return None

            prompt_id = current_version.prompt_id

            stmt = (
                select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == prompt_id)
                .where(models.PromptVersion.id < self.id_attr)
                .order_by(models.PromptVersion.created_at.desc())
                .limit(1)
            )
            previous_version = await session.scalar(stmt)

            if previous_version is not None:
                return to_gql_prompt_version(prompt_version=previous_version)
            return None

    @strawberry.field(
        description="Sequence number (1-based) of prompt versions belonging to the same prompt"
    )  # type: ignore
    async def sequence_number(
        self,
        info: Info[Context, None],
    ) -> int:
        if self.cached_sequence_number is None:
            seq_num = await info.context.data_loaders.prompt_version_sequence_number.load(
                self.id_attr
            )
            if seq_num is None:
                raise ValueError(f"invalid prompt version: id={self.id_attr}")
            self.cached_sequence_number = seq_num
        return self.cached_sequence_number


def to_gql_prompt_version(
    prompt_version: models.PromptVersion, sequence_number: Optional[int] = None
) -> PromptVersion:
    prompt_template_type = PromptTemplateType(prompt_version.template_type)
    prompt_template = to_gql_template_from_orm(prompt_version)
    prompt_template_format = PromptTemplateFormat(prompt_version.template_format)
    tool_choice = None
    if prompt_version.tools is not None:
        tool_schemas, tool_choice = denormalize_tools(
            prompt_version.tools, prompt_version.model_provider
        )
        tools = [ToolDefinition(definition=schema) for schema in tool_schemas]
    else:
        tools = []
    response_format = (
        ResponseFormat(
            definition=denormalize_response_format(
                prompt_version.response_format,
                prompt_version.model_provider,
            )
        )
        if prompt_version.response_format is not None
        else None
    )
    invocation_parameters = get_raw_invocation_parameters(prompt_version.invocation_parameters)
    if tool_choice is not None:
        invocation_parameters["tool_choice"] = tool_choice
    return PromptVersion(
        id_attr=prompt_version.id,
        user_id=prompt_version.user_id,
        description=prompt_version.description,
        template_type=prompt_template_type,
        template_format=prompt_template_format,
        template=prompt_template,
        invocation_parameters=invocation_parameters,
        tools=tools,
        response_format=response_format,
        model_name=prompt_version.model_name,
        model_provider=prompt_version.model_provider,
        metadata=prompt_version.metadata_,
        created_at=prompt_version.created_at,
        cached_sequence_number=sequence_number,
    )
