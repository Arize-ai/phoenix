from __future__ import annotations

import string
from contextlib import AbstractContextManager, nullcontext
from enum import Enum
from secrets import token_hex
from typing import Any, Optional, Union
from urllib.parse import quote_plus

import httpx
import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from openai import pydantic_function_tool
from openai.lib._pydantic import to_strict_json_schema
from pydantic import BaseModel, ValidationError, create_model
from sqlalchemy import select
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptDeepSeekInvocationParameters,
    PromptDeepSeekInvocationParametersContent,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptResponseFormatJSONSchema,
    PromptResponseFormatJSONSchemaDefinition,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
    PromptToolFunction,
    PromptTools,
    TextContentPart,
    ToolCallContentPart,
    ToolCallFunction,
    ToolResultContentPart,
)
from phoenix.server.api.routers.v1.prompts import PromptVersionData
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.types import DbSessionFactory

fake = Faker()


class TestPromptVersionData:
    @pytest.mark.parametrize("template_type", list(PromptTemplateType))
    @pytest.mark.parametrize(
        "template",
        [
            PromptChatTemplate(type="chat", messages=[PromptMessage(role="user", content="hi")]),
            PromptStringTemplate(type="string", template=""),
        ],
    )
    def test_template_type_mismatch(
        self,
        template_type: PromptTemplateType,
        template: Union[PromptChatTemplate, PromptStringTemplate],
    ) -> None:
        expectation: AbstractContextManager[Any] = pytest.raises(ValidationError)
        if template_type == PromptTemplateType.CHAT:
            if template.type == "chat":
                expectation = nullcontext()
        elif template_type == PromptTemplateType.STRING:
            if template.type == "string":
                expectation = nullcontext()
        else:
            assert_never(template_type)
        with expectation:
            PromptVersionData(
                template_type=template_type,
                template_format=PromptTemplateFormat.MUSTACHE,
                template=template,
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai",
                    openai=PromptOpenAIInvocationParametersContent(),
                ),
                model_provider=ModelProvider.OPENAI,
                model_name=token_hex(16),
            )

    def test_rest_body_normalizes_legacy_openai_discriminator(self) -> None:
        legacy = PromptDeepSeekInvocationParameters(
            type="deepseek",
            deepseek=PromptDeepSeekInvocationParametersContent(temperature=0.42),
        )
        pv = PromptVersionData(
            template_type=PromptTemplateType.CHAT,
            template_format=PromptTemplateFormat.MUSTACHE,
            template=PromptChatTemplate(
                type="chat", messages=[PromptMessage(role="user", content="hi")]
            ),
            invocation_parameters=legacy,
            model_provider=ModelProvider.DEEPSEEK,
            model_name=token_hex(16),
        )
        assert isinstance(pv.invocation_parameters, PromptOpenAIInvocationParameters)
        assert pv.invocation_parameters.type == "openai"
        assert pv.invocation_parameters.openai.temperature == 0.42


