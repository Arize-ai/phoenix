import logging
from typing import Any, Optional, Union

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.sql import Select
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never

from phoenix.db import models
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
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody, add_errors_to_responses
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt as PromptNodeType
from phoenix.server.api.types.PromptVersion import PromptVersion as PromptVersionNodeType
from phoenix.server.bearer_auth import PhoenixUser

logger = logging.getLogger(__name__)


class PromptData(V1RoutesBaseModel):
    name: Identifier
    description: Optional[str] = None
    source_prompt_id: Optional[str] = None


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


class GetPromptResponseBody(ResponseBody[PromptVersion]):
    pass


class GetPromptsResponseBody(ResponseBody[list[Prompt]]):
    pass


class GetPromptVersionsResponseBody(ResponseBody[list[PromptVersion]]):
    pass


class CreatePromptRequestBody(V1RoutesBaseModel):
    prompt: PromptData
    version: PromptVersionData


class CreatePromptResponseBody(ResponseBody[PromptVersion]):
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
    "/prompts/{prompt_identifier}/versions",
    operation_id="listPromptVersions",
    summary="List all prompt versions for a given prompt",
    responses=add_errors_to_responses([HTTP_422_UNPROCESSABLE_ENTITY]),
    response_model_by_alias=True,
    response_model_exclude_defaults=True,
    response_model_exclude_unset=True,
)
async def list_prompt_versions(
    request: Request,
    prompt_identifier: str = Path(description="The identifier of the prompt, i.e. name or ID."),
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded promptVersion ID)",
    ),
    limit: int = Query(
        default=100, description="The max number of prompt versions to return at a time.", gt=0
    ),
) -> GetPromptVersionsResponseBody:
    query = select(models.PromptVersion)
    query = _filter_by_prompt_identifier(query.join(models.Prompt), prompt_identifier)
    query = query.order_by(models.PromptVersion.id.desc())

    async with request.app.state.db() as session:
        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                query = query.filter(models.PromptVersion.id <= int(cursor_id))
            except ValueError:
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                )

        query = query.limit(limit + 1)
        result = await session.execute(query)
        orm_versions = result.scalars().all()

        if not orm_versions:
            return GetPromptVersionsResponseBody(next_cursor=None, data=[])

        next_cursor = None
        if len(orm_versions) == limit + 1:
            last_version = orm_versions[-1]
            next_cursor = str(GlobalID(PromptVersionNodeType.__name__, str(last_version.id)))
            orm_versions = orm_versions[:-1]

        versions = [_prompt_version_from_orm_version(orm_version) for orm_version in orm_versions]
        return GetPromptVersionsResponseBody(next_cursor=next_cursor, data=versions)


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
    response_model_by_alias=True,
    response_model_exclude_defaults=True,
    response_model_exclude_unset=True,
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
    data = _prompt_version_from_orm_version(prompt_version)
    return GetPromptResponseBody(data=data)


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
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
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
        .where(models.PromptVersionTag.name == name)
    )
    stmt = _filter_by_prompt_identifier(stmt.join(models.Prompt), prompt_identifier)
    async with request.app.state.db() as session:
        prompt_version: models.PromptVersion = await session.scalar(stmt)
        if prompt_version is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
    data = _prompt_version_from_orm_version(prompt_version)
    return GetPromptResponseBody(data=data)


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
    response_model_by_alias=True,
    response_model_exclude_defaults=True,
    response_model_exclude_unset=True,
)
async def get_prompt_version_by_latest(
    request: Request,
    prompt_identifier: str = Path(description="The identifier of the prompt, i.e. name or ID."),
) -> GetPromptResponseBody:
    stmt = select(models.PromptVersion).order_by(models.PromptVersion.id.desc()).limit(1)
    stmt = _filter_by_prompt_identifier(stmt.join(models.Prompt), prompt_identifier)
    async with request.app.state.db() as session:
        prompt_version: models.PromptVersion = await session.scalar(stmt)
        if prompt_version is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
    data = _prompt_version_from_orm_version(prompt_version)
    return GetPromptResponseBody(data=data)


@router.post(
    "/prompts",
    operation_id="postPromptVersion",
    summary="Create a prompt version",
    responses=add_errors_to_responses(
        [
            HTTP_422_UNPROCESSABLE_ENTITY,
        ]
    ),
    response_model_by_alias=True,
    response_model_exclude_defaults=True,
    response_model_exclude_unset=True,
)
async def create_prompt(
    request: Request,
    request_body: CreatePromptRequestBody,
) -> CreatePromptResponseBody:
    if (
        request_body.version.template.type.lower() != "chat"
        or request_body.version.template_type != PromptTemplateType.CHAT
    ):
        raise HTTPException(
            HTTP_422_UNPROCESSABLE_ENTITY,
            "Only CHAT template type is supported for prompts",
        )
    prompt = request_body.prompt
    try:
        name = Identifier.model_validate(prompt.name)
    except ValidationError as e:
        raise HTTPException(
            HTTP_422_UNPROCESSABLE_ENTITY,
            "Invalid name identifier for prompt: " + e.errors()[0]["msg"],
        )
    version = request_body.version
    user_id: Optional[int] = None
    if request.app.state.authentication_enabled:
        assert isinstance(user := request.user, PhoenixUser)
        user_id = int(user.identity)
    async with request.app.state.db() as session:
        if not (prompt_id := await session.scalar(select(models.Prompt.id).filter_by(name=name))):
            prompt_orm = models.Prompt(
                name=name,
                description=prompt.description,
            )
            session.add(prompt_orm)
            await session.flush()
            prompt_id = prompt_orm.id
        version_orm = models.PromptVersion(
            user_id=user_id,
            prompt_id=prompt_id,
            description=version.description,
            model_provider=version.model_provider,
            model_name=version.model_name,
            template_type=version.template_type,
            template_format=version.template_format,
            template=version.template,
            invocation_parameters=version.invocation_parameters,
            tools=version.tools,
            response_format=version.response_format,
        )
        session.add(version_orm)
    data = _prompt_version_from_orm_version(version_orm)
    return CreatePromptResponseBody(data=data)


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


def _prompt_version_from_orm_version(
    prompt_version: models.PromptVersion,
) -> PromptVersion:
    prompt_template_type = PromptTemplateType(prompt_version.template_type)
    prompt_template_format = PromptTemplateFormat(prompt_version.template_format)
    return PromptVersion(
        id=str(GlobalID(PromptVersionNodeType.__name__, str(prompt_version.id))),
        description=prompt_version.description or "",
        model_provider=prompt_version.model_provider,
        model_name=prompt_version.model_name,
        template=prompt_version.template,
        template_type=prompt_template_type,
        template_format=prompt_template_format,
        invocation_parameters=prompt_version.invocation_parameters,
        tools=prompt_version.tools,
        response_format=prompt_version.response_format,
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
