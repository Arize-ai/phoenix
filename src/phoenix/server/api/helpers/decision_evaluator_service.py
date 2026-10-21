"""Saved decision evaluators and dataset bindings, with owned pins and compatibility checks."""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Optional, Sequence

from sqlalchemy import select, true
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.decision_evaluators import (
    DecisionScoringPolicy,
    adapt_scoring_policy,
    resolve_scoring_policy,
)
from phoenix.db.types.evaluator_definition import (
    InlineDecisionEvaluatorDefinition,
    StoredDecisionEvaluatorDefinition,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.decision_evaluators import (
    capture_decision_evaluator_definition,
)
from phoenix.server.api.helpers.evaluator_management import (
    generate_unique_evaluator_name,
    get_project_for_dataset_evaluator,
)
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
    evaluator = await session.get(models.DecisionEvaluator, row_id, with_for_update=lock)
    if evaluator is None:
        raise NotFound(f"Decision evaluator not found: {row_id}")
    return evaluator


async def _version(session: AsyncSession, version_id: GlobalID) -> models.DecisionVersion:
    rowid = _id(version_id, "DecisionVersion")
    version = await session.get(models.DecisionVersion, rowid)
    if version is None:
        raise NotFound(f"Decision version not found: {rowid}")
    return version


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
        decision_version_id=version.id,
        selected_version=version,
        scoring_policy=resolve_scoring_policy(
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
    """Create a saved judge pinned to an explicit decision version."""
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
        raise await _name_taken(context, input.name) from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return evaluator


@dataclass(kw_only=True)
class DecisionEvaluatorPatch:
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    decision_version_id: Optional[GlobalID] = UNSET
    scoring_policy: Optional[DecisionScoringPolicy] = UNSET


def _signature(version: models.DecisionVersion) -> tuple[Any, ...]:
    """What a binding depends on: input names it maps, and the outputs it is scored by.

    Order is not part of it: reordering inputs, questions, or choices changes no mapping or
    annotation name. A scale's levels are ordered, because a level's index is its score.
    Input JSON schemas are descriptive and are not enforced, so they are not part of it.
    """
    return (
        frozenset(input.name for input in version.inputs),
        frozenset(
            (
                question.name,
                question.type,
                frozenset(choice.value for choice in question.choices)
                if question.type == "choice"
                else tuple(level.label for level in question.levels)
                if question.type == "scale"
                else None,
            )
            for question in version.questions
        ),
    )


async def validate_bound_decision_update(
    session: AsyncSession,
    evaluator: models.DecisionEvaluator,
    version: models.DecisionVersion,
    *,
    editing_binding_id: Optional[int] = None,
) -> None:
    """Reject changes that invalidate a dataset or project binding."""
    if _signature(evaluator.selected_version) == _signature(version):
        return
    bindings = list(
        await session.scalars(
            select(models.DatasetEvaluators).where(
                models.DatasetEvaluators.evaluator_id == evaluator.id,
                models.DatasetEvaluators.id != editing_binding_id
                if editing_binding_id is not None
                else true(),
            )
        )
    )
    project_bindings = list(
        await session.scalars(
            select(models.ProjectEvaluator).where(
                models.ProjectEvaluator.evaluator_id == evaluator.id
            )
        )
    )
    if bindings or project_bindings:
        broken = [
            f"{kind} evaluators " + ", ".join(sorted(f"'{binding.name.root}'" for binding in group))
            for kind, group in (("dataset", bindings), ("project", project_bindings))
            if group
        ]
        raise Conflict(
            f"Changing decision inputs, question names, types, choices, or scale levels "
            f"would break {' and '.join(broken)}; detach them or create a new evaluator",
            reason="incompatible_override",
            dataset_evaluator_ids=[
                str(GlobalID("DatasetEvaluator", str(binding.id))) for binding in bindings
            ],
            project_evaluator_ids=[
                str(GlobalID("ProjectEvaluator", str(binding.id))) for binding in project_bindings
            ],
        )


async def _apply_decision_version_and_policy(
    session: AsyncSession,
    evaluator: models.DecisionEvaluator,
    version: models.DecisionVersion,
    scoring_policy: Optional[DecisionScoringPolicy],
    *,
    editing_binding_id: Optional[int] = None,
) -> None:
    if version.decision_id != evaluator.selected_version.decision_id:
        raise BadRequest("A decision evaluator can only be pinned to versions of its own decision")
    if scoring_policy is None:
        raise BadRequest("scoring_policy cannot be null")
    # A policy the caller sends must fit the version; the saved one is carried over.
    policy = (adapt_scoring_policy if scoring_policy is UNSET else resolve_scoring_policy)(
        version.questions,
        evaluator.scoring_policy if scoring_policy is UNSET else scoring_policy,
    )
    await validate_bound_decision_update(
        session, evaluator, version, editing_binding_id=editing_binding_id
    )
    evaluator.decision_version_id = version.id
    evaluator.selected_version = version
    evaluator.scoring_policy = policy


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
            await _apply_decision_version_and_policy(
                session, evaluator, version, patch.scoring_policy
            )
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
    """Delete an unbound judge."""
    async with context.db() as session:
        evaluator = await session.get(
            models.DecisionEvaluator,
            _id(evaluator_id, "DecisionEvaluator"),
            with_for_update=True,
        )
        if evaluator is None:
            return
        await _refuse_bound_evaluator(session, evaluator.id, evaluator_id)
        await session.delete(evaluator)


# The keys of the context a dataset evaluator judges a run with (see experiment_runner).
EVALUATOR_CONTEXT_KEYS = ("input", "output", "reference", "metadata")
# What online evaluation fills from a span, trace, or session; there is no reference.
PROJECT_EVALUATOR_CONTEXT_KEYS = ("input", "output", "metadata")


def validate_decision_input_mapping(
    version: models.DecisionVersion,
    input_mapping: Optional[InputMapping],
    *,
    context_keys: Sequence[str] = EVALUATOR_CONTEXT_KEYS,
    context: str = "experiment run",
) -> None:
    """Reject a mapping that names undeclared inputs or leaves a declared one unfillable.

    Undeclared keys would otherwise be silently dropped at run time. An unmapped declared
    input is filled from the context only when it is named like one of the context's
    keys; any other would fail every run as missing.
    """
    declared = [input.name for input in version.inputs]
    mapped = (
        set(input_mapping.path_mapping) | set(input_mapping.literal_mapping)
        if input_mapping is not None
        else set()
    )
    if unknown := sorted(mapped - set(declared)):
        raise BadRequest(
            f"Input mapping names undeclared inputs: {', '.join(repr(k) for k in unknown)}. "
            f"Declared inputs: {', '.join(repr(n) for n in declared) or 'none'}"
        )
    if unfilled := [name for name in declared if name not in mapped and name not in context_keys]:
        raise BadRequest(
            f"Map the inputs {', '.join(repr(name) for name in unfilled)}: only inputs named "
            f"{', '.join(repr(key) for key in context_keys)} are filled from the "
            f"{context} without a mapping"
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
    from phoenix.server.api.helpers.dataset_evaluator_service import _dataset_binding_name_taken

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
    max_request_bytes: Optional[int] = None,
) -> "DecisionEvaluator":
    """Build a native judge from its saved or frozen definition."""
    from phoenix.server.api.decision_evaluator import DecisionEvaluator
    from phoenix.server.api.helpers.decision_clients import (
        get_custom_provider_decision_client,
        get_decision_client,
    )
    from phoenix.server.api.helpers.decision_versions import validate_inputs, validate_questions
    from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

    if isinstance(definition, StoredDecisionEvaluatorDefinition):
        definition = capture_decision_evaluator_definition(
            await get_decision_evaluator(session, definition.decision_evaluator_id)
        )
    try:
        validate_inputs(definition.inputs, definition.state)
        validate_questions(definition.questions)
        resolve_scoring_policy(definition.questions, definition.scoring_policy)
    except ValueError as error:
        raise BadRequest(str(error)) from error
    if definition.custom_provider_id is not None:
        client = await get_custom_provider_decision_client(
            custom_provider_id=definition.custom_provider_id,
            model_name=definition.model_name,
            session=session,
            decrypt=decrypt,
        )
    else:
        client = await get_decision_client(
            provider=GenerativeProviderKey.from_model_provider(definition.model_provider),
            model_name=definition.model_name,
            base_url=None,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
        )
    return DecisionEvaluator(definition, client, max_request_bytes=max_request_bytes)


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
    from phoenix.server.api.helpers.decision_versions import validate_decision_custom_provider

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
    """Save a Decision version, shared scoring, and this dataset's mapping together.

    Other dataset and project bindings retain their input and output contracts. The
    edited binding may change those contracts because its mapping is saved atomically.
    """
    from phoenix.server.api.helpers.dataset_evaluator_service import _write_dataset_evaluator
    from phoenix.server.api.helpers.decision_versions import validate_decision_custom_provider

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
            original = evaluator.selected_version
            if decision_version is not None:
                await validate_decision_custom_provider(session, decision_version)
                decision_version.decision_id = original.decision_id
                session.add(decision_version)
                await session.flush()
                version = decision_version
            elif decision_version_id is not UNSET:
                version = await _version(session, decision_version_id)
            else:
                version = original
            await _apply_decision_version_and_policy(
                session, evaluator, version, scoring_policy, editing_binding_id=binding.id
            )
            mapping = binding.input_mapping if input_mapping is UNSET else input_mapping
            validate_decision_input_mapping(version, mapping)
            values: dict[str, Any] = {"input_mapping": mapping, "user_id": context.user_id}
            if name is not UNSET:
                values["name"] = name
            if description is not UNSET:
                values["description"] = description
            binding = await _write_dataset_evaluator(session, binding.id, values)
            await session.flush()
    except (IntegrityError, SQLiteIntegrityError) as error:
        raise Conflict("An evaluator with this name already exists in the dataset") from error
    except ValueError as error:
        raise BadRequest(str(error)) from error
    return binding
