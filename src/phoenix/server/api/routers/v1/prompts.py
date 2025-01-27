import logging
from typing import Any, Optional, Union

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import Field, ValidationError
from sqlalchemy import select
from sqlalchemy.sql import Select
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptJSONSchema,
    PromptStringTemplateV1,
    PromptTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolsV1,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody, add_errors_to_responses
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt as PromptNodeType
from phoenix.server.api.types.PromptVersion import PromptVersion as PromptVersionNodeType

logger = logging.getLogger(__name__)


class Prompt(V1RoutesBaseModel):
    id: str
    source_prompt_id: Optional[str]
    name: str
    description: Optional[str]


class PromptVersion(V1RoutesBaseModel):
    id: str
    description: str
    model_provider: str
    model_name: str
    template: PromptTemplate
    template_type: PromptTemplateType = Field(default=PromptTemplateType.CHAT)
    template_format: PromptTemplateFormat = Field(default=PromptTemplateFormat.MUSTACHE)
    invocation_parameters: dict[str, Any] = Field(default_factory=dict)
    tools: Optional[PromptToolsV1] = None
    output_schema: Optional[PromptJSONSchema] = None


class GetPromptResponseBody(ResponseBody[PromptVersion]):
    pass


class GetPromptsResponseBody(ResponseBody[list[Prompt]]):
    pass


router = APIRouter(tags=["prompts"])


@router.get(
    "/prompts",
    operation_id="getPrompts",
    summary="Get all prompts",
    responses=add_errors_to_responses(
        [
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def get_prompts(
    request: Request,
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded prompt ID)",
    ),
    limit: int = Query(
        default=100, description="The max number of prompts to return at a time.", gt=0
    ),
) -> GetPromptsResponseBody:
    async with request.app.state.db() as session:
        query = select(models.Prompt).order_by(models.Prompt.id.desc())

        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                query = query.filter(models.Prompt.id <= int(cursor_id))
            except ValueError:
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                )

        query = query.limit(limit + 1)
        result = await session.execute(query)
        orm_prompts = result.scalars().all()

        if not orm_prompts:
            return GetPromptsResponseBody(next_cursor=None, data=[])

        next_cursor = None
        if len(orm_prompts) == limit + 1:
            last_prompt = orm_prompts[-1]
            next_cursor = str(GlobalID(PromptNodeType.__name__, str(last_prompt.id)))
            orm_prompts = orm_prompts[:-1]

        prompts = [_prompt_from_orm_prompt(orm_prompt) for orm_prompt in orm_prompts]
    return GetPromptsResponseBody(next_cursor=next_cursor, data=prompts)


