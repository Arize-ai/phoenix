"""Saved decision evaluators and dataset bindings, each evaluator with a version tag it owns."""

from dataclasses import dataclass
from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional, Sequence

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.decision_evaluators import DecisionScoringPolicy, adapt_scoring_policy
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.decisions.validation import validate_decision_custom_provider
from phoenix.server.evaluators.services.dataset_bindings import (
    DatasetEvaluatorWriteValues,
    dataset_binding_name_taken,
    write_dataset_evaluator,
)
from phoenix.server.evaluators.services.definitions import (
    EvaluatorServiceContext,
    evaluator_name_taken,
    refuse_bound_evaluator,
)
from phoenix.server.evaluators.services.management import (
    generate_unique_evaluator_name,
    get_project_for_dataset_evaluator,
)
from phoenix.server.evaluators.snapshots import get_decision_evaluator
from phoenix.server.evaluators.validation import validate_decision_input_mapping


def _id(value: GlobalID, kind: str) -> int:
    try:
        return from_global_id_with_expected_type(value, kind)
    except ValueError as error:
        raise BadRequest(str(error)) from error


async def _version(session: AsyncSession, version_id: GlobalID) -> models.DecisionVersion:
    rowid = _id(version_id, "DecisionVersion")
    version = await session.get(models.DecisionVersion, rowid)
    if version is None:
        raise NotFound(f"Decision version not found: {rowid}")
    return version


def _evaluator_tag(
    name: Identifier, version: models.DecisionVersion, user_id: Optional[int]
) -> models.DecisionVersionTag:
    return models.DecisionVersionTag(
        name=Identifier.model_validate(f"{name.root}-evaluator-{token_hex(4)}"),
        decision_id=version.decision_id,
        decision_version_id=version.id,
        user_id=user_id,
    )


def _new_decision_evaluator(
    *,
    name: Identifier,
    description: Optional[str],
    user_id: Optional[int],
    version: models.DecisionVersion,
    scoring_policy: Optional[DecisionScoringPolicy],
) -> models.DecisionEvaluator:
    return models.DecisionEvaluator(
        name=name,
        description=description,
        metadata_={},
        user_id=user_id,
        kind="DECISION",
        decision_id=version.decision_id,
        decision_version_tag=_evaluator_tag(name, version, user_id),
        selected_version=version,
        scoring_policy=adapt_scoring_policy(
            version.questions,
            scoring_policy or DecisionScoringPolicy(),
        ),
    )


@dataclass(kw_only=True)
class CreateDecisionEvaluatorInput:
    name: Identifier
    decision_version_id: GlobalID
    description: Optional[str] = None
    scoring_policy: Optional[DecisionScoringPolicy] = None


async def create_decision_evaluator(
    context: EvaluatorServiceContext, input: CreateDecisionEvaluatorInput
) -> models.DecisionEvaluator:
    """Create a saved judge that runs an explicit decision version through a tag it owns."""
    try:
        async with context.db() as session:
            version = await _version(session, input.decision_version_id)
            evaluator = _new_decision_evaluator(
                name=input.name,
                description=input.description,
                user_id=context.user_id,
                version=version,
                scoring_policy=input.scoring_policy,
            )
            session.add(evaluator)
            await session.flush()
            await session.refresh(evaluator)
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise await evaluator_name_taken(context, input.name) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return evaluator


@dataclass(kw_only=True)
class DecisionEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    scoring_policy: Optional[DecisionScoringPolicy] = UNSET


async def _apply_decision_version_and_policy(
    session: AsyncSession,
    evaluator: models.DecisionEvaluator,
    version: Optional[models.DecisionVersion],
    scoring_policy: Optional[DecisionScoringPolicy],
    *,
    user_id: Optional[int],
) -> models.DecisionVersion:
    """Run the given version through the evaluator's tag, creating the tag if it was deleted;
    without a version the evaluator keeps running what it runs. Returns that version."""
    if scoring_policy is None:
        raise BadRequest("scoring_policy cannot be null")
    if version is not None:
        if version.decision_id != evaluator.decision_id:
            raise BadRequest(
                "A decision evaluator can only be pinned to versions of its own decision"
            )
        tag = (
            await session.get(models.DecisionVersionTag, evaluator.decision_version_tag_id)
            if evaluator.decision_version_tag_id is not None
            else None
        )
        if tag is None:
            evaluator.decision_version_tag = _evaluator_tag(evaluator.name, version, user_id)
        else:
            tag.decision_version_id = version.id
        if version.id != evaluator.selected_version.id:
            evaluator.updated_at = datetime.now(timezone.utc)
        evaluator.selected_version = version
    selected = evaluator.selected_version
    evaluator.scoring_policy = adapt_scoring_policy(
        selected.questions,
        evaluator.scoring_policy if scoring_policy is UNSET else scoring_policy,
    )
    return selected


