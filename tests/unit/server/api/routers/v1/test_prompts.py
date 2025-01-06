from secrets import token_hex

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.types import DbSessionFactory


class TestPromptsEndpoint:
    async def test_get_prompt_version_by_tag_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        prompt_name = token_hex(16)
        tag_name = token_hex(16)
        model_provider = token_hex(16)
        model_name = token_hex(16)
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
                        model_provider=model_provider,
                        model_name=model_name,
                    )
                )
            session.add_all(prompt_versions)
            await session.flush()
            prompt_version_tag = models.PromptVersionTag(
                prompt_id=prompt.id,
                prompt_version_id=prompt_versions[1].id,
                name=tag_name,
            )
            session.add(prompt_version_tag)

        prompt_version = prompt_versions[1]
        for prompts_identifier in GlobalID(Prompt.__name__, str(prompt.id)), prompt_name:
            response = await httpx_client.get(
                f"/v1/prompts/{prompts_identifier}/tags/{tag_name}",
            )
            assert response.is_success
            assert isinstance((data := response.json()["data"]), dict)
            assert (
                from_global_id_with_expected_type(
                    GlobalID.from_id(data["id"]), PromptVersion.__name__
                )
                == prompt_version.id
            )
            assert prompt_version.model_name == model_name
            assert prompt_version.model_provider == model_provider
