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
            name
            label
            score
            explanation
            error
            annotatorKind
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
                    evaluator=dict(evaluatorId=builtin_evaluator_id),
                    contexts=[{"output": "The quick brown fox jumps over the lazy dog"}],
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

        eval_result = results[0]
        assert eval_result["name"] == "Contains"
        assert eval_result["annotatorKind"] == "CODE"
        assert eval_result["score"] == 1.0
        assert eval_result["error"] is None
        assert "found" in eval_result["explanation"]

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
                    evaluator=dict(evaluatorId=builtin_evaluator_id),
                    contexts=[{"output": "The quick brown fox"}],
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

        eval_result = results[0]
        assert eval_result["score"] == 0.0
        assert "not found" in eval_result["explanation"]

    async def test_preview_multiple_contexts_per_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test that one evaluator can process multiple contexts."""
        builtin_evaluator_id = str(
            GlobalID("BuiltInEvaluator", str(_generate_builtin_evaluator_id("Contains")))
        )

        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(evaluatorId=builtin_evaluator_id),
                    contexts=[
                        {"output": "hello world"},
                        {"output": "goodbye world"},
                        {"output": "hello again"},
                    ],
                    inputMapping=dict(
                        literalMapping={"words": "hello", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                )
            ],
        )

        assert result.data and not result.errors
        results = result.data["evaluatorPreviews"]["results"]
        assert len(results) == 3

        assert results[0]["score"] == 1.0
        assert results[1]["score"] == 0.0
        assert results[2]["score"] == 1.0

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
                    evaluator=dict(evaluatorId=builtin_evaluator_id),
                    contexts=[{"output": "hello world"}],
                    inputMapping=dict(
                        literalMapping={"words": "hello", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                ),
                dict(
                    evaluator=dict(evaluatorId=builtin_evaluator_id),
                    contexts=[{"output": "goodbye world"}],
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

        assert results[0]["score"] == 1.0
        assert results[1]["score"] == 0.0

    async def test_preview_requires_evaluator_or_inline(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(),
                    contexts=[{"output": "test"}],
                    inputMapping=dict(),
                )
            ],
        )

        assert result.errors is not None

    async def test_preview_without_output_requires_generation_config(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """Test that missing output without generation_config raises an error."""
        builtin_evaluator_id = str(
            GlobalID("BuiltInEvaluator", str(_generate_builtin_evaluator_id("Contains")))
        )

        result = await self._preview(
            gql_client,
            previews=[
                dict(
                    evaluator=dict(evaluatorId=builtin_evaluator_id),
                    contexts=[{"input": "some input without output"}],
                    inputMapping=dict(
                        literalMapping={"words": "hello", "case_sensitive": False},
                        pathMapping={"text": "$.output"},
                    ),
                )
            ],
        )

        assert result.errors is not None
        error_message = result.errors[0].message.lower()
        assert "output" in error_message
        assert "generation_config" in error_message