async def patch_decision_evaluator(
    context: EvaluatorServiceContext, evaluator_id: GlobalID, patch: DecisionEvaluatorPatch
) -> models.DecisionEvaluator:
    """Patch a saved judge; a new version moves the tag it runs through."""
    try:
        async with context.db() as session:
            evaluator = await get_decision_evaluator(
                session, _id(evaluator_id, "DecisionEvaluator"), lock=True
            )
            version = (
                await _version(session, patch.decision_version_id)
                if patch.decision_version_id is not UNSET and patch.decision_version_id is not None
                else None
            )
            await _apply_decision_version_and_policy(
                session, evaluator, version, patch.scoring_policy, user_id=context.user_id
            )
            if patch.name is not UNSET and patch.name is not None:
                evaluator.name = patch.name
            if patch.description is not UNSET:
                evaluator.description = patch.description
            await session.flush()
            await session.refresh(evaluator)
    except (IntegrityError, SQLiteIntegrityError) as error:
        if patch.name is not UNSET and patch.name is not None:
            raise await evaluator_name_taken(context, patch.name) from error
        raise Conflict("The decision evaluator could not be updated") from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return evaluator


async def delete_decision_evaluator(
    context: EvaluatorServiceContext, evaluator_id: GlobalID
) -> None:
    """Delete an unbound judge with the tag it runs through; the decision is kept."""
    async with context.db() as session:
        evaluator = await session.get(
            models.DecisionEvaluator,
            _id(evaluator_id, "DecisionEvaluator"),
            with_for_update=True,
        )
        if evaluator is None:
            return
        await refuse_bound_evaluator(session, evaluator.id, evaluator_id)
        tag_id = evaluator.decision_version_tag_id
        await session.delete(evaluator)
        await session.flush()
        if tag_id is not None:
            await session.execute(
                delete(models.DecisionVersionTag).where(models.DecisionVersionTag.id == tag_id)
            )


@dataclass(kw_only=True)
class CreateDatasetDecisionBindingInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str] = None
    output_configs: Optional[list[OutputConfigType]] = None


async def _bind_decision_to_dataset(
    session: AsyncSession,
    *,
    dataset_id: int,
    evaluator: models.DecisionEvaluator,
    name: Identifier,
    input_mapping: InputMapping,
    description: Optional[str],
    user_id: Optional[int],
    output_configs: Optional[Sequence[OutputConfigType]] = None,
) -> models.DatasetEvaluators:
    dataset_name = await session.scalar(
        select(models.Dataset.name).where(models.Dataset.id == dataset_id)
    )
    if dataset_name is None:
        raise NotFound("Dataset not found")
    if output_configs is not None and list(output_configs) != evaluator.output_configs:
        raise BadRequest(
            "Decision outputs are derived from the questions and scoring policy; "
            "edit the scoring policy to change scoring"
        )
    validate_decision_input_mapping(evaluator.selected_version, input_mapping)
    binding = models.DatasetEvaluators(
        dataset_id=dataset_id,
        evaluator_id=evaluator.id,
        name=name,
        input_mapping=input_mapping,
        # Derived from the judge whenever they are read, so they follow its edits.
        output_configs=None,
        description=description,
        user_id=user_id,
        project=get_project_for_dataset_evaluator(
            dataset_name=dataset_name, dataset_evaluator_name=name.root
        ),
    )
    session.add(binding)
    await session.flush()
    return binding


async def create_dataset_decision_binding(
    context: EvaluatorServiceContext, input: CreateDatasetDecisionBindingInput
) -> models.DatasetEvaluators:
    """Attach a judge with a dataset-specific input mapping; scoring is the judge's own."""
    dataset_id = _id(input.dataset_id, "Dataset")
    try:
        async with context.db() as session:
            evaluator = await get_decision_evaluator(
                session, _id(input.evaluator_id, "DecisionEvaluator"), lock=True
            )
            binding = await _bind_decision_to_dataset(
                session,
                dataset_id=dataset_id,
                evaluator=evaluator,
                name=input.name,
                input_mapping=input.input_mapping,
                description=input.description,
                user_id=context.user_id,
                output_configs=input.output_configs,
            )
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise await dataset_binding_name_taken(context, dataset_id, input.name) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return binding


