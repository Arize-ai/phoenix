import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Path
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID, GlobalIDValueError
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplateV1,
    PromptJSONSchema,
    PromptStringTemplateV1,
    PromptTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolsV1,
)
from phoenix.server.api.routers.v1.pydantic_compat import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody, add_errors_to_responses
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt as PromptNodeType
from phoenix.server.api.types.PromptVersion import PromptVersion as PromptVersionNodeType
from phoenix.server.api.types.PromptVersionTag import PromptVersionTag as PromptVersionTagNodeType

logger = logging.getLogger(__name__)

PROMPT_NODE_NAME = PromptNodeType.__name__
PROMPT_VERSION_NODE_NAME = PromptVersionNodeType.__name__
PROMPT_VERSION_TAG_NODE_NAME = PromptVersionTagNodeType.__name__


router = APIRouter(tags=["prompts"])


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
    if not tag_name:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid tag")
    prompt_id: Optional[int] = None
    prompt_name: Optional[str] = None
    if prompt_identifier:
        try:
            prompt_gid = GlobalID.from_id(prompt_identifier)
        except GlobalIDValueError:
            prompt_name = prompt_identifier
        else:
            try:
                prompt_id = from_global_id_with_expected_type(prompt_gid, PROMPT_NODE_NAME)
            except ValueError:
                prompt_name = prompt_identifier
    else:
        raise HTTPException(HTTP_422_UNPROCESSABLE_ENTITY, "Invalid prompt identifier")
    assert prompt_id is not None or prompt_name is not None
    stmt = (
        select(models.PromptVersion)
        .join_from(models.PromptVersion, models.PromptVersionTag)
        .join_from(models.PromptVersionTag, models.Prompt)
        .where(models.PromptVersionTag.name == tag_name)
    )
    if prompt_name:
        stmt = stmt.where(models.Prompt.name == prompt_name)
    else:
        stmt = stmt.where(models.Prompt.id == prompt_id)
    async with request.app.state.db() as session:
        prompt_version: models.PromptVersion = await session.scalar(stmt)
        if prompt_version is None:
            raise HTTPException(HTTP_404_NOT_FOUND)
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
                id=str(GlobalID(PROMPT_VERSION_NODE_NAME, str(prompt_version.id))),
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
