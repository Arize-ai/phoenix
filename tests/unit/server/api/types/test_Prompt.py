import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


def _prompt_version(prompt_id: int, description: str) -> models.PromptVersion:
    return models.PromptVersion(
        prompt_id=prompt_id,
        description=description,
        template_type=PromptTemplateType.STRING,
        template_format=PromptTemplateFormat.F_STRING,
        template=PromptStringTemplate(type="string", template="Hello, {name}!"),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai", openai=PromptOpenAIInvocationParametersContent()
        ),
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4",
        metadata_={},
    )


@pytest.fixture
async def prompts_with_versions_and_tags(
    db: DbSessionFactory,
) -> dict[str, dict[str, object]]:
    """
    Two prompts: "prompt-a" with three versions ("production" and "staging" tags
    on different versions), "prompt-b" with one untagged version.
    Returns expected version counts, latest version IDs, and tag names by prompt name.
    """
    async with db() as session:
        prompt_a = models.Prompt(name=Identifier(root="prompt-a"), metadata_={})
        prompt_b = models.Prompt(name=Identifier(root="prompt-b"), metadata_={})
        label = models.PromptLabel(name="prod-ready", color="#FF0000")
        session.add_all([prompt_a, prompt_b, label])
        await session.flush()
        session.add(models.PromptPromptLabel(prompt_id=prompt_a.id, prompt_label_id=label.id))

        prompt_a_versions = []
        for i in range(3):
            version = _prompt_version(prompt_a.id, f"prompt-a version {i + 1}")
            session.add(version)
            await session.flush()
            prompt_a_versions.append(version)
        prompt_b_version = _prompt_version(prompt_b.id, "prompt-b version 1")
        session.add(prompt_b_version)
        await session.flush()

        session.add_all(
            [
                models.PromptVersionTag(
                    name=Identifier(root="production"),
                    prompt_id=prompt_a.id,
                    prompt_version_id=prompt_a_versions[1].id,
                ),
                models.PromptVersionTag(
                    name=Identifier(root="staging"),
                    prompt_id=prompt_a.id,
                    prompt_version_id=prompt_a_versions[2].id,
                ),
            ]
        )
        await session.commit()

        return {
            "prompt-a": {
                "versionCount": 3,
                "latestVersionId": str(GlobalID("PromptVersion", str(prompt_a_versions[-1].id))),
                "tagNames": ["production", "staging"],
                "labelNames": ["prod-ready"],
            },
            "prompt-b": {
                "versionCount": 1,
                "latestVersionId": str(GlobalID("PromptVersion", str(prompt_b_version.id))),
                "tagNames": [],
                "labelNames": [],
            },
        }


async def test_version_count_latest_version_and_tags_resolve_per_prompt(
    gql_client: AsyncGraphQLClient,
    prompts_with_versions_and_tags: dict[str, dict[str, object]],
) -> None:
    query = """
      query {
        prompts {
          edges {
            node {
              name
              versionCount
              version {
                id
              }
              versionTags {
                name
              }
              labels {
                name
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data
    actual = {
        edge["node"]["name"]: {
            "versionCount": edge["node"]["versionCount"],
            "latestVersionId": edge["node"]["version"]["id"],
            "tagNames": [tag["name"] for tag in edge["node"]["versionTags"]],
            "labelNames": [label["name"] for label in edge["node"]["labels"]],
        }
        for edge in response.data["prompts"]["edges"]
    }
    assert actual == prompts_with_versions_and_tags
