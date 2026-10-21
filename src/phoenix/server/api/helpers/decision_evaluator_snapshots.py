"""Immutable dataset decision evaluators, independent of later binding or tag edits."""

from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.decision_evaluators import derive_decision_output_configs
from phoenix.db.types.evaluator_definition import InlineDecisionEvaluatorDefinition
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_evaluators import capture_decision_evaluator_definition


class DecisionEvaluatorSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    definition: InlineDecisionEvaluatorDefinition
    input_mapping: InputMapping
    project_id: int

    @property
    def dataset_evaluator_id(self) -> int:
        assert self.definition.source is not None
        assert self.definition.source.dataset_evaluator_id is not None
        return self.definition.source.dataset_evaluator_id

    @property
    def name(self) -> str:
        return self.definition.name

    @property
    def output_configs(self) -> list[OutputConfigType]:
        return derive_decision_output_configs(
            self.definition.questions, self.definition.scoring_policy
        )


async def capture_dataset_decision_evaluators(session: AsyncSession, experiment_id: int) -> None:
    """Freeze definitions, effective policies, mappings, and output names at creation."""
    await session.flush()
    job = await session.get(models.ExperimentJob, experiment_id)
    if job is None:
        raise ValueError("Experiment execution configuration not found")
    bindings = list(
        await session.scalars(
            select(models.DatasetEvaluators)
            .join(
                models.ExperimentDatasetEvaluator,
                models.ExperimentDatasetEvaluator.dataset_evaluator_id
                == models.DatasetEvaluators.id,
            )
            .join(models.Evaluator, models.Evaluator.id == models.DatasetEvaluators.evaluator_id)
            .where(
                models.ExperimentDatasetEvaluator.experiment_id == experiment_id,
                models.Evaluator.kind == "DECISION",
            )
            .order_by(models.DatasetEvaluators.evaluator_id, models.DatasetEvaluators.id)
        )
    )
    if not bindings:
        job.decision_evaluator_snapshots = []
        return
    evaluators_by_id = {
        evaluator.id: evaluator
        for evaluator in await session.scalars(
            select(models.DecisionEvaluator)
            .where(models.DecisionEvaluator.id.in_({binding.evaluator_id for binding in bindings}))
            .order_by(models.DecisionEvaluator.id)
            .with_for_update()
        )
    }
    snapshots = []
    for binding in bindings:
        evaluator = evaluators_by_id[binding.evaluator_id]
        try:
            definition = capture_decision_evaluator_definition(
                evaluator,
                name=binding.name.root,
                description=binding.description,
                dataset_evaluator_id=binding.id,
            )
        except ValueError as error:
            raise BadRequest(f"Dataset evaluator '{binding.name.root}': {error}") from error
        snapshots.append(
            DecisionEvaluatorSnapshot(
                definition=definition,
                input_mapping=binding.input_mapping,
                project_id=binding.project_id,
            ).model_dump(mode="json")
        )
    job.decision_evaluator_snapshots = snapshots