async def create_dataset_decision_evaluator(
    context: EvaluatorServiceContext,
    *,
    dataset_id: GlobalID,
    name: Identifier,
    input_mapping: InputMapping,
    description: Optional[str] = None,
    evaluator_id: Optional[GlobalID] = None,
    decision_id: Optional[GlobalID] = None,
    evaluator_name: Optional[Identifier] = None,
    decision_version_id: Optional[GlobalID] = None,
    decision_version: Optional[models.DecisionVersion] = None,
    scoring_policy: Optional[DecisionScoringPolicy] = None,
) -> models.DatasetEvaluators:
    """Create a dataset binding and optionally its Decision and evaluator, atomically."""
    if evaluator_id is not None:
        if any(
            value is not None
            for value in (
                decision_id,
                evaluator_name,
                decision_version_id,
                decision_version,
                scoring_policy,
            )
        ):
            raise BadRequest("An existing evaluator cannot be combined with a new definition")
        return await create_dataset_decision_binding(
            context,
            CreateDatasetDecisionBindingInput(
                dataset_id=dataset_id,
                evaluator_id=evaluator_id,
                name=name,
                input_mapping=input_mapping,
                description=description,
            ),
        )
    if evaluator_name is None or (decision_version_id is None) == (decision_version is None):
        raise BadRequest(
            "Provide an evaluator name and exactly one saved version or draft Decision"
        )
    if decision_id is not None and decision_version is None:
        raise BadRequest("decisionId requires a draft Decision version")
    dataset_rowid = _id(dataset_id, "Dataset")
    try:
        async with context.db() as session:
            evaluator_name = await generate_unique_evaluator_name(
                session,
                evaluator_name,
                claim_decision=decision_version is not None and decision_id is None,
            )
            if decision_version is not None:
                await validate_decision_custom_provider(session, decision_version)
                if decision_id is None:
                    decision = models.Decision(
                        name=evaluator_name,
                        description=description,
                        metadata_={},
                        user_id=context.user_id,
                        decision_versions=[decision_version],
                    )
                    session.add(decision)
                else:
                    existing_decision = await session.get(
                        models.Decision, _id(decision_id, "Decision")
                    )
                    if existing_decision is None:
                        raise NotFound("Decision not found")
                    decision_version.decision_id = existing_decision.id
                    session.add(decision_version)
                await session.flush()
                version = decision_version
            else:
                assert decision_version_id is not None
                version = await _version(session, decision_version_id)
            evaluator = _new_decision_evaluator(
                name=evaluator_name,
                description=description,
                user_id=context.user_id,
                version=version,
                scoring_policy=scoring_policy,
            )
            session.add(evaluator)
            await session.flush()
            binding = await _bind_decision_to_dataset(
                session,
                dataset_id=dataset_rowid,
                evaluator=evaluator,
                name=name,
                input_mapping=input_mapping,
                description=description,
                user_id=context.user_id,
            )
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise Conflict(
            "A Decision, evaluator, or dataset binding with this name already exists"
        ) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return binding


async def update_dataset_decision_evaluator(
    context: EvaluatorServiceContext,
    *,
    dataset_evaluator_id: GlobalID,
    name: Optional[Identifier] = UNSET,
    description: Optional[str] = UNSET,
    input_mapping: Optional[InputMapping] = UNSET,
    decision_version_id: Optional[GlobalID] = UNSET,
    decision_version: Optional[models.DecisionVersion] = None,
    scoring_policy: Optional[DecisionScoringPolicy] = UNSET,
) -> models.DatasetEvaluators:
    """Save a Decision version, shared scoring, and this dataset's mapping together."""
    if decision_version is not None and decision_version_id is not UNSET:
        raise BadRequest("Provide either a saved version or a draft Decision, not both")
    if name is None:
        raise BadRequest("Invalid evaluator name: name cannot be null")
    if input_mapping is None or scoring_policy is None or decision_version_id is None:
        raise BadRequest("Name, input mapping, scoring policy, and version cannot be null")
    try:
        async with context.db() as session:
            binding = await session.get(
                models.DatasetEvaluators, _id(dataset_evaluator_id, "DatasetEvaluator")
            )
            if binding is None:
                raise NotFound("Dataset evaluator not found")
            evaluator = await session.get(
                models.DecisionEvaluator, binding.evaluator_id, with_for_update=True
            )
            if evaluator is None:
                raise BadRequest("The dataset evaluator is not a decision evaluator")
            await session.refresh(binding)
            version: Optional[models.DecisionVersion] = None
            if decision_version is not None:
                await validate_decision_custom_provider(session, decision_version)
                decision_version.decision_id = evaluator.decision_id
                session.add(decision_version)
                await session.flush()
                version = decision_version
            elif decision_version_id is not UNSET:
                version = await _version(session, decision_version_id)
            selected = await _apply_decision_version_and_policy(
                session, evaluator, version, scoring_policy, user_id=context.user_id
            )
            mapping = binding.input_mapping if input_mapping is UNSET else input_mapping
            validate_decision_input_mapping(selected, mapping)
            values = DatasetEvaluatorWriteValues(
                input_mapping=mapping,
                user_id=context.user_id,
            )
            if name is not UNSET:
                values["name"] = name
            if description is not UNSET:
                values["description"] = description
            binding = await write_dataset_evaluator(session, binding.id, values)
            await session.flush()
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise Conflict("An evaluator with this name already exists in the dataset") from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return binding