@router.get(
    "/prompt_versions/{prompt_version_id}",
    operation_id="getPromptVersionByPromptVersionId",
    summary="Get prompt by prompt version ID",
    responses=add_errors_to_responses(
        [
            HTTP_404_NOT_FOUND,
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def get_prompt_version_by_prompt_version_id(
    request: Request,
    prompt_version_id: str = Path(description="The ID of the prompt version."),
) -> GetPromptResponseBody:
    try:
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(prompt_version_id),
            PromptVersionNodeType.__name__,
        )
    except ValueError:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid prompt version ID")
    async with request.app.state.db() as session:
        prompt_version = await session.get(models.PromptVersion, id_)
        if prompt_version is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
    return _prompt_version_response_body(prompt_version)


@router.get(
    "/prompts/{prompt_identifier}/tags/{tag_name}",
    operation_id="getPromptVersionByTagName",
    summary="Get prompt by tag name",
    responses=add_errors_to_responses(
        [
            HTTP_404_NOT_FOUND,
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def get_prompt_version_by_tag_name(
    request: Request,
    prompt_identifier: str = Path(description="The identifier of the prompt, i.e. name or ID."),
    tag_name: str = Path(description="The tag of the prompt version"),
) -> GetPromptResponseBody:
    try:
        name = Identifier.model_validate(tag_name)
    except ValidationError:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid tag name")
    stmt = (
        select(models.PromptVersion)
        .join_from(models.PromptVersion, models.PromptVersionTag)
        .join_from(models.PromptVersionTag, models.Prompt)
        .where(models.PromptVersionTag.name == name)
    )
    stmt = _filter_by_prompt_identifier(stmt, prompt_identifier)
    async with request.app.state.db() as session:
        prompt_version: models.PromptVersion = await session.scalar(stmt)
        if prompt_version is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
    return _prompt_version_response_body(prompt_version)


@router.get(
    "/prompts/{prompt_identifier}/latest",
    operation_id="getPromptVersionLatest",
    summary="Get the latest prompt version",
    responses=add_errors_to_responses(
        [
            HTTP_404_NOT_FOUND,
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
)
async def get_prompt_version_by_latest(
    request: Request,
    prompt_identifier: str = Path(description="The identifier of the prompt, i.e. name or ID."),
) -> GetPromptResponseBody:
    stmt = select(models.PromptVersion).order_by(models.PromptVersion.id.desc()).limit(1)
    stmt = _filter_by_prompt_identifier(stmt, prompt_identifier)
    async with request.app.state.db() as session:
        prompt_version: models.PromptVersion = await session.scalar(stmt)
        if prompt_version is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
    return _prompt_version_response_body(prompt_version)


class _PromptId(int): ...


_PromptIdentifier: TypeAlias = Union[_PromptId, Identifier]


def _parse_prompt_identifier(
    prompt_identifier: str,
) -> _PromptIdentifier:
    if not prompt_identifier:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid prompt identifier")
    try:
        prompt_id = from_global_id_with_expected_type(
            GlobalID.from_id(prompt_identifier),
            PromptNodeType.__name__,
        )
    except ValueError:
        try:
            return Identifier.model_validate(prompt_identifier)
        except ValidationError:
            raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid prompt name")
    return _PromptId(prompt_id)


def _filter_by_prompt_identifier(
    stmt: Select[tuple[models.PromptVersion]],
    prompt_identifier: str,
) -> Any:
    identifier = _parse_prompt_identifier(prompt_identifier)
    if isinstance(identifier, _PromptId):
        return stmt.where(models.Prompt.id == int(identifier))
    if isinstance(identifier, Identifier):
        return stmt.where(models.Prompt.name == identifier)
    assert_never(identifier)


def _prompt_version_response_body(
    prompt_version: models.PromptVersion,
) -> GetPromptResponseBody:
    prompt_template_type = PromptTemplateType(prompt_version.template_type)
    template: PromptTemplate
    if prompt_template_type is PromptTemplateType.CHAT:
        template = PromptChatTemplateV1.model_validate(prompt_version.template)
    elif prompt_template_type is PromptTemplateType.STRING:
        template = PromptStringTemplateV1.model_validate(prompt_version.template)
    else:
        assert_never(prompt_template_type)
    prompt_template_format = PromptTemplateFormat(prompt_version.template_format)
    tools = (
        PromptToolsV1.model_validate(prompt_version.tools)
        if prompt_version.tools is not None
        else None
    )
    output_schema = (
        PromptJSONSchema.model_validate(prompt_version.output_schema)
        if prompt_version.output_schema is not None
        else None
    )
    return GetPromptResponseBody(
        data=PromptVersion(
            id=str(GlobalID(PromptVersionNodeType.__name__, str(prompt_version.id))),
            description=prompt_version.description or "",
            model_provider=prompt_version.model_provider,
            model_name=prompt_version.model_name,
            template=template,
            template_type=prompt_template_type,
            template_format=prompt_template_format,
            invocation_parameters=prompt_version.invocation_parameters,
            tools=tools,
            output_schema=output_schema,
        )
    )


def _prompt_from_orm_prompt(orm_prompt: models.Prompt) -> Prompt:
    source_prompt_id = (
        str(GlobalID(PromptNodeType.__name__, str(orm_prompt.source_prompt_id)))
        if orm_prompt.source_prompt_id
        else None
    )
    return Prompt(
        id=str(GlobalID(PromptNodeType.__name__, str(orm_prompt.id))),
        source_prompt_id=source_prompt_id,
        name=orm_prompt.name,
        description=orm_prompt.description,
    )
