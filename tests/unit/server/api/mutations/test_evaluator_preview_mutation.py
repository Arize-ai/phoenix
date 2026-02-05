from typing import Any

import pytest
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestEvaluatorPreviewMutation:
    _MUTATION = """
      mutation($input: EvaluatorPreviewsInput!) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            error
            annotation {
              name
              label
              score
              explanation
              annotatorKind
            }
          }
        }
      }
    """

    async def _preview(self, gql_client: AsyncGraphQLClient, **input_fields: Any) -> Any:
        return await gql_client.execute(self._MUTATION, {"input": input_fields})

    @pytest.fixture
    async def contains_evaluator_gid(
        self, db: DbSessionFactory, synced_builtin_evaluators: None
    ) -> str:
        """Get the global ID for the Contains builtin evaluator."""
        async with db() as session:
            contains_id = await session.scalar(
                select(models.BuiltinEvaluator.id).where(models.BuiltinEvaluator.key == "contains")
            )
        assert contains_id is not None
        return str(GlobalID("BuiltInEvaluator", str(contains_id)))

    async def test_preview_builtin_evaluator_contains(
        self,
        gql_client: AsyncGraphQLClient,
        contains_evaluator_gid: str,
    ) -> None:
        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
                    context={"output": "The quick brown fox jumps over the lazy dog"},
                    inputMapping=dict(
                        literalMapping={"words": "fox,cat", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                )
            ],
        )

        assert result.data and not result.errors, f"Unexpected errors: {result.errors}"
        results = result.data["evaluatorPreviews"]["results"]
        assert len(results) == 1

        annotation = results[0]["annotation"]
        assert annotation["name"] == "contains"
        assert annotation["annotatorKind"] == "CODE"
        assert annotation["score"] == 1.0
        assert "found" in annotation["explanation"]

    async def test_preview_builtin_evaluator_not_found(
        self,
        gql_client: AsyncGraphQLClient,
        contains_evaluator_gid: str,
    ) -> None:
        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
                    context={"output": "The quick brown fox"},
                    inputMapping=dict(
                        literalMapping={"words": "elephant,giraffe", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                )
            ],
        )

        assert result.data and not result.errors
        results = result.data["evaluatorPreviews"]["results"]
        assert len(results) == 1

        annotation = results[0]["annotation"]
        assert annotation["score"] == 0.0
        assert "not found" in annotation["explanation"]

    async def test_preview_multiple_evaluators(
        self,
        gql_client: AsyncGraphQLClient,
        contains_evaluator_gid: str,
    ) -> None:
        """Test that multiple evaluators can be previewed at once."""
        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
                    context={"output": "hello world"},
                    inputMapping=dict(
                        literalMapping={"words": "hello", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                ),
                dict(
                    evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
                    context={"output": "goodbye world"},
                    inputMapping=dict(
                        literalMapping={"words": "hello", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                ),
            ],
        )

        assert result.data and not result.errors
        results = result.data["evaluatorPreviews"]["results"]
        assert len(results) == 2

        assert results[0]["annotation"]["score"] == 1.0
        assert results[1]["annotation"]["score"] == 0.0

    async def test_preview_requires_evaluator_or_inline(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(),
                    context={"output": "test"},
                    inputMapping=dict(),
                )
            ],
        )

        assert result.errors is not None
