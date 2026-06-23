from datetime import datetime, timezone

import pytest

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def prompt_labels_with_usages(db: DbSessionFactory) -> None:
    """Three labels: "used-twice" on two prompts, "used-once" on one, "unused" on none."""
    async with db() as session:
        used_twice = models.PromptLabel(name="used-twice", color="#FF0000")
        used_once = models.PromptLabel(name="used-once", color="#00FF00")
        unused = models.PromptLabel(name="unused", color="#0000FF")
        session.add_all([used_twice, used_once, unused])
        await session.flush()

        prompts = [
            models.Prompt(
                name=Identifier(root=f"prompt-{i}"),
                description=None,
                metadata_={},
                created_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
                updated_at=datetime(2020, 1, 1, tzinfo=timezone.utc),
            )
            for i in range(2)
        ]
        session.add_all(prompts)
        await session.flush()

        session.add_all(
            [
                models.PromptPromptLabel(prompt_id=prompts[0].id, prompt_label_id=used_twice.id),
                models.PromptPromptLabel(prompt_id=prompts[1].id, prompt_label_id=used_twice.id),
                models.PromptPromptLabel(prompt_id=prompts[0].id, prompt_label_id=used_once.id),
            ]
        )


async def test_usage_count_resolver_returns_correct_counts(
    gql_client: AsyncGraphQLClient,
    prompt_labels_with_usages: None,
) -> None:
    query = """
      query {
        promptLabels {
          edges {
            node {
              name
              usageCount
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data
    usage_counts = {
        edge["node"]["name"]: edge["node"]["usageCount"]
        for edge in response.data["promptLabels"]["edges"]
    }
    assert usage_counts == {
        "used-twice": 2,
        "used-once": 1,
        "unused": 0,
    }
