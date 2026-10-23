import asyncio
from datetime import datetime, timezone
from typing import Any, Optional, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from strawberry.relay.types import GlobalID
from strawberry.scalars import JSON

from phoenix.config import ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES
from phoenix.db import models
from phoenix.server.api.evaluators import EvaluationResult as EvaluationResultDict
from phoenix.server.api.helpers import evaluator_preview
from phoenix.server.api.helpers.evaluator_preview import (
    UNEXPECTED_SUBJECT_ERROR,
    _evaluate,
    stream_evaluator_preview,
)
from phoenix.server.api.input_types.EvaluatorDefinitionInput import (
    EvaluatorPreviewInput,
    EvaluatorPreviewSubjectInput,
)
from phoenix.server.monty_runtime import (
    MontyBusy,
    MontyDeadlineExceeded,
    MontyShuttingDown,
    MontyUnavailable,
    MontyWorkerCrashed,
    MontyWorkerTurnTimedOut,
)
from phoenix.server.sandbox.monty_backend import MontySandboxBackend
from phoenix.server.sandbox.result_protocol import (
    PHOENIX_RESULT_BEGIN,
    PHOENIX_RESULT_END,
)
from phoenix.server.sandbox.types import ExecutionResult
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_SUBSCRIPTION = """
  subscription($input: EvaluatorPreviewInput!) {
    evaluatorPreview(input: $input) {
      key
      error
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


async def _preview(gql_client: AsyncGraphQLClient, **input_fields: Any) -> dict[str, Any]:
    """Every subject's result, keyed by subject key; fails on a duplicate report."""
    by_id: dict[str, Any] = {}
    async for payload in gql_client.subscription(_SUBSCRIPTION, {"input": input_fields}):
        result = payload["evaluatorPreview"]
        assert result["key"] not in by_id, f"subject {result['key']} reported twice"
        by_id[result["key"]] = result
    return by_id


def _eval_result(name: str, *, score: Optional[float] = 1.0) -> EvaluationResultDict:
    now = datetime.now(timezone.utc)
    return EvaluationResultDict(
        name=name,
        annotator_kind="CODE",
        label=None,
        score=score,
        explanation=None,
        metadata={},
        error=None,
        trace_id=None,
        start_time=now,
        end_time=now,
    )


class _FakeEvaluator:
    """Stands in for a built evaluator; ``evaluate`` is supplied per test."""

    name = "fake"
    output_configs: list[Any] = []

    def __init__(self, evaluate: Any) -> None:
        self.evaluate = evaluate


def _patch_built_evaluator(evaluator: Any) -> Any:
    return patch.object(
        evaluator_preview,
        "build_evaluator_from_definition",
        AsyncMock(return_value=evaluator),
    )


_BUILTIN_PLACEHOLDER = {"builtInEvaluatorId": str(GlobalID("BuiltInEvaluator", "1"))}
_EMPTY_MAPPING: dict[str, dict[str, Any]] = {"literalMapping": {}, "pathMapping": {}}


async def test_preview_hides_every_annotation_under_its_own_name() -> None:
    evaluator = MagicMock()
    evaluator.name = "quality"
    evaluator.output_configs = [MagicMock()]
    evaluator.evaluate = AsyncMock(return_value=[])
    context: dict[str, Any] = {
        "input": {"question": "Hello"},
        "metadata": {
            "annotations": {
                "quality": [
                    {"label": "good", "annotator_kind": "HUMAN"},
                    {"label": "bad", "annotator_kind": "LLM"},
                ],
                "tone": [{"label": "warm", "annotator_kind": "HUMAN"}],
            },
            "source": "unit",
        },
    }

    await _evaluate(evaluator, context=context, input_mapping=MagicMock())

    assert evaluator.evaluate.await_args.kwargs["context"] == {
        "input": {"question": "Hello"},
        "metadata": {
            "annotations": {"tone": [{"label": "warm", "annotator_kind": "HUMAN"}]},
            "source": "unit",
        },
    }
    assert context["metadata"]["annotations"]["quality"][0]["annotator_kind"] == "HUMAN"