class TestPrompts:
    async def test_get_latest_prompt_version(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[-1]
        prompt_id = str(GlobalID(Prompt.__name__, str(prompt.id)))
        for prompts_identifier in prompt_id, prompt.name.root:
            url = f"v1/prompts/{quote_plus(prompts_identifier)}/latest"
            assert (response := await httpx_client.get(url)).is_success
            assert isinstance((data := response.json()["data"]), dict)
            self._compare_prompt_version(data, prompt_version)

    async def test_get_prompt_version_by_prompt_version_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[1]
        prompt_version_id = str(GlobalID(PromptVersion.__name__, str(prompt_version.id)))
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}"
        assert (response := await httpx_client.get(url)).is_success
        assert isinstance((data := response.json()["data"]), dict)
        self._compare_prompt_version(data, prompt_version)

    async def test_get_prompt_version_by_tag_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[1]
        tag_name: Identifier = await self._tag_prompt_version(db, prompt_version)
        prompt_id = str(GlobalID(Prompt.__name__, str(prompt.id)))
        for prompts_identifier in prompt_id, prompt.name.root:
            url = f"v1/prompts/{quote_plus(prompts_identifier)}/tags/{quote_plus(tag_name.root)}"
            assert (response := await httpx_client.get(url)).is_success
            assert isinstance((data := response.json()["data"]), dict)
            self._compare_prompt_version(data, prompt_version)

    async def test_delete_prompt_version_tag(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[0]
        tag_name: Identifier = await self._tag_prompt_version(db, prompt_version)
        prompt_version_id = str(GlobalID(PromptVersion.__name__, str(prompt_version.id)))
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags/{quote_plus(tag_name.root)}"
        assert (await httpx_client.delete(url)).status_code == 204
        assert (await httpx_client.delete(url)).status_code == 404

    async def test_delete_prompt_version_tag_not_found(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[0]
        prompt_version_id = str(GlobalID(PromptVersion.__name__, str(prompt_version.id)))
        url = f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags/nonexistent-tag"
        assert (await httpx_client.delete(url)).status_code == 404

    async def test_delete_prompt_version_tag_invalid_version_id(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        url = "v1/prompt_versions/invalid-id/tags/some-tag"
        assert (await httpx_client.delete(url)).status_code == 422

    async def test_delete_prompt_version_tag_invalid_tag_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[0]
        prompt_version_id = str(GlobalID(PromptVersion.__name__, str(prompt_version.id)))
        url = (
            f"v1/prompt_versions/{quote_plus(prompt_version_id)}/tags/{quote_plus('invalid tag!')}"
        )
        assert (await httpx_client.delete(url)).status_code == 422

    async def test_delete_prompt_by_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, _ = await self._insert_prompt_versions(db)
        url = f"v1/prompts/{quote_plus(prompt.name.root)}"
        response = await httpx_client.delete(url)
        assert response.status_code == 204
        async with db() as session:
            assert await session.scalar(select(models.Prompt).filter_by(id=prompt.id)) is None

    async def test_delete_prompt_by_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, _ = await self._insert_prompt_versions(db)
        prompt_id = str(GlobalID(Prompt.__name__, str(prompt.id)))
        url = f"v1/prompts/{quote_plus(prompt_id)}"
        response = await httpx_client.delete(url)
        assert response.status_code == 204
        async with db() as session:
            assert await session.scalar(select(models.Prompt).filter_by(id=prompt.id)) is None

    async def test_delete_prompt_not_found(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        url = "v1/prompts/nonexistent-prompt-name"
        response = await httpx_client.delete(url)
        assert response.status_code == 404

    async def test_create_prompt_version_by_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        request_body = {
            "version": self._prompt_version_request_body(
                prompt_versions[0],
                description="Created by REST",
            )
        }
        url = f"v1/prompts/{quote_plus(prompt.name.root)}/versions"
        response = await httpx_client.post(url, json=request_body)

        assert response.status_code == 201, response.text
        assert isinstance((data := response.json()["data"]), dict)
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(data["id"]), PromptVersion.__name__
        )
        async with db() as session:
            created_version = await session.get(models.PromptVersion, id_)
        assert created_version is not None
        assert created_version.prompt_id == prompt.id
        self._compare_prompt_version(data, created_version)

    async def test_create_prompt_version_by_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        prompt_id = str(GlobalID(Prompt.__name__, str(prompt.id)))
        request_body = {
            "version": self._prompt_version_request_body(
                prompt_versions[1],
                description="Created by prompt ID",
            )
        }
        url = f"v1/prompts/{quote_plus(prompt_id)}/versions"
        response = await httpx_client.post(url, json=request_body)

        assert response.status_code == 201, response.text
        assert isinstance((data := response.json()["data"]), dict)
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(data["id"]), PromptVersion.__name__
        )
        async with db() as session:
            created_version = await session.get(models.PromptVersion, id_)
        assert created_version is not None
        assert created_version.prompt_id == prompt.id
        self._compare_prompt_version(data, created_version)

    async def test_create_prompt_version_with_tags(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        tag_name = Identifier.model_validate("production")
        await self._tag_prompt_version(db, prompt_versions[0], tag_name)
        request_body = {
            "version": self._prompt_version_request_body(
                prompt_versions[1],
                description="Created with tags",
            ),
            "tags": [
                {
                    "name": tag_name.root,
                    "description": "Current production prompt",
                }
            ],
        }
        url = f"v1/prompts/{quote_plus(prompt.name.root)}/versions"
        response = await httpx_client.post(url, json=request_body)

        assert response.status_code == 201, response.text
        assert isinstance((data := response.json()["data"]), dict)
        created_id = from_global_id_with_expected_type(
            GlobalID.from_id(data["id"]), PromptVersion.__name__
        )
        async with db() as session:
            tag = await session.scalar(
                select(models.PromptVersionTag).where(
                    models.PromptVersionTag.prompt_id == prompt.id,
                    models.PromptVersionTag.name == tag_name,
                )
            )
        assert tag is not None
        assert tag.prompt_version_id == created_id
        assert tag.description == "Current production prompt"

    async def test_create_prompt_version_missing_prompt(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, prompt_versions = await self._insert_prompt_versions(db)
        request_body = {"version": self._prompt_version_request_body(prompt_versions[0])}
        response = await httpx_client.post(
            "v1/prompts/nonexistent-prompt-name/versions",
            json=request_body,
        )
        assert response.status_code == 404, response.text

    async def test_create_prompt_version_rejects_invalid_prompt_identifier(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, prompt_versions = await self._insert_prompt_versions(db)
        request_body = {"version": self._prompt_version_request_body(prompt_versions[0])}
        url = f"v1/prompts/{quote_plus('invalid prompt!')}/versions"
        response = await httpx_client.post(url, json=request_body)
        assert response.status_code == 422

    async def test_create_prompt_version_rejects_non_chat_template(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        request_body = {
            "version": self._prompt_version_request_body(
                prompt_versions[0],
                template=PromptStringTemplate(type="string", template="hi"),
                template_type=PromptTemplateType.STRING,
            )
        }
        url = f"v1/prompts/{quote_plus(prompt.name.root)}/versions"
        response = await httpx_client.post(url, json=request_body)
        assert response.status_code == 422

    async def test_create_prompt_version_rejects_invalid_tag_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        request_body = {
            "version": self._prompt_version_request_body(prompt_versions[0]),
            "tags": [{"name": "invalid tag!"}],
        }
        url = f"v1/prompts/{quote_plus(prompt.name.root)}/versions"
        response = await httpx_client.post(url, json=request_body)
        assert response.status_code == 422

    @pytest.mark.parametrize(
        "name",
        [
            "a b c",
            "αβγ",
            *(p for p in string.punctuation if p not in (".", "/")),
            *(f"x{p}y" for p in string.punctuation if p not in ("_", "-", ".", "/")),
        ],
    )
    async def test_invalid_identifier(
        self,
        name: str,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        url = f"v1/prompts/{quote_plus(name)}/tags/production"
        assert (await httpx_client.get(url)).status_code == 422
        url = f"v1/prompts/abc/tags/{quote_plus(name)}"
        assert (await httpx_client.get(url)).status_code == 422

    @staticmethod
    def _compare_prompt_version(
        data: dict[str, Any],
        prompt_version: models.PromptVersion,
    ) -> None:
        data = data.copy()
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(data.pop("id")), PromptVersion.__name__
        )
        assert id_ == prompt_version.id
        assert data.pop("description") == (prompt_version.description or "")
        assert not DeepDiff(
            data.pop("invocation_parameters"),
            prompt_version.invocation_parameters.model_dump(),
        )
        assert data.pop("model_name") == prompt_version.model_name
        assert data.pop("model_provider") == prompt_version.model_provider.value
        if prompt_version.response_format:
            assert not DeepDiff(
                data.pop("response_format"),
                prompt_version.response_format.model_dump(),
            )
        assert data.pop("template") == prompt_version.template.model_dump()
        assert data.pop("template_format") == prompt_version.template_format
        assert data.pop("template_type") == prompt_version.template_type
        if prompt_version.tools:
            assert not DeepDiff(
                data.pop("tools"),
                prompt_version.tools.model_dump(),
            )
        assert not data

    @staticmethod
    def _prompt_version_request_body(
        prompt_version: models.PromptVersion,
        **overrides: Any,
    ) -> dict[str, Any]:
        data = dict(
            description=prompt_version.description,
            model_provider=prompt_version.model_provider,
            model_name=prompt_version.model_name,
            template=prompt_version.template,
            template_type=prompt_version.template_type,
            template_format=prompt_version.template_format,
            invocation_parameters=prompt_version.invocation_parameters,
            tools=prompt_version.tools,
            response_format=prompt_version.response_format,
        )
        data.update(overrides)
        return PromptVersionData(**data).model_dump(
            mode="json",
            by_alias=True,
            exclude_defaults=True,
            exclude_none=True,
        )

    @staticmethod
    async def _tag_prompt_version(
        db: DbSessionFactory,
        prompt_version: models.PromptVersion,
        tag_name: Optional[Identifier] = None,
    ) -> Identifier:
        tag_name = tag_name or Identifier.model_validate(token_hex(16))
        assert tag_name
        async with db() as session:
            prompt_version_tag = models.PromptVersionTag(
                prompt_id=prompt_version.prompt_id,
                prompt_version_id=prompt_version.id,
                name=tag_name,
            )
            session.add(prompt_version_tag)
        return tag_name

    @staticmethod
    async def _insert_prompt_versions(
        db: DbSessionFactory,
        prompt_name: Optional[Identifier] = None,
        n: int = 3,
    ) -> tuple[models.Prompt, list[models.PromptVersion]]:
        prompt_name = prompt_name or Identifier.model_validate(token_hex(16))
        assert prompt_name
        prompt_versions = []
        async with db() as session:
            prompt = models.Prompt(name=prompt_name)
            session.add(prompt)
            await session.flush()
            for _ in range(n):
                template = PromptChatTemplate(
                    type="chat",
                    messages=[
                        PromptMessage(
                            role="user",
                            content=[
                                TextContentPart(
                                    type="text",
                                    text="hi",
                                ),
                                ToolCallContentPart(
                                    type="tool_call",
                                    tool_call_id="1234",
                                    tool_call=ToolCallFunction(
                                        type="function",
                                        name=token_hex(16),
                                        arguments=token_hex(16),
                                    ),
                                ),
                                ToolResultContentPart(
                                    type="tool_result",
                                    tool_call_id="1234",
                                    tool_result={"foo": "bar"},
                                ),
                            ],
                        )
                    ],
                )
                prompt_versions.append(
                    models.PromptVersion(
                        prompt_id=prompt.id,
                        template_type=PromptTemplateType.CHAT,
                        template_format=PromptTemplateFormat.MUSTACHE,
                        template=template,
                        invocation_parameters=PromptOpenAIInvocationParameters(
                            type="openai",
                            openai=PromptOpenAIInvocationParametersContent(
                                temperature=fake.pyfloat(min_value=0, max_value=1),
                                max_tokens=fake.pyint(min_value=1, max_value=1000),
                                top_p=fake.pyfloat(min_value=0, max_value=1),
                                frequency_penalty=fake.pyfloat(min_value=0, max_value=1),
                                presence_penalty=fake.pyfloat(min_value=0, max_value=1),
                            ),
                        ),
                        model_provider=ModelProvider.OPENAI,
                        model_name=token_hex(16),
                        tools=PromptTools(
                            type="tools",
                            tools=[
                                PromptToolFunction.model_validate(
                                    pydantic_function_tool(
                                        _GetWeather, name=token_hex(8), description=token_hex(8)
                                    )
                                )
                            ],
                        ),
                        response_format=PromptResponseFormatJSONSchema(
                            type="json_schema",
                            json_schema=PromptResponseFormatJSONSchemaDefinition(
                                name=token_hex(8),
                                schema=to_strict_json_schema(
                                    create_model("Response", ui=(_UI, ...))
                                ),
                            ),
                        ),
                    )
                )
            session.add_all(prompt_versions)
        return prompt, prompt_versions


class _GetWeather(BaseModel):
    city: str
    country: str


class _UIType(str, Enum):
    div = "div"
    button = "button"
    header = "header"
    section = "section"
    field = "field"
    form = "form"


class _Attribute(BaseModel):
    name: str
    value: str


class _UI(BaseModel):
    type: _UIType
    label: str
    children: list[_UI]
    attributes: list[_Attribute]


_UI.model_rebuild()
