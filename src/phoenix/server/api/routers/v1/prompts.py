import logging
from typing import Any, Optional, Union

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.sql import Select
from starlette.requests import Request
from starlette.status import HTTP_204_NO_CONTENT, HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
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
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt as PromptNodeType
from phoenix.server.api.types.PromptVersion import PromptVersion as PromptVersionNodeType
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag as PromptVersionTagNodeType
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


class GetPromptsResponseBody(PaginatedResponseBody[Prompt]):
    pass


class GetPromptVersionsResponseBody(PaginatedResponseBody[PromptVersion]):
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
    summary="List all prompts",
    description="Retrieve a paginated list of all prompts in the system. A prompt can have "
    "multiple versions.",
    response_description="A list of prompts with pagination information",
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
    """
    Retrieve a paginated list of all prompts in the system.

    Args:
        request (Request): The FastAPI request object.
        cursor (Optional[str]): Pagination cursor (base64-encoded prompt ID).
        limit (int): Maximum number of prompts to return per request.

    Returns:
        GetPromptsResponseBody: Response containing a list of prompts and pagination information.

    Raises:
        HTTPException: If the cursor format is invalid.
    """
    async with request.app.state.db() as session:
        # First check if any prompts exist
        if not cursor:
            prompt_exists = await session.scalar(select(models.Prompt.id).limit(1))
            if not prompt_exists:
                return GetPromptsResponseBody(next_cursor=None, data=[])

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
    summary="List prompt versions",
    description="Retrieve all versions of a specific prompt with pagination support. Each prompt "
    "can have multiple versions with different configurations.",
    response_description="A list of prompt versions with pagination information",
    responses=add_errors_to_responses([HTTP_422_UNPROCESSABLE_ENTITY, HTTP_404_NOT_FOUND]),
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
    """
    List all versions of a specific prompt with pagination support.

    Args:
        request (Request): The FastAPI request object.
        prompt_identifier (str): The identifier of the prompt (name or ID).
        cursor (Optional[str]): Pagination cursor (base64-encoded promptVersion ID).
        limit (int): Maximum number of prompt versions to return per request.

    Returns:
        GetPromptVersionsResponseBody: Response containing a list of prompt versions and pagination
            information.

    Raises:
        HTTPException: If the cursor format is invalid, the prompt identifier is invalid,
            or the prompt is not found.
    """
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
    summary="Get prompt version by ID",
    description="Retrieve a specific prompt version using its unique identifier. A prompt version "
    "contains the actual template and configuration.",
    response_description="The requested prompt version",
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
    """
    Retrieve a specific prompt version by its ID.

    Args:
        request (Request): The FastAPI request object.
        prompt_version_id (str): The ID of the prompt version to retrieve.

    Returns:
        GetPromptResponseBody: Response containing the requested prompt version.

    Raises:
        HTTPException: If the prompt version ID is invalid or the prompt version is not found.
    """
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
    summary="Get prompt version by tag",
    description="Retrieve a specific prompt version using its tag name. Tags are used to identify "
    "specific versions of a prompt.",
    response_description="The prompt version with the specified tag",
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
    """
    Retrieve a specific prompt version by its tag name.

    Args:
        request (Request): The FastAPI request object.
        prompt_identifier (str): The identifier of the prompt (name or ID).
        tag_name (str): The tag name associated with the prompt version.

    Returns:
        GetPromptResponseBody: Response containing the prompt version with the specified tag.

    Raises:
        HTTPException: If the tag name is invalid or the prompt version is not found.
    """
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
    summary="Get latest prompt version",
    description="Retrieve the most recent version of a specific prompt.",
    response_description="The latest version of the specified prompt",
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
    """
    Retrieve the latest version of a specific prompt.

    Args:
        request (Request): The FastAPI request object.
        prompt_identifier (str): The identifier of the prompt (name or ID).

    Returns:
        GetPromptResponseBody: Response containing the latest prompt version.

    Raises:
        HTTPException: If the prompt identifier is invalid or no prompt version is found.
    """
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
    summary="Create a new prompt",
    description="Create a new prompt and its initial version. A prompt can have multiple versions.",
    response_description="The newly created prompt version",
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
    """
    Create a new prompt and its initial version.

    Args:
        request (Request): The FastAPI request object.
        request_body (CreatePromptRequestBody): The request body containing prompt and version data.

    Returns:
        CreatePromptResponseBody: Response containing the created prompt version.

    Raises:
        HTTPException: If the template type is not supported, the name identifier is invalid,
                      or any other validation error occurs.
    """
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


class PromptVersionTagData(V1RoutesBaseModel):
    name: Identifier
    description: Optional[str] = None


class PromptVersionTag(PromptVersionTagData):
    id: str


class GetPromptVersionTagsResponseBody(PaginatedResponseBody[PromptVersionTag]):
    pass


