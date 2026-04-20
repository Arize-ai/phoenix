from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.server.sandbox.types import ExecutionResult
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
        assert "None of the words" in annotation["explanation"]

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


class TestInlineCodeEvaluatorPreviewMutation:
    async def _preview_inline_code_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
        *,
        sandbox_config_id: str | None,
        language: str = "PYTHON",
        source_code: str = "def evaluate(output):\n    return 1.0",
    ) -> Any:
        return await gql_client.execute(
            TestEvaluatorPreviewMutation._MUTATION,
            {
                "input": {
                    "previews": [
                        {
                            "evaluator": {
                                "inlineCodeEvaluator": {
                                    "name": "inline_code_eval",
                                    "description": "preview",
                                    "language": language,
                                    "sourceCode": source_code,
                                    "sandboxConfigId": sandbox_config_id,
                                    "outputConfigs": [
                                        {
                                            "continuous": {
                                                "name": "score",
                                                "optimizationDirection": "NONE",
                                                "lowerBound": 0,
                                                "upperBound": 1,
                                            }
                                        }
                                    ],
                                }
                            },
                            "context": {"output": {"answer": "4"}},
                            "inputMapping": {},
                        }
                    ]
                }
            },
        )

    async def test_requires_sandbox_config_selection(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await self._preview_inline_code_evaluator(
            gql_client,
            sandbox_config_id=None,
        )

        assert result.errors is not None
        assert "No sandbox configuration selected" in result.errors[0].message

    async def test_rejects_wrong_global_id_type(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        wrong_type_id = str(GlobalID("SandboxProvider", str(sandbox_config.id)))

        result = await self._preview_inline_code_evaluator(
            gql_client,
            sandbox_config_id=wrong_type_id,
        )

        assert result.errors is not None
        assert "SandboxConfig" in result.errors[0].message

    async def test_rejects_missing_sandbox_config(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        result = await self._preview_inline_code_evaluator(
            gql_client,
            sandbox_config_id=str(GlobalID("SandboxConfig", "999999")),
        )

        assert result.errors is not None
        assert "was not found" in result.errors[0].message

    async def test_rejects_disabled_sandbox_config(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            row = await session.get(models.SandboxConfig, sandbox_config.id)
            assert row is not None
            row.enabled = False
            await session.commit()

        result = await self._preview_inline_code_evaluator(
            gql_client,
            sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
        )

        assert result.errors is not None
        assert "is disabled" in result.errors[0].message

    async def test_rejects_disabled_sandbox_provider(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.sandbox_provider_id)
            assert provider is not None
            provider.enabled = False
            await session.commit()

        result = await self._preview_inline_code_evaluator(
            gql_client,
            sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
        )

        assert result.errors is not None
        assert "Sandbox provider" in result.errors[0].message
        assert "is disabled" in result.errors[0].message

    async def test_rejects_language_mismatch(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        result = await self._preview_inline_code_evaluator(
            gql_client,
            sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
            language="TYPESCRIPT",
            source_code="function evaluate({ output }: EvaluatorParams) { return 1; }",
        )

        assert result.errors is not None
        assert "language does not match" in result.errors[0].message

    async def test_returns_preview_result_for_valid_inline_code_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        backend = AsyncMock()
        backend.execute = AsyncMock(
            return_value=ExecutionResult(stdout="1.0", stderr="", error=None)
        )

        with patch(
            "phoenix.server.sandbox.get_or_create_backend",
            return_value=backend,
        ):
            result = await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
            )

        assert result.data and not result.errors
        results = result.data["evaluatorPreviews"]["results"]
        assert len(results) == 1
        assert results[0]["evaluatorName"] == "inline_code_eval"
        assert results[0]["error"] is None
        assert results[0]["annotation"]["score"] == 1.0
