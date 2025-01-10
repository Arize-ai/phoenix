from secrets import token_hex
from typing import Any, Optional
from urllib.parse import quote_plus

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.types import DbSessionFactory


class TestPrompts:
    async def test_get_prompt_version_by_prompt_version_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt, prompt_versions = await self._insert_prompt_versions(db)
        prompt_version = prompt_versions[1]
        prompt_version_id = str(GlobalID(PromptVersion.__name__, str(prompt_version.id)))
        url = f"/v1/prompt_versions/{quote_plus(prompt_version_id)}"
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
        tag_name: str = await self._tag_prompt_version(db, prompt_version)
        prompt_id = str(GlobalID(Prompt.__name__, str(prompt.id)))
        for prompts_identifier in prompt_id, prompt.name:
            url = f"/v1/prompts/{quote_plus(prompts_identifier)}/tags/{quote_plus(tag_name)}"
            assert (response := await httpx_client.get(url)).is_success
            assert isinstance((data := response.json()["data"]), dict)
            self._compare_prompt_version(data, prompt_version)

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
        assert data.pop("invocation_parameters") == prompt_version.invocation_parameters
        assert data.pop("model_name") == prompt_version.model_name
        assert data.pop("model_provider") == prompt_version.model_provider
        assert data.pop("output_schema") == prompt_version.output_schema
        assert data.pop("template") == prompt_version.template
        assert data.pop("template_format") == prompt_version.template_format
        assert data.pop("template_type") == prompt_version.template_type
        assert data.pop("tools") == prompt_version.tools
        assert not data

    @staticmethod
    async def _tag_prompt_version(
        db: DbSessionFactory,
        prompt_version: models.PromptVersion,
        tag_name: Optional[str] = None,
    ) -> str:
        tag_name = tag_name or token_hex(16)
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
        prompt_name: Optional[str] = None,
        n: int = 3,
    ) -> tuple[models.Prompt, list[models.PromptVersion]]:
        prompt_name = prompt_name or token_hex(16)
        assert prompt_name
        prompt_versions = []
        async with db() as session:
            prompt = models.Prompt(name=prompt_name)
            session.add(prompt)
            await session.flush()
            for _ in range(n):
                prompt_versions.append(
                    models.PromptVersion(
                        prompt_id=prompt.id,
                        template_type="CHAT",
                        template_format="MUSTACHE",
                        template={"messages": [{"role": "USER", "content": "hi"}]},
                        invocation_parameters={},
                        model_provider=token_hex(16),
                        model_name=token_hex(16),
                    )
                )
            session.add_all(prompt_versions)
        return prompt, prompt_versions