from secrets import token_hex

import pytest
from sqlalchemy import select
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


@pytest.fixture
async def prompt_authored_by_two_users(db: DbSessionFactory) -> dict[str, str]:
    """
    A prompt whose first version was authored by one user and whose latest version was authored
    by another, plus a prompt whose only version has no author at all.
    Returns the expected creator and last editor usernames.
    """
    async with db() as session:
        user_role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
        )
        assert user_role_id is not None

        def _user(username: str) -> models.User:
            return models.User(
                user_role_id=user_role_id,
                username=username,
                email=f"{token_hex(4)}@test.com",
                password_hash=b"hash",
                password_salt=b"salt",
                reset_password=False,
                auth_method="LOCAL",
            )

        creator, editor = _user("creator"), _user("editor")
        session.add_all([creator, editor])
        await session.flush()

        prompt = models.Prompt(name=Identifier(root="collaborative-prompt"), metadata_={})
        unattributed = models.Prompt(name=Identifier(root="unattributed-prompt"), metadata_={})
        session.add_all([prompt, unattributed])
        await session.flush()

        # Insert in order: the first version's author is the creator, the last one's the editor.
        for author, description in (
            (creator, "first"),
            (creator, "middle"),
            (editor, "latest"),
        ):
            version = _prompt_version(prompt.id, description)
            version.user_id = author.id
            session.add(version)
            await session.flush()

        session.add(_prompt_version(unattributed.id, "only"))
        await session.commit()

        return {"createdBy": "creator", "updatedBy": "editor"}


async def test_prompt_created_by_and_updated_by_derive_from_first_and_latest_versions(
    gql_client: AsyncGraphQLClient,
    prompt_authored_by_two_users: dict[str, str],
) -> None:
    query = """
      query {
        prompts {
          edges {
            node {
              name
              createdBy { username }
              updatedBy { username }
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data
    nodes = {edge["node"]["name"]: edge["node"] for edge in response.data["prompts"]["edges"]}

    collaborative = nodes["collaborative-prompt"]
    assert collaborative["createdBy"]["username"] == prompt_authored_by_two_users["createdBy"]
    assert collaborative["updatedBy"]["username"] == prompt_authored_by_two_users["updatedBy"]

    unattributed = nodes["unattributed-prompt"]
    assert unattributed["createdBy"] is None
    assert unattributed["updatedBy"] is None
