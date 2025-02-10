from __future__ import annotations

import string
from enum import Enum
from secrets import token_hex
from typing import Any, Optional, cast
from urllib.parse import quote_plus

import httpx
import pytest
from deepdiff.diff import DeepDiff
from faker import Faker
from openai.lib._pydantic import to_strict_json_schema
from pydantic import BaseModel, create_model
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.jsonschema import (
    JSONSchemaDraft7ObjectSchema,
    JSONSchemaDraft7ObjectSchemaContent,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptFunctionTool,
    PromptMessage,
    PromptMessageRole,
    PromptResponseFormatJSONSchema,
    PromptTools,
    TextContentPart,
    TextContentValue,
    ToolCallContentPart,
    ToolCallContentValue,
    ToolCallFunction,
    ToolResultContentPart,
    ToolResultContentValue,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.types import DbSessionFactory

fake = Faker()


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
            prompt_version.invocation_parameters,
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
                            role=PromptMessageRole.USER,
                            content=[
                                TextContentPart(
                                    type="text",
                                    text=TextContentValue(text="hi"),
                                ),
                                ToolCallContentPart(
                                    type="tool_call",
                                    tool_call=ToolCallContentValue(
                                        tool_call_id="1234",
                                        tool_call=ToolCallFunction(
                                            type="function",
                                            name=token_hex(16),
                                            arguments=token_hex(16),
                                        ),
                                    ),
                                ),
                                ToolResultContentPart(
                                    type="tool_result",
                                    tool_result=ToolResultContentValue(
                                        tool_call_id="1234", result={"foo": "bar"}
                                    ),
                                ),
                            ],
                        )
                    ],
                )
                prompt_versions.append(
                    models.PromptVersion(
                        prompt_id=prompt.id,
                        template_type="CHAT",
                        template_format="MUSTACHE",
                        template=template,
                        invocation_parameters=fake.pydict(value_types=[str, int, float, bool]),
                        model_provider=ModelProvider.OPENAI,
                        model_name=token_hex(16),
                        tools=PromptTools(
                            type="tools",
                            tools=[
                                PromptFunctionTool(
                                    type="function-tool",
                                    name=token_hex(8),
                                    schema=JSONSchemaDraft7ObjectSchema(
                                        type="json-schema-draft-7-object-schema",
                                        json=cast(
                                            JSONSchemaDraft7ObjectSchemaContent,
                                            to_strict_json_schema(_GetWeather),
                                        ),
                                    ),
                                )
                            ],
                        ),
                        response_format=PromptResponseFormatJSONSchema(
                            type="response-format-json-schema",
                            name=token_hex(8),
                            extra_parameters=fake.pydict(value_types=[str, int, float, bool]),
                            schema=JSONSchemaDraft7ObjectSchema(
                                type="json-schema-draft-7-object-schema",
                                json=cast(
                                    JSONSchemaDraft7ObjectSchemaContent,
                                    to_strict_json_schema(create_model("Response", ui=(_UI, ...))),
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
