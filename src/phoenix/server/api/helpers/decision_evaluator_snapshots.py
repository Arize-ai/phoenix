"""Immutable dataset decision judges, independent of later binding or tag edits."""

from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.evaluator_definition import InlineDecisionEvaluatorDefinition
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.decision_evaluator_service import get_decision_evaluator
from phoenix.server.api.helpers.decision_evaluators import (
    freeze_decision_evaluator,
    validate_decision_output_overrides,
)


class DecisionEvaluatorSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dataset_evaluator_id: int
    name: str
    definition: InlineDecisionEvaluatorDefinition
    input_mapping: InputMapping
    output_configs: list[OutputConfigType]
    project_id: int


async def freeze_dataset_decision_evaluators(session: AsyncSession, experiment_id: int) -> None:
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
    snapshots = []
    for binding in bindings:
        evaluator = await get_decision_evaluator(session, binding.evaluator_id, lock=True)
        try:
            definition = freeze_decision_evaluator(
                evaluator,
                policy_override=binding.decision_projection_policy,
                name=binding.name.root,
                description=binding.description,
                dataset_evaluator_id=binding.id,
            )
            output_configs = validate_decision_output_overrides(definition, binding.output_configs)
        except ValueError as error:
            raise BadRequest(f"Dataset evaluator '{binding.name.root}': {error}") from error
        snapshots.append(
            DecisionEvaluatorSnapshot(
                dataset_evaluator_id=binding.id,
                name=binding.name.root,
                definition=definition,
                input_mapping=binding.input_mapping,
                project_id=binding.project_id,
                output_configs=output_configs,
            ).model_dump(mode="json")
        )
    job.decision_evaluator_snapshots = snapshots
