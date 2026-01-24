import asyncio
import json
import platform
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import httpx
import pytest
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix import Client
from phoenix.db import models
from phoenix.experiments import evaluate_experiment, run_experiment
from phoenix.experiments.evaluators import (
    ConcisenessEvaluator,
    ContainsKeyword,
    HelpfulnessEvaluator,
    create_evaluator,
)
from phoenix.experiments.types import (
    AnnotatorKind,
    Dataset,
    Example,
    Experiment,
    ExperimentRun,
    JSONSerializable,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.types import DbSessionFactory


@pytest.mark.skipif(platform.system() in ("Windows", "Darwin"), reason="Flaky on CI")
@patch("opentelemetry.sdk.trace.export.SimpleSpanProcessor.on_end")
async def test_run_experiment(
    _: Any,
    db: DbSessionFactory,
    httpx_clients: httpx.AsyncClient,
    simple_dataset: Any,
    dialect: str,
) -> None:
    if dialect == "postgresql":
        pytest.xfail("This test fails on PostgreSQL")

    example_input = {"input": "fancy input 1"}
    example_output = {"output": "fancy output 1"}
    example_metadata = {"metadata": "fancy metadata 1"}
    test_dataset = Dataset(
        id=str(GlobalID("Dataset", "0")),
        version_id=str(GlobalID("DatasetVersion", "0")),
        examples={
            (id_ := str(GlobalID("DatasetExample", "0"))): Example(
                id=id_,
                input=example_input,
                output=example_output,
                metadata=example_metadata,
                updated_at=datetime.now(timezone.utc),
            )
        },
    )

    with patch("phoenix.experiments.functions._phoenix_clients", return_value=httpx_clients):
        task_output = {"doesn't matter": "this is the output"}

        def experiment_task(_: Any) -> dict[str, str]:
            assert _ == example_input
            assert _ is not example_input
            return task_output

        # reduce the number of evaluators to improve test stability
        evaluators = [
            lambda output: ContainsKeyword(keyword="correct").evaluate(output=json.dumps(output)),
            lambda output: ContainsKeyword(keyword="doesn't matter").evaluate(
                output=json.dumps(output)
            ),
            # lambda output: output == task_output,
            lambda output: output is not task_output,
            lambda input: input == example_input,
            lambda input: input is not example_input,
            # lambda expected: expected == example_output,
            # lambda expected: expected is not example_output,
            # lambda metadata: metadata == example_metadata,
            # lambda metadata: metadata is not example_metadata,
            # lambda reference, expected: expected == reference,
            # lambda reference, expected: expected is reference,
        ]
        experiment = run_experiment(
            dataset=test_dataset,
            task=experiment_task,
            experiment_name="test",
            experiment_description="test description",
            # repetitions=3, TODO: Enable repetitions #3584
            evaluators={f"{i:02}": e for i, e in enumerate(evaluators)},
            print_summary=False,
        )

        await asyncio.sleep(5)
        experiment_id = from_global_id_with_expected_type(
            GlobalID.from_id(experiment.id), "Experiment"
        )
        assert experiment_id
        assert experiment.repetitions == 1, "Experiment has 1 repetition"
        assert len(experiment.runs) == 1, "Experiment has 1 example"
        runs = [run for run in experiment.runs.values()]
        assert runs[0].output == {"doesn't matter": "this is the output"}
        # assert len(experiment.eval_runs) == len(evaluators)  # this assertion is flaky


@pytest.mark.skipif(platform.system() in ("Windows", "Darwin"), reason="Flaky on CI")
@patch("opentelemetry.sdk.trace.export.SimpleSpanProcessor.on_end")
async def test_run_experiment_with_llm_eval(
    _: Any,
    db: DbSessionFactory,
    httpx_clients: httpx.AsyncClient,
    simple_dataset: Any,
    dialect: str,
) -> None:
    if dialect == "postgresql":
        pytest.xfail("This test fails on PostgreSQL")

    test_dataset = Dataset(
        id=str(GlobalID("Dataset", "0")),
        version_id=str(GlobalID("DatasetVersion", "0")),
        examples={
            (id_ := str(GlobalID("DatasetExample", "0"))): Example(
                id=id_,
                input={"input": "fancy input 1"},
                output={},
                metadata={},
                updated_at=datetime.now(timezone.utc),
            )
        },
    )

    class PostitiveFakeLLMModel:
        model_name = "fake-llm"

        def _generate(self, prompt: str, **kwargs: Any) -> str:
            return " doesn't matter I can't think!\nLABEL: true"

        async def _async_generate(self, prompt: str, **kwargs: Any) -> str:
            return " doesn't matter I can't think!\nLABEL: true"

    class NegativeFakeLLMModel:
        model_name = "fake-llm"

        def _generate(self, prompt: str, **kwargs: Any) -> str:
            return " doesn't matter I can't think!\nLABEL: false"

        async def _async_generate(self, prompt: str, **kwargs: Any) -> str:
            return " doesn't matter I can't think!\nLABEL: false"

    with patch("phoenix.experiments.functions._phoenix_clients", return_value=httpx_clients):

        def experiment_task(
            input: dict[str, Any],
            example: Example,
            metadata: dict[str, Any],
        ) -> str:
            assert input == {"input": "fancy input 1"}
            assert metadata == {}
            assert isinstance(example, Example)
            return "doesn't matter, this is the output"

        experiment = run_experiment(
            dataset=test_dataset,
            task=experiment_task,
            experiment_name="test",
            experiment_description="test description",
            # repetitions=3,  # TODO: Enable repetitions #3584
            evaluators=[
                ConcisenessEvaluator(model=NegativeFakeLLMModel()),  # type: ignore
                HelpfulnessEvaluator(model=PostitiveFakeLLMModel()),  # type: ignore
            ],
        )
        await asyncio.sleep(5)
        experiment_id = from_global_id_with_expected_type(
            GlobalID.from_id(experiment.id), "Experiment"
        )
        assert experiment_id
        assert len(experiment.runs) == 1, "Experiment has 1 example"
        runs = [run for run in experiment.runs.values()]
        assert runs[0].output == "doesn't matter, this is the output"
        # assert len(experiment.eval_runs) == 2  # TODO: resolve eval flakiness
        # assert experiment.eval_runs[0].result.score == 0.0
        # assert experiment.eval_runs[1].result.score == 1.0


@pytest.mark.skipif(platform.system() in ("Windows", "Darwin"), reason="Flaky on CI")
@patch("opentelemetry.sdk.trace.export.SimpleSpanProcessor.on_end")
async def test_run_evaluation(
    _: Any,
    db: DbSessionFactory,
    httpx_clients: httpx.AsyncClient,
    simple_dataset_with_one_experiment_run: Any,
    dialect: str,
) -> None:
    if dialect == "postgresql":
        pytest.xfail("This test fails on PostgreSQL")

    experiment = Experiment(
        id=str(GlobalID("Experiment", "0")),
        dataset_id=str(GlobalID("Dataset", "0")),
        dataset_version_id=str(GlobalID("DatasetVersion", "0")),
        repetitions=1,
        project_name="test",
    )
    with patch("phoenix.experiments.functions._phoenix_clients", return_value=httpx_clients):
        evaluate_experiment(experiment, evaluators=[lambda _: _])
        await asyncio.sleep(1)  # Wait for the evaluations to be inserted
        async with db() as session:
            evaluations = list(await session.scalars(select(models.ExperimentRunAnnotation)))
        assert len(evaluations) == 1
        assert evaluations[0].score


def test_evaluator_decorator() -> None:
    @create_evaluator(kind="CODE")
    def can_i_count_this_high(input: dict[str, int]) -> bool:
        return input["x"] < 3

    assert can_i_count_this_high.evaluate(input={"x": 3}).label == "False"
    assert can_i_count_this_high.evaluate(input={"x": 2}).label == "True"
    assert hasattr(can_i_count_this_high, "evaluate")
    assert can_i_count_this_high.name == "can_i_count_this_high"
    assert can_i_count_this_high.kind == AnnotatorKind.CODE.value


async def test_async_evaluator_decorator() -> None:
    @create_evaluator(name="override", kind="LLM")
    async def can_i_count_this_high(input: dict[str, int]) -> bool:
        return input["x"] < 3

    result1 = await can_i_count_this_high.async_evaluate(input={"x": 3})
    result2 = await can_i_count_this_high.async_evaluate(input={"x": 2})
    assert result1.label == "False"
    assert result2.label == "True"
    assert hasattr(can_i_count_this_high, "async_evaluate")
    assert can_i_count_this_high.name == "override"
    assert can_i_count_this_high.kind == AnnotatorKind.LLM.value


def test_binding_arguments_to_decorated_evaluators() -> None:
    example = Example(
        id="1",
        input={"input": "the biggest number I know"},
        output={"output": 99},
        metadata={"data": "there's nothing here"},
        updated_at=datetime.now(timezone.utc),
    )
    experiment_run = ExperimentRun(
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        experiment_id="1",
        dataset_example_id="1",
        repetition_number=1,
        output=3,
    )

    @create_evaluator()
    def can_i_count_this_high(x: int) -> bool:
        return x == 3

    @create_evaluator()
    def can_i_evaluate_the_output(output: int) -> bool:
        return output == 3

    @create_evaluator()
    def can_i_evaluate_the_expected(expected: int) -> bool:
        return expected == 99

    @create_evaluator()
    def can_i_evaluate_the_input(input: str) -> bool:
        return input == "the biggest number I know"

    @create_evaluator()
    def can_i_evaluate_using_metadata(
        metadata: JSONSerializable,
    ) -> bool:
        return metadata == {"data": "there's nothing here"}

    @create_evaluator()
    def can_i_evaluate_with_everything(
        input: str, output: int, expected: int, metadata: JSONSerializable
    ) -> bool:
        check_input = input == "the biggest number I know"
        check_output = output == 3
        check_expected = expected == 99
        check_metadata = metadata == {"data": "there's nothing here"}
        return check_input and check_output and check_expected and check_metadata

    @create_evaluator()
    def can_i_evaluate_with_everything_in_any_order(
        expected: int, output: int, metadata: JSONSerializable, input: str
    ) -> bool:
        check_input = input == "the biggest number I know"
        check_output = output == 3
        check_expected = expected == 99
        check_metadata = metadata == {"data": "there's nothing here"}
        return check_input and check_output and check_expected and check_metadata

    output = experiment_run.output
    expected, metadata, input = (
        example.output["output"],
        example.metadata,
        example.input["input"],
    )
    kwargs = dict(output=output, expected=expected, metadata=metadata, input=input, extra="junk")
    evaluation = can_i_count_this_high.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "With one argument, evaluates against output.result"

    evaluation = can_i_evaluate_the_output.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "With output arg, evaluates against output.result"

    evaluation = can_i_evaluate_the_expected.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "With expected arg, evaluates against example.output"

    evaluation = can_i_evaluate_the_input.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "With input arg, evaluates against example.input"

    evaluation = can_i_evaluate_using_metadata.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "With metadata arg, evaluates against example.metadata"

    evaluation = can_i_evaluate_with_everything.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "evaluates against named args in any order"

    evaluation = can_i_evaluate_with_everything_in_any_order.evaluate(**kwargs)  # type: ignore[arg-type]
    assert evaluation.score == 1.0, "evaluates against named args in any order"


async def test_get_experiment_client_method(
    legacy_px_client: Client,
    simple_dataset_with_one_experiment_run: Any,
) -> None:
    experiment_gid = GlobalID("Experiment", "0")
    experiment = legacy_px_client.get_experiment(experiment_id=str(experiment_gid))
    assert experiment
    assert isinstance(experiment, Experiment)
