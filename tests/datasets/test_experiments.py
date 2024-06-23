from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

import nest_asyncio
from phoenix.datasets.evaluators import (
    ConcisenessEvaluator,
    ContainsKeyword,
    HelpfulnessEvaluator,
)
from phoenix.datasets.evaluators.utils import evaluator
from phoenix.datasets.experiments import run_experiment
from phoenix.datasets.types import (
    AnnotatorKind,
    CanAsyncEvaluate,
    CanEvaluate,
    Dataset,
    Example,
    ExperimentResult,
    ExperimentRun,
)
from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from sqlalchemy import select
from strawberry.relay import GlobalID


@patch("opentelemetry.sdk.trace.export.SimpleSpanProcessor.on_end")
async def test_run_experiment(_, session, sync_test_client, simple_dataset):
    nest_asyncio.apply()

    nonexistent_experiment = (await session.execute(select(models.Experiment))).scalar()
    assert not nonexistent_experiment, "There should be no experiments in the database"

    test_dataset = Dataset(
        id=str(GlobalID("Dataset", "0")),
        version_id=str(GlobalID("DatasetVersion", "0")),
        examples=[
            Example(
                id=str(GlobalID("DatasetExample", "0")),
                input={"input": "fancy input 1"},
                output={},
                metadata={},
                updated_at=datetime.now(timezone.utc),
            )
        ],
    )

    with patch("phoenix.datasets.experiments._phoenix_client", return_value=sync_test_client):

        def experiment_task(example: Example) -> str:
            return "doesn't matter, this is the output"

        experiment = run_experiment(
            dataset=test_dataset,
            task=experiment_task,
            experiment_name="test",
            experiment_description="test description",
            # repetitions=3, TODO: Enable repetitions #3584
            evaluators=[
                ContainsKeyword(keyword="correct"),
                ContainsKeyword(keyword="doesn't matter"),
            ],
        )
        experiment_id = from_global_id_with_expected_type(
            GlobalID.from_id(experiment.id), "Experiment"
        )
        assert experiment_id

        experiment_model = (await session.execute(select(models.Experiment))).scalar()
        assert experiment_model, "An experiment was run"
        assert experiment_model.dataset_id == 0
        assert experiment_model.dataset_version_id == 0
        assert experiment_model.name == "test"
        assert experiment_model.description == "test description"
        assert experiment_model.repetitions == 1  # TODO: Enable repetitions #3584

        experiment_runs = (
            (
                await session.execute(
                    select(models.ExperimentRun).where(models.ExperimentRun.dataset_example_id == 0)
                )
            )
            .scalars()
            .all()
        )
        assert len(experiment_runs) == 1, "The experiment was configured to have 1 repetition"
        for run in experiment_runs:
            assert run.output == {"result": "doesn't matter, this is the output"}

            evaluations = (
                (
                    await session.execute(
                        select(models.ExperimentRunAnnotation).where(
                            models.ExperimentRunAnnotation.experiment_run_id == run.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(evaluations) == 2
            assert evaluations[0].score == 0.0
            assert evaluations[1].score == 1.0


@patch("opentelemetry.sdk.trace.export.SimpleSpanProcessor.on_end")
async def test_run_experiment_with_llm_eval(_, session, sync_test_client, simple_dataset):
    nest_asyncio.apply()

    nonexistent_experiment = (await session.execute(select(models.Experiment))).scalar()
    assert not nonexistent_experiment, "There should be no experiments in the database"

    test_dataset = Dataset(
        id=str(GlobalID("Dataset", "0")),
        version_id=str(GlobalID("DatasetVersion", "0")),
        examples=[
            Example(
                id=str(GlobalID("DatasetExample", "0")),
                input={"input": "fancy input 1"},
                output={},
                metadata={},
                updated_at=datetime.now(timezone.utc),
            )
        ],
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

    with patch("phoenix.datasets.experiments._phoenix_client", return_value=sync_test_client):

        def experiment_task(input):
            return "doesn't matter, this is the output"

        experiment = run_experiment(
            dataset=test_dataset,
            task=experiment_task,
            experiment_name="test",
            experiment_description="test description",
            # repetitions=3,  # TODO: Enable repetitions #3584
            evaluators=[
                ConcisenessEvaluator(model=NegativeFakeLLMModel()),
                HelpfulnessEvaluator(model=PostitiveFakeLLMModel()),
            ],
        )
        experiment_id = from_global_id_with_expected_type(
            GlobalID.from_id(experiment.id), "Experiment"
        )
        assert experiment_id

        experiment_model = (await session.execute(select(models.Experiment))).scalar()
        assert experiment_model, "An experiment was run"
        assert experiment_model.dataset_id == 0
        assert experiment_model.dataset_version_id == 0
        assert experiment_model.name == "test"
        assert experiment_model.description == "test description"

        experiment_runs = (
            (
                await session.execute(
                    select(models.ExperimentRun).where(models.ExperimentRun.dataset_example_id == 0)
                )
            )
            .scalars()
            .all()
        )
        assert len(experiment_runs) == 1, "The experiment was configured to have 1 repetition"
        for run in experiment_runs:
            assert run.output == {"result": "doesn't matter, this is the output"}

        for run in experiment_runs:
            evaluations = (
                (
                    await session.execute(
                        select(models.ExperimentRunAnnotation).where(
                            models.ExperimentRunAnnotation.experiment_run_id == run.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(evaluations) == 2
            assert evaluations[0].score == 0.0
            assert evaluations[1].score == 1.0


def test_evaluator_decorator():
    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    def can_i_count_this_high(x: int) -> bool:
        return x < 3

    assert can_i_count_this_high(3) is False
    assert can_i_count_this_high(2) is True
    assert isinstance(can_i_count_this_high, CanEvaluate)
    assert can_i_count_this_high.name == "test"
    assert can_i_count_this_high.annotator_kind == AnnotatorKind.CODE.value


async def test_async_evaluator_decorator():
    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    async def can_i_count_this_high(x: int) -> bool:
        return x < 3

    assert await can_i_count_this_high(3) is False
    assert await can_i_count_this_high(2) is True
    assert isinstance(can_i_count_this_high, CanAsyncEvaluate)
    assert can_i_count_this_high.name == "test"
    assert can_i_count_this_high.annotator_kind == AnnotatorKind.CODE.value


def test_binding_arguments_to_decorated_evaluators():
    example = Example(
        id="1",
        input="the biggest number I know",
        output="3",
        metadata={},
        updated_at=datetime.now(timezone.utc),
    )
    experiment_run = ExperimentRun(
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        experiment_id=1,
        dataset_example_id=1,
        repetition_number=1,
        output=ExperimentResult(result=3),
    )

    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    def can_i_count_this_high(x: int) -> bool:
        return x == 3

    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    def can_i_evaluate_experiment_run_obj(experiment_run: ExperimentRun) -> bool:
        return isinstance(experiment_run, ExperimentRun)

    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    def can_i_evaluate_example_obj(example: Example) -> bool:
        return isinstance(example, Example)

    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    def can_i_evaluate_using_both_the_example_and_run(
        experiment_run: ExperimentRun, example: Example
    ) -> bool:
        is_experiment_run = isinstance(experiment_run, ExperimentRun)
        is_example = isinstance(example, Example)
        return is_experiment_run and is_example

    @evaluator(name="test", annotator_kind=AnnotatorKind.CODE.value)
    def can_i_evaluate_using_both_the_example_and_run_2(
        example: Example, experiment_run: ExperimentRun
    ) -> bool:
        is_experiment_run = isinstance(experiment_run, ExperimentRun)
        is_example = isinstance(example, Example)
        return is_experiment_run and is_example

    evaluation = can_i_count_this_high.evaluate(example, experiment_run)
    assert evaluation.score == 1.0, "With one argument, evaluates against output.result"

    evaluation = can_i_evaluate_experiment_run_obj.evaluate(example, experiment_run)
    assert (
        evaluation.score == 1.0
    ), "With experiment_run arg, evaluates against ExperimentRun object"

    evaluation = can_i_evaluate_example_obj.evaluate(example, experiment_run)
    assert evaluation.score == 1.0, "With example arg, evaluates against Example object"

    evaluation = can_i_evaluate_using_both_the_example_and_run.evaluate(example, experiment_run)
    assert evaluation.score == 1.0, "With two args, evaluates based on argument names"

    evaluation = can_i_evaluate_using_both_the_example_and_run_2.evaluate(example, experiment_run)
    assert evaluation.score == 1.0, "With two args, evaluates based on argument names"