@router.get(
    "/prompt_versions/{prompt_version_id}/tags",
    operation_id="getPromptVersionTags",
    summary="List prompt version tags",
    description="Retrieve all tags associated with a specific prompt version. Tags are used to "
    "identify and categorize different versions of a prompt.",
    response_description="A list of tags associated with the prompt version",
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
async def list_prompt_version_tags(
    request: Request,
    prompt_version_id: str = Path(description="The ID of the prompt version."),
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (base64-encoded promptVersionTag ID)",
    ),
    limit: int = Query(
        default=100, description="The max number of tags to return at a time.", gt=0
    ),
) -> GetPromptVersionTagsResponseBody:
    """
    Get tags for a specific prompt version.

    Args:
        request (Request): The request object.
        prompt_version_id (str): The ID of the prompt version.
        cursor (Optional[str]): Pagination cursor (base64-encoded promptVersionTag ID).
        limit (int): Maximum number of tags to return per request.

    Returns:
        GetPromptVersionTagsResponseBody: The response body containing the tags.

    Raises:
        HTTPException: If the prompt version ID is invalid, the prompt version is not found,
            or the cursor format is invalid.
    """
    try:
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(prompt_version_id),
            PromptVersionNodeType.__name__,
        )
    except ValueError:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid prompt version ID")

    # Build the query for tags
    stmt = (
        select(
            models.PromptVersion.id,
            models.PromptVersionTag.id,
            models.PromptVersionTag.name,
            models.PromptVersionTag.description,
        )
        .outerjoin_from(models.PromptVersion, models.PromptVersionTag)
        .where(models.PromptVersion.id == id_)
        .order_by(models.PromptVersionTag.id.desc())
    )

    # Apply cursor-based pagination
    if cursor:
        try:
            cursor_id = GlobalID.from_id(cursor).node_id
            stmt = stmt.filter(models.PromptVersionTag.id <= int(cursor_id))
        except ValueError:
            raise HTTPException(
                detail=f"Invalid cursor format: {cursor}",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )

    # Apply limit
    stmt = stmt.limit(limit + 1)

    async with request.app.state.db() as session:
        result = (await session.execute(stmt)).all()

    # Check if prompt version exists
    if not result:
        raise HTTPException(HTTP_404_NOT_FOUND, "Prompt version not found")

    # Check if there are any tags
    has_tags = any(id_ is not None for _, id_, _, _ in result)
    if not has_tags:
        return GetPromptVersionTagsResponseBody(next_cursor=None, data=[])

    # Check if there are more results
    next_cursor = None
    if len(result) == limit + 1:
        # Remove the extra item used for pagination
        result = result[:-1]
        # Get the ID of the last item for the next cursor
        last_tag_id = result[-1][1]  # The second element is the tag ID
        if last_tag_id is not None:
            next_cursor = str(GlobalID(PromptVersionTagNodeType.__name__, str(last_tag_id)))

    # Convert to response format
    data = [
        PromptVersionTag(
            id=str(GlobalID(PromptVersionTagNodeType.__name__, str(id_))),
            name=name,
            description=description,
        )
        for _, id_, name, description in result
        if id_ is not None
    ]

    return GetPromptVersionTagsResponseBody(next_cursor=next_cursor, data=data)


@router.post(
    "/prompt_versions/{prompt_version_id}/tags",
    operation_id="createPromptVersionTag",
    summary="Add tag to prompt version",
    description="Add a new tag to a specific prompt version. Tags help identify and categorize "
    "different versions of a prompt.",
    response_description="No content returned on successful tag creation",
    status_code=HTTP_204_NO_CONTENT,
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
async def create_prompt_version_tag(
    request: Request,
    request_body: PromptVersionTagData,
    prompt_version_id: str = Path(description="The ID of the prompt version."),
) -> None:
    """
    Add a tag to a specific prompt version.

    Args:
        request (Request): The FastAPI request object.
        request_body (PromptVersionTagData): The tag data to be added.
        prompt_version_id (str): The ID of the prompt version to tag.

    Returns:
        None: Returns a 204 No Content response on success.

    Raises:
        HTTPException: If the prompt version ID is invalid, the prompt version is not found,
            or any other validation error occurs.
    """
    try:
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(prompt_version_id),
            PromptVersionNodeType.__name__,
        )
    except ValueError:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid prompt version ID")
    user_id: Optional[int] = None
    if request.app.state.authentication_enabled:
        assert isinstance(user := request.user, PhoenixUser)
        user_id = int(user.identity)
    async with request.app.state.db() as session:
        prompt_id = await session.scalar(select(models.PromptVersion.prompt_id).filter_by(id=id_))
        if prompt_id is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        values = dict(
            name=request_body.name,
            description=request_body.description,
            prompt_id=prompt_id,
            prompt_version_id=id_,
            user_id=user_id,
        )
        await session.execute(
            insert_on_conflict(
                values,
                dialect=dialect,
                table=models.PromptVersionTag,
                unique_by=("name", "prompt_id"),
                on_conflict=OnConflict.DO_UPDATE,
            )
        )
    return None


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