class TestEvaluatorPreviewSubscription:
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

    async def test_reports_each_subject_under_its_own_id(
        self,
        gql_client: AsyncGraphQLClient,
        contains_evaluator_gid: str,
    ) -> None:
        results = await _preview(
            gql_client,
            evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
            inputMapping=dict(
                literalMapping={"words": "hello", "case_sensitive": False},
                pathMapping={"text": "$.output"},
            ),
            subjects=[
                dict(key="found", context={"output": "hello world"}),
                dict(key="missing", context={"output": "goodbye world"}),
            ],
        )

        assert set(results) == {"found", "missing"}
        (found,) = results["found"]["results"]
        assert found["annotation"]["name"] == "contains"
        assert found["annotation"]["annotatorKind"] == "CODE"
        assert found["annotation"]["score"] == 1.0
        assert "found" in found["annotation"]["explanation"]
        (missing,) = results["missing"]["results"]
        assert missing["annotation"]["score"] == 0.0
        assert "None of the words" in missing["annotation"]["explanation"]
        assert results["found"]["error"] is None and results["missing"]["error"] is None

    async def test_no_subjects_ends_the_stream_without_results(
        self,
        gql_client: AsyncGraphQLClient,
        contains_evaluator_gid: str,
    ) -> None:
        results = await _preview(
            gql_client,
            evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
            inputMapping=_EMPTY_MAPPING,
            subjects=[],
        )

        assert results == {}

    async def test_rejects_duplicate_subject_ids(
        self,
        gql_client: AsyncGraphQLClient,
        contains_evaluator_gid: str,
    ) -> None:
        with pytest.raises(RuntimeError, match="unique key"):
            await _preview(
                gql_client,
                evaluator=dict(builtInEvaluatorId=contains_evaluator_gid),
                inputMapping=_EMPTY_MAPPING,
                subjects=[
                    dict(key="same", context={"output": "a"}),
                    dict(key="same", context={"output": "b"}),
                ],
            )

    async def test_requires_evaluator_or_inline(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        with pytest.raises(RuntimeError, match="EvaluatorDefinitionInput"):
            await _preview(
                gql_client,
                evaluator=dict(),
                inputMapping=_EMPTY_MAPPING,
                subjects=[dict(key="a", context={"output": "test"})],
            )

    async def test_reports_every_output_of_a_multi_output_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        async def evaluate(**kwargs: Any) -> list[EvaluationResultDict]:
            score = 1.0 if kwargs["context"]["output"] == "good" else 0.0
            return [_eval_result("accuracy", score=score), _eval_result("tone", score=0.5)]

        with _patch_built_evaluator(_FakeEvaluator(evaluate)):
            results = await _preview(
                gql_client,
                evaluator=_BUILTIN_PLACEHOLDER,
                inputMapping=_EMPTY_MAPPING,
                subjects=[
                    dict(key="a", context={"output": "good"}),
                    dict(key="b", context={"output": "bad"}),
                ],
            )

        assert {
            subject_id: [(r["evaluatorName"], r["annotation"]["score"]) for r in result["results"]]
            for subject_id, result in results.items()
        } == {
            "a": [("accuracy", 1.0), ("tone", 0.5)],
            "b": [("accuracy", 0.0), ("tone", 0.5)],
        }

    async def test_a_subject_that_fails_to_run_does_not_fail_the_others(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        async def evaluate(**kwargs: Any) -> list[EvaluationResultDict]:
            output = kwargs["context"]["output"]
            if output == "busy":
                raise MontyBusy("internal capacity detail")
            if output == "boom":
                raise RuntimeError("internal stack detail")
            return [_eval_result("fake")]

        with _patch_built_evaluator(_FakeEvaluator(evaluate)):
            results = await _preview(
                gql_client,
                evaluator=_BUILTIN_PLACEHOLDER,
                inputMapping=_EMPTY_MAPPING,
                subjects=[
                    dict(key="ok", context={"output": "fine"}),
                    dict(key="busy", context={"output": "busy"}),
                    dict(key="boom", context={"output": "boom"}),
                ],
            )

        assert results["ok"]["error"] is None
        assert results["ok"]["results"][0]["annotation"]["score"] == 1.0
        assert results["busy"] == {
            "key": "busy",
            "error": "The Monty runtime is busy. Retry shortly.",
            "results": [],
        }
        assert results["boom"] == {"key": "boom", "error": UNEXPECTED_SUBJECT_ERROR, "results": []}

    async def test_runs_at_most_the_concurrency_cap_at_once(
        self,
        gql_client: AsyncGraphQLClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(evaluator_preview, "MAX_CONCURRENT_SUBJECTS", 2)
        in_flight = 0
        peak = 0

        async def evaluate(**kwargs: Any) -> list[EvaluationResultDict]:
            nonlocal in_flight, peak
            in_flight += 1
            peak = max(peak, in_flight)
            await asyncio.sleep(0.01)
            in_flight -= 1
            return [_eval_result("fake")]

        with _patch_built_evaluator(_FakeEvaluator(evaluate)):
            results = await _preview(
                gql_client,
                evaluator=_BUILTIN_PLACEHOLDER,
                inputMapping=_EMPTY_MAPPING,
                subjects=[dict(key=str(i), context={"output": str(i)}) for i in range(6)],
            )

        assert set(results) == {str(i) for i in range(6)}
        assert peak == 2


class TestPreviewEvaluatorMutation:
    """The mutation collects the subscription's stream; these pin that it is the same run."""

    _MUTATION = """
      mutation($input: EvaluatorPreviewInput!) {
        previewEvaluator(input: $input) {
          results { key error results { evaluatorName error annotation { score } } }
        }
      }
    """

    async def test_returns_every_subject_in_the_order_sent(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        # Subjects finish in reverse order; the payload still lists them as sent.
        async def evaluate(**kwargs: Any) -> list[EvaluationResultDict]:
            index = int(kwargs["context"]["output"])
            if index == 1:
                raise MontyBusy("internal capacity detail")
            await asyncio.sleep(0.01 * (3 - index))
            return [_eval_result("accuracy", score=index / 2), _eval_result("tone")]

        with _patch_built_evaluator(_FakeEvaluator(evaluate)):
            response = await gql_client.execute(
                self._MUTATION,
                {
                    "input": {
                        "evaluator": _BUILTIN_PLACEHOLDER,
                        "inputMapping": _EMPTY_MAPPING,
                        "subjects": [
                            {"key": f"s{i}", "context": {"output": str(i)}} for i in range(3)
                        ],
                    }
                },
            )

        assert response.data and not response.errors, response.errors
        results = response.data["previewEvaluator"]["results"]
        assert [r["key"] for r in results] == ["s0", "s1", "s2"]
        assert results[0]["results"] == [
            {"evaluatorName": "accuracy", "error": None, "annotation": {"score": 0.0}},
            {"evaluatorName": "tone", "error": None, "annotation": {"score": 1.0}},
        ]
        assert results[1] == {
            "key": "s1",
            "error": "The Monty runtime is busy. Retry shortly.",
            "results": [],
        }
        assert results[2]["results"][0]["annotation"] == {"score": 1.0}

    async def test_a_definition_error_fails_the_request(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        response = await gql_client.execute(
            self._MUTATION,
            {
                "input": {
                    "evaluator": {
                        "inlineCodeEvaluator": {
                            "name": "inline_code_eval",
                            "language": "PYTHON",
                            "sourceCode": "def evaluate(output):\n    return 1.0",
                            "sandboxConfigId": None,
                            "outputConfigs": [{"freeform": {"name": "score"}}],
                        }
                    },
                    "inputMapping": _EMPTY_MAPPING,
                    "subjects": [{"key": "a", "context": {"output": "x"}}],
                }
            },
        )

        assert response.errors
        assert "No sandbox configuration selected" in response.errors[0].message


class TestEvaluatorPreviewCancellation:
    async def test_cancelling_the_stream_cancels_running_subjects(
        self,
    ) -> None:
        cancelled: list[str] = []
        started: list[str] = []

        async def evaluate(**kwargs: Any) -> list[EvaluationResultDict]:
            output = kwargs["context"]["output"]
            if output == "fast":
                return [_eval_result("fake")]
            started.append(output)
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.append(output)
                raise
            raise AssertionError("unreachable")

        runner = _FakeEvaluator(evaluate)
        context = MagicMock()
        context.db.return_value.__aenter__ = AsyncMock()
        context.db.return_value.__aexit__ = AsyncMock(return_value=None)
        input = EvaluatorPreviewInput(
            evaluator=MagicMock(),
            input_mapping=MagicMock(),
            subjects=[
                EvaluatorPreviewSubjectInput(key="fast", context=cast(JSON, {"output": "fast"})),
                EvaluatorPreviewSubjectInput(
                    key="slow-1", context=cast(JSON, {"output": "slow-1"})
                ),
                EvaluatorPreviewSubjectInput(
                    key="slow-2", context=cast(JSON, {"output": "slow-2"})
                ),
            ],
        )
        first_result = asyncio.Event()

        async def consume() -> None:
            async for _ in stream_evaluator_preview(context, input):
                first_result.set()

        with _patch_built_evaluator(runner):
            task = asyncio.create_task(consume())
            await asyncio.wait_for(first_result.wait(), timeout=5)
            while len(started) < 2:
                await asyncio.sleep(0)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task

        assert sorted(cancelled) == ["slow-1", "slow-2"]


class TestInlineCodeEvaluatorPreview:
    async def _preview_inline_code_evaluator(
        self,
        gql_client: AsyncGraphQLClient,
        *,
        sandbox_config_id: str | None,
        language: str = "PYTHON",
        source_code: str = "def evaluate(output):\n    return 1.0",
        contexts: Optional[list[Any]] = None,
        apply_online_evaluation_limits: bool = False,
    ) -> dict[str, Any]:
        return await _preview(
            gql_client,
            evaluator={
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
            inputMapping=_EMPTY_MAPPING,
            subjects=[
                {"key": str(i), "context": context}
                for i, context in enumerate(contexts or [{"output": {"answer": "4"}}])
            ],
            applyOnlineEvaluationLimits=apply_online_evaluation_limits,
        )

    @staticmethod
    def _backend(stdout: str = f"{PHOENIX_RESULT_BEGIN}\n1.0\n{PHOENIX_RESULT_END}\n") -> Any:
        backend = AsyncMock()
        backend.execute_with_inputs = AsyncMock(
            return_value=ExecutionResult(stdout=stdout, stderr="", error=None)
        )
        return backend

    async def test_requires_sandbox_config_selection(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        with pytest.raises(RuntimeError, match="No sandbox configuration selected"):
            await self._preview_inline_code_evaluator(gql_client, sandbox_config_id=None)

    async def test_rejects_wrong_global_id_type(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        wrong_type_id = str(GlobalID("SandboxProvider", sandbox_config.backend_type))

        with pytest.raises(RuntimeError, match="SandboxConfig"):
            await self._preview_inline_code_evaluator(gql_client, sandbox_config_id=wrong_type_id)

    async def test_rejects_missing_sandbox_config(
        self,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        with pytest.raises(RuntimeError, match="was not found"):
            await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", "999999")),
            )

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

        with pytest.raises(RuntimeError, match="is disabled"):
            await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
            )

    async def test_rejects_disabled_sandbox_provider(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        async with db() as session:
            provider = await session.get(models.SandboxProvider, sandbox_config.backend_type)
            assert provider is not None
            provider.enabled = False
            await session.commit()

        with pytest.raises(RuntimeError, match="Sandbox provider.*is disabled"):
            await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
            )

    async def test_rejects_language_mismatch_before_any_subject_runs(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        backend = self._backend()
        with (
            patch("phoenix.server.api.evaluators.build_sandbox_backend", return_value=backend),
            pytest.raises(RuntimeError, match="language does not match"),
        ):
            await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
                language="TYPESCRIPT",
                source_code="function evaluate({ output }: EvaluatorParams) { return 1; }",
                contexts=[{"output": "a"}, {"output": "b"}],
            )
        backend.execute_with_inputs.assert_not_called()

    async def test_each_subject_runs_in_its_own_ephemeral_sandbox(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        # Each sandbox scores the output it was handed, so a subject that received
        # another subject's inputs would report that subject's score.
        score_by_output = {"a": 0.25, "b": 0.5, "c": 0.75}

        async def execute_with_inputs(code: str, **kwargs: Any) -> ExecutionResult:
            score = score_by_output[kwargs["inputs"]["_inputs"]["output"]]
            stdout = f"{PHOENIX_RESULT_BEGIN}\n{score}\n{PHOENIX_RESULT_END}\n"
            return ExecutionResult(stdout=stdout, stderr="", error=None)

        backend = self._backend()
        backend.execute_with_inputs = AsyncMock(side_effect=execute_with_inputs)

        with patch("phoenix.server.api.evaluators.build_sandbox_backend", return_value=backend):
            results = await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
                contexts=[{"output": "a"}, {"output": "b"}, {"output": "c"}],
            )

        assert {
            subject_key: r["results"][0]["annotation"]["score"]
            for subject_key, r in results.items()
        } == {"0": 0.25, "1": 0.5, "2": 0.75}
        assert results["0"]["results"][0]["evaluatorName"] == "inline_code_eval"
        # Previews stay off the session manager: no shared session to serialize on, no
        # slot taken from the per-provider cap, nothing left behind to close.
        assert backend.execute_with_inputs.await_count == 3
        backend.find_or_create_session.assert_not_called()
        backend.execute_in_session.assert_not_called()
        backend.close_session.assert_not_called()

    async def test_applies_the_online_sandbox_payload_limit_on_request(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES, "1024")
        backend = self._backend()
        oversized_context = {"output": "o" * 4096}

        with patch("phoenix.server.api.evaluators.build_sandbox_backend", return_value=backend):
            unlimited = await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
                contexts=[oversized_context],
            )
            limited = await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
                contexts=[oversized_context, {"output": "small"}],
                apply_online_evaluation_limits=True,
            )

        # Authoring against a dataset stays unlimited; a preview standing in for
        # a scheduled run is rejected exactly as the live evaluation rejects it,
        # on the subject that is too large and no other.
        assert unlimited["0"]["results"][0]["error"] is None
        error = limited["0"]["results"][0]["error"]
        assert error is not None
        assert "exceeds the allowed 1024 bytes" in error
        assert ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES in error
        assert limited["1"]["results"][0]["error"] is None

    @pytest.mark.parametrize(
        ("error", "expected_message"),
        [
            (MontyBusy("internal capacity detail"), "The Monty runtime is busy. Retry shortly."),
            (
                MontyUnavailable("internal install detail"),
                "The Monty runtime is unavailable. Check the server configuration and retry.",
            ),
            (
                MontyShuttingDown("internal shutdown detail"),
                "The Monty runtime is shutting down. Retry after the server restarts.",
            ),
            (
                MontyDeadlineExceeded("internal deadline detail"),
                "Monty execution timed out. Retry or reduce the evaluator's work.",
            ),
            (
                MontyWorkerTurnTimedOut(None),
                "Monty execution timed out. Retry or reduce the evaluator's work.",
            ),
            (
                MontyWorkerCrashed(None),
                "The Monty worker stopped unexpectedly. Retry the preview.",
            ),
        ],
    )
    async def test_reports_monty_runtime_errors_on_the_subject(
        self,
        gql_client: AsyncGraphQLClient,
        sandbox_config: models.SandboxConfig,
        error: Exception,
        expected_message: str,
    ) -> None:
        # Monty has no sessions, so its errors reach the runner from the ephemeral path.
        backend = AsyncMock(spec=MontySandboxBackend)
        backend.execute_with_inputs = AsyncMock(side_effect=error)

        with patch("phoenix.server.api.evaluators.build_sandbox_backend", return_value=backend):
            results = await self._preview_inline_code_evaluator(
                gql_client,
                sandbox_config_id=str(GlobalID("SandboxConfig", str(sandbox_config.id))),
            )

        assert results["0"] == {"key": "0", "error": expected_message, "results": []}
        assert "internal" not in expected_message


class TestCodeEvaluatorPreviewNoSandbox:
    async def test_bad_request_message_contains_name_and_settings_hint(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_languages: None,
    ) -> None:
        from phoenix.db.types.evaluators import InputMapping
        from phoenix.db.types.identifier import Identifier

        async with db() as session:
            code_eval = models.CodeEvaluator(
                name=Identifier("no-sandbox-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[],
                language="PYTHON",
                sandbox_config_id=None,
            )
            session.add(code_eval)
            await session.flush()
            version = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code="def evaluate(output): return 1.0",
            )
            session.add(version)
            await session.flush()
            code_eval_id = code_eval.id

        gid = str(GlobalID("CodeEvaluator", str(code_eval_id)))
        with pytest.raises(RuntimeError, match="no-sandbox-eval.*/settings/sandboxes"):
            await _preview(
                gql_client,
                evaluator={"codeEvaluatorId": gid},
                inputMapping=_EMPTY_MAPPING,
                subjects=[{"key": "a", "context": {"output": "test"}}],
            )


class TestStoredCodeEvaluatorPreview:
    async def test_returns_preview_result_with_stored_output_configs(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
        seed_languages: None,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        from phoenix.db.types.annotation_configs import (
            ContinuousOutputConfig,
            OptimizationDirection,
        )
        from phoenix.db.types.evaluators import InputMapping
        from phoenix.db.types.identifier import Identifier

        async with db() as session:
            code_eval = models.CodeEvaluator(
                name=Identifier("stored-code-eval"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    ContinuousOutputConfig(
                        type="CONTINUOUS",
                        name="score",
                        optimization_direction=OptimizationDirection.MAXIMIZE,
                        description=None,
                        lower_bound=0.0,
                        upper_bound=1.0,
                    )
                ],
                language="PYTHON",
                sandbox_config_id=sandbox_config.id,
            )
            session.add(code_eval)
            await session.flush()
            version = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code="def evaluate(output): return 0.75",
            )
            session.add(version)
            await session.flush()
            code_eval_id = code_eval.id

        backend = TestInlineCodeEvaluatorPreview._backend(
            f"{PHOENIX_RESULT_BEGIN}\n0.75\n{PHOENIX_RESULT_END}\n"
        )

        gid = str(GlobalID("CodeEvaluator", str(code_eval_id)))
        with patch("phoenix.server.api.evaluators.build_sandbox_backend", return_value=backend):
            results = await _preview(
                gql_client,
                evaluator={"codeEvaluatorId": gid},
                inputMapping=_EMPTY_MAPPING,
                subjects=[{"key": "a", "context": {"output": "test"}}],
            )

        (result,) = results["a"]["results"]
        assert result["evaluatorName"] == "stored-code-eval"
        assert result["error"] is None
        assert result["annotation"]["score"] == 0.75
