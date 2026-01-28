import zlib
from typing import Any

from strawberry.relay.types import GlobalID

from tests.unit.graphql import AsyncGraphQLClient


def _generate_builtin_evaluator_id(name: str) -> int:
    """Generate a stable negative ID using CRC32 checksum (matches server implementation)."""
    return -abs(zlib.crc32(name.encode("utf-8")))


class TestEvaluatorPreviewMutation:
    _MUTATION = """
      mutation($input: EvaluatorPreviewsInput!) {
        evaluatorPreviews(input: $input) {
          results {
            ... on EvaluationSuccess {
              annotation {
                name
                label
                score
                explanation
                annotatorKind
              }
            }
            ... on EvaluationError {
              evaluatorName
              message
            }
          }
        }
      }
    """

    async def _preview(self, gql_client: AsyncGraphQLClient, **input_fields: Any) -> Any:
        return await gql_client.execute(self._MUTATION, {"input": input_fields})

    async def test_preview_builtin_evaluator_contains(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        builtin_evaluator_id = str(
            GlobalID("BuiltInEvaluator", str(_generate_builtin_evaluator_id("Contains")))
        )

        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(builtInEvaluatorId=builtin_evaluator_id),
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
        assert annotation["name"] == "Contains"
        assert annotation["annotatorKind"] == "CODE"
        assert annotation["score"] == 1.0
        assert "found" in annotation["explanation"]

    async def test_preview_builtin_evaluator_not_found(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        builtin_evaluator_id = str(
            GlobalID("BuiltInEvaluator", str(_generate_builtin_evaluator_id("Contains")))
        )

        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(builtInEvaluatorId=builtin_evaluator_id),
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
    ) -> None:
        """Test that multiple evaluators can be previewed at once."""
        builtin_evaluator_id = str(
            GlobalID("BuiltInEvaluator", str(_generate_builtin_evaluator_id("Contains")))
        )

        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(builtInEvaluatorId=builtin_evaluator_id),
                    context={"output": "hello world"},
                    inputMapping=dict(
                        literalMapping={"words": "hello", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                ),
                dict(
                    evaluator=dict(builtInEvaluatorId=builtin_evaluator_id),
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
