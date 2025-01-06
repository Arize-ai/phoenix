from secrets import token_hex

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.types import DbSessionFactory


class TestPrompts:
    async def test_get_prompt_version_by_tag_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt_name = token_hex(16)
        prompt_versions = []

        async with db() as session:
            prompt = models.Prompt(name=prompt_name)
            session.add(prompt)
            await session.flush()
            for _ in range(3):
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

        prompt_version = prompt_versions[1]
        tag_name = token_hex(16)
        async with db() as session:
            prompt_version_tag = models.PromptVersionTag(
                prompt_id=prompt.id,
                prompt_version_id=prompt_version.id,
                name=tag_name,
            )
            session.add(prompt_version_tag)

        prompt_id = str(GlobalID(Prompt.__name__, str(prompt.id)))
        for prompts_identifier in prompt_id, prompt_name:
            response = await httpx_client.get(
                f"/v1/prompts/{prompts_identifier}/tags/{tag_name}",
            )
            assert response.is_success
            assert isinstance((data := response.json()["data"]), dict)
            assert (
                from_global_id_with_expected_type(
                    GlobalID.from_id(data.pop("id")),
                    PromptVersion.__name__,
                )
                == prompt_version.id
            )
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
