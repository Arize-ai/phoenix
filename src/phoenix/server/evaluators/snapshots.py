"""Capture and pin frozen evaluator definitions and dataset bindings."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import latest_code_evaluator_versions_by_evaluator_id
from phoenix.db.types.decision_evaluators import resolve_scoring_policy
from phoenix.db.types.evaluator_definition import (
    DecisionEvaluatorSnapshot,
    EvaluatorDefinition,
    EvaluatorSource,
    InlineDecisionEvaluatorDefinition,
    StoredCodeEvaluatorDefinition,
    StoredDecisionEvaluatorDefinition,
)
from phoenix.server.api.exceptions import BadRequest, NotFound


async def get_decision_evaluator(
    session: AsyncSession, row_id: int, *, lock: bool = False
) -> models.DecisionEvaluator:
    """Load a saved judge and its pinned version, optionally locking its definition."""
    evaluator = await session.get(models.DecisionEvaluator, row_id, with_for_update=lock)
    if evaluator is None:
        raise NotFound(f"Decision evaluator not found: {row_id}")
    return evaluator


def capture_decision_evaluator_definition(
    evaluator: models.DecisionEvaluator,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    dataset_evaluator_id: Optional[int] = None,
    project_evaluator_id: Optional[int] = None,
) -> InlineDecisionEvaluatorDefinition:
    version = evaluator.selected_version
    if version is None:
        raise ValueError("The evaluator's pinned decision version was not found")
    policy = resolve_scoring_policy(version.questions, evaluator.scoring_policy)
    return InlineDecisionEvaluatorDefinition(
        type="inline_decision_evaluator",
        name=name if name is not None else evaluator.name.root,
        description=description if description is not None else evaluator.description,
        inputs=version.inputs,
        state=version.state,
        questions=version.questions,
        model_provider=version.model_provider,
        model_name=version.model_name,
        custom_provider_id=version.custom_provider_id,
        scoring_policy=policy,
        source=EvaluatorSource(
            evaluator_id=evaluator.id,
            decision_version_id=version.id,
            dataset_evaluator_id=dataset_evaluator_id,
            project_evaluator_id=project_evaluator_id,
        ),
    )


async def pin_evaluator_definition(
    definition: EvaluatorDefinition, *, session: AsyncSession
) -> EvaluatorDefinition:
    """The definition with every mutable reference resolved to a version.

    A stored code evaluator names a row that its owner can edit; before an experiment
    freezes the definition its current version, sandbox configuration and language are
    pinned, so every start and resume of the experiment runs the same code in the same
    environment.
    """
    if isinstance(definition, StoredDecisionEvaluatorDefinition):
        return capture_decision_evaluator_definition(
            await get_decision_evaluator(session, definition.decision_evaluator_id)
        )
    if not isinstance(definition, StoredCodeEvaluatorDefinition) or (
        definition.code_evaluator_version_id is not None
        and definition.sandbox_config_id is not None
        and definition.language is not None
    ):
        return definition
    record = await session.get(models.CodeEvaluator, definition.code_evaluator_id)
    if record is None:
        raise BadRequest(f"Code evaluator with id {definition.code_evaluator_id} not found")
    version_id = definition.code_evaluator_version_id
    if version_id is None:
        latest_versions = await latest_code_evaluator_versions_by_evaluator_id([record.id], session)
        version = latest_versions.get(record.id)
        if version is None:
            raise BadRequest(
                f"Code evaluator with id {definition.code_evaluator_id} has no current version"
            )
        version_id = version.id
    return definition.model_copy(
        update={
            "code_evaluator_version_id": version_id,
            "sandbox_config_id": definition.sandbox_config_id or record.sandbox_config_id,
            "language": definition.language or record.language,
        }
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
    snapshots: list[DecisionEvaluatorSnapshot] = []
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
            )
        )
    job.decision_evaluator_snapshots = snapshots
