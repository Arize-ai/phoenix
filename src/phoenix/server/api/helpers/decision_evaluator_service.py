"""Saved decision evaluators and dataset bindings, with owned pins and compatibility checks."""

from dataclasses import dataclass
from secrets import token_hex
from typing import TYPE_CHECKING, Any, Callable, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.decision_evaluators import (
    DecisionProjectionPolicy,
    effective_decision_policy,
    resolve_projection_policy,
)
from phoenix.db.types.evaluator_definition import (
    InlineDecisionEvaluatorDefinition,
    StoredDecisionEvaluatorDefinition,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.decision_evaluators import (
    freeze_decision_evaluator,
    validate_decision_output_overrides,
)
from phoenix.server.api.helpers.evaluator_management import get_project_for_dataset_evaluator
from phoenix.server.api.helpers.evaluator_service import (
    EvaluatorServiceContext,
    _name_taken,
    _refuse_bound_evaluator,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.types.node import from_global_id_with_expected_type

if TYPE_CHECKING:
    from phoenix.server.api.decision_evaluator import DecisionEvaluator


def _id(value: GlobalID, kind: str) -> int:
    try:
        return from_global_id_with_expected_type(value, kind)
    except ValueError as error:
        raise BadRequest(str(error)) from error


async def get_decision_evaluator(
    session: AsyncSession, row_id: int, *, lock: bool = False
) -> models.DecisionEvaluator:
    """Load a saved judge and its pinned version, optionally locking its definition."""
    stmt = select(models.DecisionEvaluator).where(models.DecisionEvaluator.id == row_id)
    if lock:
        stmt = stmt.with_for_update(of=models.Evaluator)
    evaluator = await session.scalar(stmt)
    if evaluator is None:
        raise NotFound(f"Decision evaluator not found: {row_id}")
    return evaluator


async def _version(session: AsyncSession, version_id: GlobalID) -> models.DecisionVersion:
    return await _version_by_rowid(session, _id(version_id, "DecisionVersion"))


async def _version_by_rowid(session: AsyncSession, rowid: int) -> models.DecisionVersion:
    version = await session.get(models.DecisionVersion, rowid)
    if version is None:
        raise NotFound(f"Decision version not found: {rowid}")
    if version.schema_version != 1:
        raise BadRequest("Unsupported decision schema version")
    return version


@dataclass(kw_only=True)
class CreateDecisionEvaluatorInput:
    name: Identifier
    decision_version_id: GlobalID
    description: Optional[str] = None
    projection_policy: Optional[dict[str, Any]] = None


async def create_decision_evaluator(
    context: EvaluatorServiceContext, input: CreateDecisionEvaluatorInput
) -> models.DecisionEvaluator:
    """Create a saved judge pinned to an explicit decision version by an owned tag."""
    try:
        async with context.db() as session:
            version = await _version(session, input.decision_version_id)
            policy = resolve_projection_policy(
                version.questions,
                DecisionProjectionPolicy.model_validate(input.projection_policy or {}),
            )
            tag = models.DecisionVersionTag(
                name=Identifier(f"{input.name.root}-evaluator-{token_hex(4)}"),
                decision_id=version.decision_id,
                decision_version_id=version.id,
                user_id=context.user_id,
            )
            session.add(tag)
            await session.flush()
            evaluator = models.DecisionEvaluator(
                name=input.name,
                description=input.description,
                metadata_={},
                user_id=context.user_id,
                kind="DECISION",
                decision_id=version.decision_id,
                decision_version_tag_id=tag.id,
                projection_policy=policy.model_dump(mode="json"),
            )
            session.add(evaluator)
            await session.flush()
            await session.refresh(evaluator)
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise await _name_taken(context, input.name) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return evaluator


@dataclass(kw_only=True)
class DecisionEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    projection_policy: Optional[dict[str, Any]] = UNSET


def _signature(definition: InlineDecisionEvaluatorDefinition) -> tuple[Any, ...]:
    """What a binding depends on: input names it maps, and the outputs it is scored by.

    Order is not part of it: reordering inputs, questions, or choices changes no mapping or
    annotation name. A scale's levels are ordered, because a level's index is its score.
    Input JSON schemas are descriptive and are not enforced, so they are not part of it.
    """
    return (
        frozenset(input.name for input in definition.inputs),
        frozenset(
            (
                question.name,
                question.type,
                frozenset(choice.value for choice in question.choices)
                if question.type == "choice"
                else tuple((level.label, level.description) for level in question.levels)
                if question.type == "scale"
                else None,
            )
            for question in definition.questions
        ),
    )


async def validate_bound_decision_update(
    session: AsyncSession,
    evaluator: models.DecisionEvaluator,
    version: models.DecisionVersion,
    policy: dict[str, Any],
) -> None:
    """Reject changes that invalidate a dataset binding or its scoring override."""
    bindings = list(
        await session.scalars(
            select(models.DatasetEvaluators).where(
                models.DatasetEvaluators.evaluator_id == evaluator.id
            )
        )
    )
    original = freeze_decision_evaluator(evaluator)
    candidate = original.model_copy(
        update={"inputs": version.inputs, "state": version.state, "questions": version.questions}
    )
    if bindings and _signature(original) != _signature(candidate):
        names = ", ".join(sorted(f"'{binding.name.root}'" for binding in bindings))
        raise Conflict(
            f"Changing decision inputs, question names, types, choices, or scale levels "
            f"would break dataset evaluators {names}; detach them or create a new evaluator",
            reason="incompatible_override",
            dataset_evaluator_ids=[
                str(GlobalID("DatasetEvaluator", str(binding.id))) for binding in bindings
            ],
        )
    try:
        candidate = candidate.model_copy(
            update={
                "projection_policy": resolve_projection_policy(
                    version.questions, DecisionProjectionPolicy.model_validate(policy)
                )
            }
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error
    for binding in bindings:
        try:
            binding_policy = effective_decision_policy(
                version.questions, policy, binding.decision_projection_policy
            )
            validate_decision_output_overrides(
                candidate.model_copy(update={"projection_policy": binding_policy}),
                binding.output_configs,
            )
        except ValueError as error:
            raise Conflict(
                f"Dataset evaluator '{binding.name.root}' is incompatible: {error}",
                reason="incompatible_override",
                dataset_evaluator_ids=[str(GlobalID("DatasetEvaluator", str(binding.id)))],
            ) from error


async def patch_decision_evaluator(
    context: EvaluatorServiceContext, evaluator_id: GlobalID, patch: DecisionEvaluatorPatch
) -> models.DecisionEvaluator:
    """Patch a saved judge while preserving all existing binding contracts."""
    try:
        async with context.db() as session:
            evaluator = await get_decision_evaluator(
                session, _id(evaluator_id, "DecisionEvaluator"), lock=True
            )
            version = (
                await _version(session, patch.decision_version_id)
                if patch.decision_version_id is not UNSET and patch.decision_version_id is not None
                else evaluator.selected_version
            )
            if version.decision_id != evaluator.decision_id:
                raise BadRequest(
                    "A decision evaluator can only be pinned to versions of its own decision"
                )
            if patch.projection_policy is None and patch.projection_policy is not UNSET:
                raise BadRequest("projection_policy cannot be null")
            policy = (
                evaluator.projection_policy
                if patch.projection_policy is UNSET
                else patch.projection_policy
            )
            assert policy is not None
            policy = resolve_projection_policy(
                version.questions, DecisionProjectionPolicy.model_validate(policy)
            ).model_dump(mode="json")
            await validate_bound_decision_update(session, evaluator, version, policy)
            tag = await session.get(models.DecisionVersionTag, evaluator.decision_version_tag_id)
            assert tag is not None
            tag.decision_version_id = version.id
            evaluator.projection_policy = policy
            if patch.name is not UNSET and patch.name is not None:
                evaluator.name = patch.name
            if patch.description is not UNSET:
                evaluator.description = patch.description
            await session.flush()
            await session.refresh(evaluator)
    except (IntegrityError, SQLiteIntegrityError) as error:
        if patch.name is not UNSET and patch.name is not None:
            raise await _name_taken(context, patch.name) from error
        raise Conflict("The decision evaluator could not be updated") from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return evaluator


async def delete_decision_evaluator(
    context: EvaluatorServiceContext, evaluator_id: GlobalID
) -> None:
    """Delete an unbound judge and release its owned version tag."""
    async with context.db() as session:
        evaluator = await session.get(
            models.DecisionEvaluator, _id(evaluator_id, "DecisionEvaluator")
        )
        if evaluator is None:
            return
        await get_decision_evaluator(session, evaluator.id, lock=True)
        await _refuse_bound_evaluator(session, evaluator.id, evaluator_id)
        tag_id = evaluator.decision_version_tag_id
        await session.delete(evaluator)
        await session.flush()
        tag = await session.get(models.DecisionVersionTag, tag_id)
        if tag is not None:
            await session.delete(tag)


async def guard_owned_decision_tag_move(
    session: AsyncSession, tag: models.DecisionVersionTag, version_id: int
) -> None:
    """Validate generic tag moves against any evaluator that owns the tag."""
    evaluator_id = await session.scalar(
        select(models.DecisionEvaluator.id).where(
            models.DecisionEvaluator.decision_version_tag_id == tag.id
        )
    )
    if evaluator_id is None:
        return
    evaluator = await get_decision_evaluator(session, evaluator_id, lock=True)
    version = await _version_by_rowid(session, version_id)
    await validate_bound_decision_update(session, evaluator, version, evaluator.projection_policy)


@dataclass(kw_only=True)
class CreateDatasetDecisionBindingInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: InputMapping
    description: Optional[str] = None
    projection_policy: Optional[dict[str, Any]] = None
    output_configs: Optional[list[OutputConfigType]] = None


async def create_dataset_decision_binding(
    context: EvaluatorServiceContext, input: CreateDatasetDecisionBindingInput
) -> models.DatasetEvaluators:
    """Attach a judge with dataset-specific mapping and optional scoring settings."""
    from phoenix.server.api.helpers.dataset_evaluator_service import _dataset_binding_name_taken

    dataset_id = _id(input.dataset_id, "Dataset")
    try:
        async with context.db() as session:
            evaluator = await get_decision_evaluator(
                session, _id(input.evaluator_id, "DecisionEvaluator"), lock=True
            )
            dataset_name = await session.scalar(
                select(models.Dataset.name).where(models.Dataset.id == dataset_id)
            )
            if dataset_name is None:
                raise NotFound("Dataset not found")
            definition = freeze_decision_evaluator(
                evaluator, policy_override=input.projection_policy
            )
            validate_decision_output_overrides(definition, input.output_configs)
            binding = models.DatasetEvaluators(
                dataset_id=dataset_id,
                evaluator_id=evaluator.id,
                name=input.name,
                input_mapping=input.input_mapping,
                # Derived from the judge whenever they are read, so they follow its edits.
                output_configs=None,
                description=input.description,
                decision_projection_policy=input.projection_policy,
                user_id=context.user_id,
                project=get_project_for_dataset_evaluator(
                    dataset_name=dataset_name, dataset_evaluator_name=input.name.root
                ),
            )
            session.add(binding)
            await session.flush()
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise await _dataset_binding_name_taken(context, dataset_id, input.name) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return binding


async def build_decision_evaluator(
    definition: InlineDecisionEvaluatorDefinition | StoredDecisionEvaluatorDefinition,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Optional[Sequence[GenerativeCredentialInput]] = None,
    sdk_retries: bool = False,
) -> "DecisionEvaluator":
    """Build a native judge from its saved or frozen definition.

    SDK retries are off by default because the experiment runner owns retries; a preview,
    which nothing retries, turns them on.
    """
    from phoenix.server.api.decision_evaluator import DecisionEvaluator
    from phoenix.server.api.helpers.decision_clients import (
        get_custom_provider_decision_client,
        get_decision_client,
    )
    from phoenix.server.api.helpers.decision_versions import validate_inputs, validate_questions
    from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

    if isinstance(definition, StoredDecisionEvaluatorDefinition):
        definition = freeze_decision_evaluator(
            await get_decision_evaluator(session, definition.decision_evaluator_id)
        )
    try:
        validate_inputs(definition.inputs, definition.state)
        validate_questions(definition.questions)
        resolve_projection_policy(definition.questions, definition.projection_policy)
    except ValueError as error:
        raise BadRequest(str(error)) from error
    if definition.custom_provider_id is not None:
        client = await get_custom_provider_decision_client(
            custom_provider_id=definition.custom_provider_id,
            model_name=definition.model_name,
            session=session,
            decrypt=decrypt,
            sdk_retries=sdk_retries,
        )
    else:
        client = await get_decision_client(
            provider=GenerativeProviderKey.from_model_provider(definition.model_provider),
            model_name=definition.model_name,
            base_url=None,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
            sdk_retries=sdk_retries,
        )
    return DecisionEvaluator(definition, client)
