from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from secrets import token_hex
from typing import Any, Mapping, Optional, cast

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import and_, delete, func, select, true
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info
from strawberry.utils.str_converters import to_camel_case

from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    code_evaluator_with_latest_version,
    delete_projects_and_evaluator_trace_projects,
)
from phoenix.db.models import EvaluatorKind
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    AnnotationType,
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    _infer_python_evaluate_input_schema,
    _infer_typescript_evaluate_input_schema,
    get_builtin_evaluator_by_key,
)
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers.evaluators import (
    LLMEvaluatorOutputConfigs,
    validate_consistent_llm_evaluator_and_prompt_version,
    validate_unique_config_names,
)
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigInput,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.queries import Query
from phoenix.server.api.types.AnnotatorKind import AnnotatorKind
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluator,
    CodeEvaluator,
    DatasetEvaluator,
    EvaluationTarget,
    LLMEvaluator,
    ProjectEvaluator,
)
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectEvaluatorTrigger import (
    AnnotationChange,
    AnnotationTarget,
    EvaluatorEventKind,
    ProjectEvaluatorTrigger,
    to_gql_project_evaluator_trigger,
)
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.api.types.SandboxConfig import (
    Language,
    SandboxConfig,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.online_eval.session_policy import (
    DEFAULT_SESSION_EVALUATION_DELAY_SECONDS,
    MINIMUM_EVALUATION_DELAY_SECONDS,
)
from phoenix.server.sandbox import SANDBOX_ADAPTERS
from phoenix.server.sandbox.types import SandboxRuntimeContext, SandboxValidationUnavailable
from phoenix.server.session_filters import validate_session_filter_condition
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import validate_span_filter_condition

_EVALUATOR_KIND_BY_TYPENAME: dict[str, EvaluatorKind] = {
    LLMEvaluator.__name__: "LLM",
    CodeEvaluator.__name__: "CODE",
    BuiltInEvaluator.__name__: "BUILTIN",
}

_PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION = (
    "SPAN evaluators run on matching sampled spans. Background SESSION evaluation runs once "
    "per evaluator configuration at the first quiet period after the evaluation delay: it "
    "applies the session filter first, then deterministic sampling, and schedules admitted "
    "evaluations asynchronously. Matching trigger rules and explicit requests can schedule "
    "additional evaluations. An explicit request supersedes an earlier filter or sampling "
    "decline. TRACE evaluators are stored but not scheduled. Only SESSION scheduling honors "
    "the evaluation delay, which a SPAN target rejects. The target is fixed at creation."
)


def _output_config_input_to_pydantic(input: AnnotationConfigInput) -> OutputConfigType:
    """
    Convert AnnotationConfigInput to pydantic for evaluator output configs.
    Always includes name.
    """
    if input.categorical is not None and input.categorical is not UNSET:
        cat = input.categorical
        return CategoricalOutputConfig(
            type=AnnotationType.CATEGORICAL.value,
            name=cat.name,
            description=cat.description,
            optimization_direction=cat.optimization_direction,
            values=[CategoricalAnnotationValue(label=v.label, score=v.score) for v in cat.values],
        )
    elif input.continuous is not None and input.continuous is not UNSET:
        cont = input.continuous
        return ContinuousOutputConfig(
            type=AnnotationType.CONTINUOUS.value,
            name=cont.name,
            description=cont.description,
            optimization_direction=cont.optimization_direction,
            lower_bound=cont.lower_bound,
            upper_bound=cont.upper_bound,
        )
    elif input.freeform is not None and input.freeform is not UNSET:
        free = input.freeform
        return FreeformOutputConfig(
            type=AnnotationType.FREEFORM.value,
            name=free.name,
            description=free.description,
            optimization_direction=free.optimization_direction,
            thresholds=[free.threshold] if free.threshold is not None else None,
            lower_bound=free.lower_bound,
            upper_bound=free.upper_bound,
        )
    raise BadRequest("Invalid output config input")


def _convert_output_config_inputs_to_pydantic(
    configs: list[AnnotationConfigInput],
) -> list[OutputConfigType]:
    """Convert a list of AnnotationConfigInput to pydantic models for evaluator output configs."""
    return [_output_config_input_to_pydantic(c) for c in configs]


def _raise_on_uninferable_evaluate_signature(source_code: str, language: Language) -> None:
    if language is Language.PYTHON:
        _, error_message = _infer_python_evaluate_input_schema(source_code)
    elif language is Language.TYPESCRIPT:
        _, error_message = _infer_typescript_evaluate_input_schema(source_code)
    else:
        error_message = f"Unsupported code evaluator language: {language.value}"
    if error_message is not None:
        raise BadRequest(error_message)


async def _validate_code_evaluator_sandbox_config(
    db: DbSessionFactory,
    *,
    sandbox_config_global_id: GlobalID,
    language: str,
    action: str,
    source_code: str,
    sandbox_runtime: SandboxRuntimeContext,
) -> int:
    sandbox_config_id = from_global_id_with_expected_type(
        sandbox_config_global_id, SandboxConfig.__name__
    )
    async with db() as session:
        config_and_provider = (
            await session.execute(
                select(models.SandboxConfig, models.SandboxProvider)
                .outerjoin(
                    models.SandboxProvider,
                    models.SandboxProvider.backend_type == models.SandboxConfig.backend_type,
                )
                .where(models.SandboxConfig.id == sandbox_config_id)
            )
        ).one_or_none()
        if config_and_provider is None:
            raise BadRequest(f"Sandbox config not found: {sandbox_config_global_id}")
        target_cfg, provider = config_and_provider
        if not target_cfg.enabled:
            raise BadRequest(
                f"Sandbox configuration '{target_cfg.name}' is disabled. Enable it before {action}."
            )

        if provider is None:
            raise BadRequest(
                f"Sandbox provider for configuration '{target_cfg.name}' was not found"
            )
        if not provider.enabled:
            raise BadRequest(
                f"Sandbox provider '{provider.backend_type}' is disabled. "
                f"Enable it before {action}."
            )

        if target_cfg.language != language:
            raise BadRequest("Evaluator language does not match sandbox config language")

        adapter = SANDBOX_ADAPTERS.get(target_cfg.backend_type)
        if adapter is None:
            return sandbox_config_id
        validated_config = adapter.config_model.model_validate(
            {
                "backend_type": target_cfg.backend_type,
                "language": target_cfg.language,
                **(target_cfg.config or {}),
            }
        )

    # Sandboxed validation can wait for worker capacity. Run it after the short
    # metadata transaction releases SQLite's process-wide database lock.
    try:
        validation_error = await adapter.validate_code(
            validated_config,
            source_code,
            runtime=sandbox_runtime,
        )
    except SandboxValidationUnavailable as exc:
        raise BadRequest(
            f"Code could not be validated by the {adapter.display_name} runtime. Retry shortly."
        ) from exc
    if validation_error is not None:
        raise BadRequest(
            f"Code is not supported by the {adapter.display_name} runtime: {validation_error}"
        )

    return sandbox_config_id


async def _generate_unique_evaluator_name(
    session: AsyncSession,
    base_name: Identifier,
    max_attempts: int = 5,
) -> Identifier:
    """
    Generate a unique evaluator name by appending a suffix if needed.
    Returns the original name if unique, otherwise appends a random suffix.
    Retries up to max_attempts times if random collisions occur.
    """
    exists = await session.scalar(
        select(models.Evaluator.id).where(models.Evaluator.name == base_name).limit(1)
    )
    if exists is None:
        return base_name

    for _ in range(max_attempts):
        candidate = f"{base_name}-{token_hex(4)}"
        candidate_name = Identifier.model_validate(candidate)
        exists = await session.scalar(
            select(models.Evaluator.id).where(models.Evaluator.name == candidate_name).limit(1)
        )
        if exists is None:
            return candidate_name

    raise RuntimeError(f"Failed to generate unique evaluator name after {max_attempts} attempts")


def _get_project_for_dataset_evaluator(
    *,
    dataset_name: str,
    dataset_evaluator_name: str,
) -> models.Project:
    project_name_identifier = _get_dataset_evaluator_project_name_identifier()
    project_name = project_name_identifier.root
    return models.Project(
        name=project_name,
        description=(
            f"Traces for dataset evaluator: {dataset_evaluator_name} on dataset: {dataset_name}"
        ),
    )


def _get_dataset_evaluator_project_name_identifier() -> IdentifierModel:
    project_name = f"dataset-evaluator-{token_hex(12)}"
    return IdentifierModel.model_validate(project_name)


def _get_trace_project_for_project_evaluator(
    *,
    project_name: str,
    project_evaluator_name: str,
) -> models.Project:
    name = IdentifierModel.model_validate(f"project-evaluator-{token_hex(12)}")
    return models.Project(
        name=name.root,
        description=(
            f"Traces for project evaluator: {project_evaluator_name} on project: {project_name}"
        ),
    )


async def _ensure_evaluator_prompt_label(
    session: AsyncSession,
    prompt_id: int,
) -> None:
    """
    Ensures the "evaluator" label exists and is associated with the given prompt.

    Args:
        session: The active database session (must be within a transaction)
        prompt_id: The ID of the prompt to label
    """
    label_and_association = (
        await session.execute(
            select(models.PromptLabel, models.PromptPromptLabel)
            .outerjoin(
                models.PromptPromptLabel,
                and_(
                    models.PromptPromptLabel.prompt_label_id == models.PromptLabel.id,
                    models.PromptPromptLabel.prompt_id == prompt_id,
                ),
            )
            .where(models.PromptLabel.name == "evaluator")
        )
    ).one_or_none()

    if label_and_association is None:
        # Create the label if it doesn't exist
        label = models.PromptLabel(
            name="evaluator",
            description="Automatically assigned to prompts created for LLM evaluators",
            color="#4ecf50",
        )
        session.add(label)
        await session.flush()  # Flush to get the ID
        existing_association = None
    else:
        label, existing_association = label_and_association

    if existing_association is None:
        # Create the association if it doesn't exist
        association = models.PromptPromptLabel(
            prompt_id=prompt_id,
            prompt_label_id=label.id,
        )
        session.add(association)


async def _validate_project_evaluator_project(
    session: AsyncSession,
    project_id: int,
    project_global_id: GlobalID,
) -> models.Project:
    project = await session.get(models.Project, project_id)
    if project is None:
        raise NotFound(f"Project not found: {project_global_id}")
    holds_evaluator_traces = await session.scalar(
        select(models.ProjectEvaluator.id)
        .where(models.ProjectEvaluator.trace_project_id == project_id)
        .limit(1)
    )
    if holds_evaluator_traces is None:
        holds_evaluator_traces = await session.scalar(
            select(models.DatasetEvaluators.id)
            .where(models.DatasetEvaluators.project_id == project_id)
            .limit(1)
        )
    if holds_evaluator_traces is not None:
        raise BadRequest("This project holds evaluator traces and cannot be evaluated")
    return project


def _validate_project_evaluator_filter(
    filter_condition: str,
    evaluation_target: EvaluationTarget,
) -> None:
    """Validate a filter in the language of the target it selects.

    Spans and traces are filtered with the span filter DSL, sessions with the session
    filter DSL, so the expression is compiled by the same path its target's scheduler
    sweep will use.
    """
    try:
        if evaluation_target is EvaluationTarget.SESSION:
            validate_session_filter_condition(filter_condition)
        else:
            validate_span_filter_condition(filter_condition)
    except Exception:
        raise BadRequest("Invalid filter condition: unable to compile for supported databases")


def _validate_project_evaluator_sampling_rate(sampling_rate: float) -> None:
    if not 0.0 <= sampling_rate <= 1.0:
        raise BadRequest("samplingRate must be between 0.0 and 1.0")


def _materialize_project_evaluator_evaluation_delay(
    evaluation_delay_seconds: Optional[int],
    evaluation_target: EvaluationTarget,
) -> int:
    """Resolve the delay to store; only the session sweep waits one out.

    Span work is scheduled off the global ingestion frontier, so a delay supplied for a
    span evaluator is refused rather than stored as a setting that never applies.
    """
    if evaluation_delay_seconds is None:
        return DEFAULT_SESSION_EVALUATION_DELAY_SECONDS
    if evaluation_target is EvaluationTarget.SPAN:
        raise BadRequest(
            "evaluationDelaySeconds is not accepted for SPAN evaluators: span scheduling "
            "does not honor an evaluation delay"
        )
    if evaluation_delay_seconds < MINIMUM_EVALUATION_DELAY_SECONDS:
        raise BadRequest(
            f"evaluationDelaySeconds must be at least {MINIMUM_EVALUATION_DELAY_SECONDS} seconds"
        )
    return evaluation_delay_seconds


def _validate_project_evaluator_target_update(
    project_evaluator: models.ProjectEvaluator,
    evaluation_target: EvaluationTarget,
) -> None:
    if project_evaluator.evaluation_target == evaluation_target.value:
        return
    raise BadRequest("evaluationTarget is fixed at project evaluator creation")


async def _garbage_collect_evaluators(
    session: AsyncSession,
    *,
    evaluator_ids: set[int],
    prompt_ids: set[int],
    delete_associated_prompt: bool,
) -> None:
    if evaluator_ids:
        await session.execute(
            delete(models.Evaluator).where(
                models.Evaluator.id.in_(evaluator_ids),
                ~select(models.DatasetEvaluators.id)
                .where(models.DatasetEvaluators.evaluator_id == models.Evaluator.id)
                .exists(),
                ~select(models.ProjectEvaluator.id)
                .where(models.ProjectEvaluator.evaluator_id == models.Evaluator.id)
                .exists(),
            )
        )
    if delete_associated_prompt and prompt_ids:
        await session.execute(
            delete(models.Prompt).where(
                models.Prompt.id.in_(prompt_ids),
                ~select(models.LLMEvaluator.id)
                .where(models.LLMEvaluator.prompt_id == models.Prompt.id)
                .exists(),
            )
        )


def _parse_evaluator_id(global_id: GlobalID) -> tuple[int, EvaluatorKind]:
    """
    Parse evaluator ID accepting LLMEvaluator, CodeEvaluator and BuiltInEvaluator types.

    Returns:
        tuple of (evaluator_rowid, evaluator_kind)
    """
    type_name, evaluator_rowid = from_global_id(global_id)
    if type_name not in _EVALUATOR_KIND_BY_TYPENAME:
        raise ValueError(
            f"Invalid evaluator type: {type_name}. "
            f"Expected one of {', '.join(_EVALUATOR_KIND_BY_TYPENAME)}"
        )
    return evaluator_rowid, _EVALUATOR_KIND_BY_TYPENAME[type_name]


@strawberry.input
class CreateDatasetLLMEvaluatorInput:
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class UpdateDatasetLLMEvaluatorInput:
    dataset_evaluator_id: GlobalID
    dataset_id: GlobalID
    name: Identifier
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.type
class DatasetEvaluatorMutationPayload:
    evaluator: DatasetEvaluator
    query: Query


@strawberry.input
class CreateDatasetBuiltinEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    description: Optional[str] = None


@strawberry.input
class UpdateDatasetBuiltinEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET
    description: Optional[str] = UNSET


@strawberry.input
class CreateDatasetCodeEvaluatorInput:
    dataset_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    description: Optional[str] = None


@strawberry.input
class UpdateDatasetCodeEvaluatorInput:
    dataset_evaluator_id: GlobalID
    name: Identifier
    input_mapping: Optional[EvaluatorInputMappingInput] = None
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET
    description: Optional[str] = UNSET


@strawberry.input
class DeleteEvaluatorsInput:
    evaluator_ids: list[GlobalID]


@strawberry.type
class DeleteEvaluatorsPayload:
    evaluator_ids: list[GlobalID]
    query: Query


@strawberry.input
class DeleteDatasetEvaluatorsInput:
    dataset_evaluator_ids: list[GlobalID]
    delete_associated_prompt: bool = True


@strawberry.type
class DeleteDatasetEvaluatorsPayload:
    dataset_evaluator_ids: list[GlobalID]
    query: Query


@strawberry.input
class CreateProjectLLMEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    prompt_version_id: Optional[GlobalID] = UNSET
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit or use null to store the current default of "
            f"{DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} seconds. Background evaluation runs "
            "once per evaluator configuration; matching trigger rules and explicit requests "
            "can schedule additional evaluations, and an explicit request supersedes an "
            "earlier declined decision."
        ),
    )


@strawberry.input
class UpdateProjectLLMEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation target is fixed at project evaluator creation."
    )
    filter_condition: str
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    prompt_version_id: Optional[GlobalID] = UNSET
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=UNSET,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit to preserve the current setting, or use null "
            f"to store the current default of {DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} "
            "seconds. Background evaluation runs once per evaluator configuration; matching "
            "trigger rules and explicit requests can schedule additional evaluations, and an "
            "explicit request supersedes an earlier declined decision."
        ),
    )


@strawberry.input
class AddProjectCodeEvaluatorInput:
    project_id: GlobalID
    evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: EvaluationTarget
    input_mapping: Optional[EvaluatorInputMappingInput] = strawberry.field(
        default=None,
        description=(
            "Project-specific CODE input mapping. Null inherits the evaluator input mapping; "
            "an object overrides it."
        ),
    )
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit or use null to store the current default of "
            f"{DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} seconds. Background evaluation runs "
            "once per evaluator configuration; matching trigger rules and explicit requests "
            "can schedule additional evaluations, and an explicit request supersedes an "
            "earlier declined decision."
        ),
    )


@strawberry.input
class CreateProjectCodeEvaluatorInput:
    project_id: GlobalID
    name: Identifier
    source_code: str
    language: Language
    sandbox_config_id: GlobalID
    evaluator_input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget
    description: Optional[str] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    input_mapping: Optional[EvaluatorInputMappingInput] = strawberry.field(
        default=None,
        description=(
            "Project-specific CODE input mapping. Null inherits the evaluator input mapping; "
            "an object overrides it."
        ),
    )
    filter_condition: str = ""
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=None,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit or use null to store the current default of "
            f"{DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} seconds. Background evaluation runs "
            "once per evaluator configuration; matching trigger rules and explicit requests "
            "can schedule additional evaluations, and an explicit request supersedes an "
            "earlier declined decision."
        ),
    )


@strawberry.input
class UpdateProjectCodeEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    sampling_rate: float
    evaluation_target: EvaluationTarget = strawberry.field(
        description="The evaluation target is fixed at project evaluator creation."
    )
    filter_condition: str
    evaluator_input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    enabled: Optional[bool] = UNSET
    description: Optional[str] = UNSET
    source_code: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = strawberry.field(
        default=UNSET,
        description=(
            "Project-specific CODE input mapping patch. Omit to preserve the current setting, "
            "use null to inherit the evaluator input mapping, or provide an object to override it."
        ),
    )
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=UNSET,
        description=(
            "Seconds a SESSION must stay quiet before evaluation is scheduled; the minimum is "
            f"{MINIMUM_EVALUATION_DELAY_SECONDS} seconds. Only SESSION scheduling honors a "
            "delay, so a value supplied for a SPAN target is rejected, and TRACE evaluators "
            "are stored but not scheduled. Omit to preserve the current setting, or use null "
            f"to store the current default of {DEFAULT_SESSION_EVALUATION_DELAY_SECONDS} "
            "seconds. Background evaluation runs once per evaluator configuration; matching "
            "trigger rules and explicit requests can schedule additional evaluations, and an "
            "explicit request supersedes an earlier declined decision."
        ),
    )


@strawberry.input
class SetProjectEvaluatorEnabledInput:
    project_evaluator_id: GlobalID
    enabled: bool


@strawberry.type
class ProjectEvaluatorMutationPayload:
    evaluator: ProjectEvaluator
    query: Query


@strawberry.input
class DeleteProjectEvaluatorsInput:
    project_evaluator_ids: list[GlobalID]
    delete_associated_prompt: bool = True


@strawberry.type
class DeleteProjectEvaluatorsPayload:
    project_evaluator_ids: list[GlobalID]
    query: Query


@strawberry.input
class CreateCodeEvaluatorInput:
    name: Identifier
    source_code: str
    language: Language
    sandbox_config_id: GlobalID
    description: Optional[str] = None
    output_configs: Optional[list[AnnotationConfigInput]] = None
    input_mapping: Optional[EvaluatorInputMappingInput] = None


@strawberry.input
class PatchCodeEvaluatorInput:
    id: GlobalID
    name: Optional[Identifier] = UNSET
    description: Optional[str] = UNSET
    sandbox_config_id: Optional[GlobalID] = UNSET
    input_mapping: Optional[EvaluatorInputMappingInput] = UNSET
    output_configs: Optional[list[AnnotationConfigInput]] = UNSET


@strawberry.input
class CreateCodeEvaluatorVersionInput:
    code_evaluator_id: GlobalID
    source_code: str


@strawberry.type
class CodeEvaluatorMutationPayload:
    evaluator: CodeEvaluator
    query: Query


@strawberry.type
class CreateCodeEvaluatorVersionPayload:
    evaluator: CodeEvaluator
    was_created: bool = strawberry.field(
        description=(
            "True when a new CodeEvaluatorVersion row was appended. False when the call"
            " dedup'd against the existing tip because source_code was unchanged."
        )
    )
    query: Query


@strawberry.type
class EvaluatorMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=f"Create an LLM project evaluator. {_PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}",
    )  # type: ignore
    async def create_project_llm_evaluator(
        self, info: Info[Context, None], input: CreateProjectLLMEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
        except ValueError:
            raise BadRequest(f"Invalid project id: {input.project_id}")
        _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        evaluation_delay_seconds = _materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )
        try:
            name = IdentifierModel.model_validate(input.name)
            prompt_version = input.prompt_version.to_orm_prompt_version(None)
            output_configs = list(
                LLMEvaluatorOutputConfigs.from_inputs(input.output_configs).configs
            )
        except (ValueError, ValidationError) as error:
            raise BadRequest(str(error))

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
            prompt_version.user_id = user_id

        try:
            async with info.context.db() as session:
                project = await _validate_project_evaluator_project(
                    session, project_id, input.project_id
                )
                evaluator_name = await _generate_unique_evaluator_name(session, name)

                target_prompt_version_id: Optional[int] = None
                if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                    prompt_version_id = from_global_id_with_expected_type(
                        input.prompt_version_id, PromptVersion.__name__
                    )
                    existing_prompt_version = await session.get(
                        models.PromptVersion, prompt_version_id
                    )
                    if existing_prompt_version is None:
                        raise NotFound(f"Prompt version not found: {input.prompt_version_id}")
                    prompt = await session.get(models.Prompt, existing_prompt_version.prompt_id)
                    if prompt is None:
                        raise NotFound("Prompt for the selected version was not found")
                    if existing_prompt_version.has_identical_content(prompt_version):
                        target_prompt_version_id = existing_prompt_version.id
                    else:
                        prompt_version.prompt_id = prompt.id
                        session.add(prompt_version)
                        await session.flush()
                        target_prompt_version_id = prompt_version.id
                else:
                    prompt = models.Prompt(
                        name=IdentifierModel.model_validate(
                            f"{input.name}-evaluator-{token_hex(4)}"
                        ),
                        description=input.description,
                        prompt_versions=[prompt_version],
                    )

                evaluator = models.LLMEvaluator(
                    name=evaluator_name,
                    description=input.description,
                    kind="LLM",
                    output_configs=output_configs,
                    user_id=user_id,
                    prompt=prompt,
                )
                try:
                    validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)
                except ValueError as error:
                    raise BadRequest(str(error))
                session.add(evaluator)
                await session.flush()
                await _ensure_evaluator_prompt_label(session, prompt.id)
                evaluator.prompt_version_tag = models.PromptVersionTag(
                    name=IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}"),
                    prompt_id=prompt.id,
                    prompt_version_id=target_prompt_version_id or prompt_version.id,
                )
                project_evaluator = models.ProjectEvaluator(
                    project_id=project_id,
                    evaluator_id=evaluator.id,
                    trace_project=_get_trace_project_for_project_evaluator(
                        project_name=project.name,
                        project_evaluator_name=name.root,
                    ),
                    name=name,
                    filter_condition=input.filter_condition,
                    sampling_rate=input.sampling_rate,
                    evaluation_target=input.evaluation_target.value,
                    input_mapping=input.input_mapping.to_orm(),
                    evaluation_delay_seconds=evaluation_delay_seconds,
                    enabled=input.enabled,
                )
                session.add(project_evaluator)
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=project_evaluator.id, db_record=project_evaluator),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=f"Update an LLM project evaluator. {_PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}",
    )  # type: ignore
    async def update_project_llm_evaluator(
        self, info: Info[Context, None], input: UpdateProjectLLMEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_evaluator_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
        except ValueError:
            raise BadRequest(f"Invalid project evaluator id: {input.project_evaluator_id}")
        _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        if input.enabled is None:
            raise BadRequest("enabled cannot be set to null")
        if input.evaluation_delay_seconds is not UNSET:
            _materialize_project_evaluator_evaluation_delay(
                input.evaluation_delay_seconds, input.evaluation_target
            )
        try:
            name = IdentifierModel.model_validate(input.name)
            prompt_version = input.prompt_version.to_orm_prompt_version(None)
            output_configs = list(
                LLMEvaluatorOutputConfigs.from_inputs(input.output_configs).configs
            )
        except (ValueError, ValidationError) as error:
            raise BadRequest(str(error))

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
            prompt_version.user_id = user_id

        try:
            async with info.context.db() as session:
                pair = (
                    await session.execute(
                        select(models.ProjectEvaluator, models.LLMEvaluator)
                        .join(
                            models.LLMEvaluator,
                            models.ProjectEvaluator.evaluator_id == models.LLMEvaluator.id,
                        )
                        .where(models.ProjectEvaluator.id == project_evaluator_id)
                    )
                ).one_or_none()
                if pair is None:
                    raise NotFound(f"LLM project evaluator not found: {input.project_evaluator_id}")
                project_evaluator, evaluator = pair
                _validate_project_evaluator_target_update(
                    project_evaluator,
                    input.evaluation_target,
                )
                shared_evaluator_changed = False
                if project_evaluator.name != name:
                    evaluator.name = await _generate_unique_evaluator_name(session, name)
                    shared_evaluator_changed = True

                selected_version: Optional[models.PromptVersion] = None
                if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                    selected_version_id = from_global_id_with_expected_type(
                        input.prompt_version_id, PromptVersion.__name__
                    )
                    selected_version = await session.get(models.PromptVersion, selected_version_id)
                    if selected_version is None:
                        raise NotFound(f"Prompt version not found: {input.prompt_version_id}")
                elif evaluator.prompt_version_tag_id is not None:
                    selected_version = await session.scalar(
                        select(models.PromptVersion)
                        .join(
                            models.PromptVersionTag,
                            models.PromptVersionTag.prompt_version_id == models.PromptVersion.id,
                        )
                        .where(models.PromptVersionTag.id == evaluator.prompt_version_tag_id)
                    )

                target_prompt_id = (
                    selected_version.prompt_id
                    if selected_version is not None
                    else evaluator.prompt_id
                )
                final_prompt_version_id: Optional[int] = None
                if selected_version is not None and selected_version.has_identical_content(
                    prompt_version
                ):
                    final_prompt_version_id = selected_version.id
                else:
                    prompt_version.prompt_id = target_prompt_id
                    session.add(prompt_version)
                    await session.flush()
                    final_prompt_version_id = prompt_version.id
                    shared_evaluator_changed = True

                if input.description is not UNSET and evaluator.description != input.description:
                    evaluator.description = input.description
                    shared_evaluator_changed = True
                if evaluator.output_configs != output_configs:
                    evaluator.output_configs = output_configs
                    shared_evaluator_changed = True
                if evaluator.prompt_id != target_prompt_id:
                    evaluator.prompt_id = target_prompt_id
                    shared_evaluator_changed = True
                try:
                    validate_consistent_llm_evaluator_and_prompt_version(prompt_version, evaluator)
                except ValueError as error:
                    raise BadRequest(str(error))
                if evaluator.prompt_version_tag_id is None:
                    evaluator.prompt_version_tag = models.PromptVersionTag(
                        name=IdentifierModel.model_validate(
                            f"{input.name}-evaluator-{token_hex(4)}"
                        ),
                        prompt_id=target_prompt_id,
                        prompt_version_id=final_prompt_version_id,
                    )
                    shared_evaluator_changed = True
                else:
                    prompt_version_tag = await session.get(
                        models.PromptVersionTag, evaluator.prompt_version_tag_id
                    )
                    if prompt_version_tag is None:
                        raise NotFound("Prompt version tag was not found")
                    if (
                        prompt_version_tag.prompt_id != target_prompt_id
                        or prompt_version_tag.prompt_version_id != final_prompt_version_id
                    ):
                        prompt_version_tag.prompt_id = target_prompt_id
                        prompt_version_tag.prompt_version_id = final_prompt_version_id
                        shared_evaluator_changed = True

                if shared_evaluator_changed:
                    evaluator.user_id = user_id
                    evaluator.updated_at = datetime.now(timezone.utc)

                project_evaluator.name = name
                project_evaluator.filter_condition = input.filter_condition
                project_evaluator.sampling_rate = input.sampling_rate
                project_evaluator.evaluation_target = input.evaluation_target.value
                project_evaluator.input_mapping = input.input_mapping.to_orm()
                if input.evaluation_delay_seconds is not UNSET:
                    project_evaluator.evaluation_delay_seconds = (
                        _materialize_project_evaluator_evaluation_delay(
                            input.evaluation_delay_seconds, input.evaluation_target
                        )
                    )
                if input.enabled is not UNSET:
                    assert input.enabled is not None
                    project_evaluator.enabled = input.enabled
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=project_evaluator.id, db_record=project_evaluator),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Bind an existing CODE evaluator to a project. The evaluator's configuration is "
            "shared with every project and dataset it is bound to. "
            f"{_PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}"
        ),
    )  # type: ignore
    async def add_project_code_evaluator(
        self, info: Info[Context, None], input: AddProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
        except ValueError:
            raise BadRequest(f"Invalid project id: {input.project_id}")
        try:
            evaluator_id, evaluator_kind = _parse_evaluator_id(input.evaluator_id)
        except ValueError as error:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {error}")
        if evaluator_kind != "CODE":
            raise BadRequest("Evaluator must be a CODE evaluator")
        try:
            name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(str(error))
        _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        evaluation_delay_seconds = _materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )

        try:
            async with info.context.db() as session:
                project = await _validate_project_evaluator_project(
                    session, project_id, input.project_id
                )
                if await session.get(models.CodeEvaluator, evaluator_id) is None:
                    raise BadRequest("CODE evaluator not found")
                project_evaluator = models.ProjectEvaluator(
                    project_id=project_id,
                    evaluator_id=evaluator_id,
                    trace_project=_get_trace_project_for_project_evaluator(
                        project_name=project.name,
                        project_evaluator_name=name.root,
                    ),
                    name=name,
                    filter_condition=input.filter_condition,
                    sampling_rate=input.sampling_rate,
                    evaluation_target=input.evaluation_target.value,
                    input_mapping=(
                        input.input_mapping.to_orm() if input.input_mapping is not None else None
                    ),
                    evaluation_delay_seconds=evaluation_delay_seconds,
                    enabled=input.enabled,
                )
                session.add(project_evaluator)
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=project_evaluator.id, db_record=project_evaluator),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=f"Create a CODE project evaluator. {_PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}",
    )  # type: ignore
    async def create_project_code_evaluator(
        self, info: Info[Context, None], input: CreateProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
            name = IdentifierModel.model_validate(input.name)
        except (ValueError, ValidationError) as error:
            raise BadRequest(str(error))
        _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        evaluation_delay_seconds = _materialize_project_evaluator_evaluation_delay(
            input.evaluation_delay_seconds, input.evaluation_target
        )
        _raise_on_uninferable_evaluate_signature(input.source_code, input.language)
        if input.output_configs is not None:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as error:
                raise BadRequest(str(error))
        output_configs = cast(
            list[AnnotationConfigType],
            _convert_output_config_inputs_to_pydantic(input.output_configs or []),
        )

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        # Validated before the write session opens: the helper takes the session
        # factory and opens its own session, which would otherwise nest inside
        # the transaction below.
        sandbox_config_id = await _validate_code_evaluator_sandbox_config(
            info.context.db,
            sandbox_config_global_id=input.sandbox_config_id,
            language=input.language.value,
            action="creating this evaluator",
            source_code=input.source_code,
            sandbox_runtime=info.context.sandbox_runtime,
        )

        try:
            async with info.context.db() as session:
                project = await _validate_project_evaluator_project(
                    session, project_id, input.project_id
                )
                evaluator_name = await _generate_unique_evaluator_name(session, name)
                evaluator = models.CodeEvaluator(
                    name=evaluator_name,
                    description=input.description,
                    language=input.language.value,
                    user_id=user_id,
                    sandbox_config_id=sandbox_config_id,
                    input_mapping=input.evaluator_input_mapping.to_orm(),
                    output_configs=output_configs,
                )
                session.add(evaluator)
                await session.flush()
                session.add(
                    models.CodeEvaluatorVersion(
                        code_evaluator_id=evaluator.id,
                        source_code=input.source_code,
                        user_id=user_id,
                    )
                )
                project_evaluator = models.ProjectEvaluator(
                    project_id=project_id,
                    evaluator_id=evaluator.id,
                    trace_project=_get_trace_project_for_project_evaluator(
                        project_name=project.name,
                        project_evaluator_name=name.root,
                    ),
                    name=name,
                    filter_condition=input.filter_condition,
                    sampling_rate=input.sampling_rate,
                    evaluation_target=input.evaluation_target.value,
                    input_mapping=(
                        input.input_mapping.to_orm() if input.input_mapping is not None else None
                    ),
                    evaluation_delay_seconds=evaluation_delay_seconds,
                    enabled=input.enabled,
                )
                session.add(project_evaluator)
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=project_evaluator.id, db_record=project_evaluator),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Update a CODE project evaluator. Editing changes the underlying evaluator, which "
            "applies to every project and dataset it is bound to. "
            f"{_PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION}"
        ),
    )  # type: ignore
    async def update_project_code_evaluator(
        self, info: Info[Context, None], input: UpdateProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_evaluator_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
            name = IdentifierModel.model_validate(input.name)
        except (ValueError, ValidationError) as error:
            raise BadRequest(str(error))
        _validate_project_evaluator_filter(input.filter_condition, input.evaluation_target)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        if input.evaluator_input_mapping is None:
            raise BadRequest("evaluator_input_mapping cannot be set to null")
        if input.enabled is None:
            raise BadRequest("enabled cannot be set to null")
        if input.evaluation_delay_seconds is not UNSET:
            _materialize_project_evaluator_evaluation_delay(
                input.evaluation_delay_seconds, input.evaluation_target
            )
        if input.source_code is not UNSET and input.source_code is None:
            raise BadRequest("source_code cannot be set to null")
        if input.output_configs is None:
            raise BadRequest("output_configs cannot be set to null")
        if input.output_configs is not UNSET:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as error:
                raise BadRequest(str(error))

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        # Validated before the write session opens: the helper takes the session
        # factory and opens its own session, which would otherwise nest inside
        # the transaction below.
        validated_sandbox_config_id: Optional[int] = None
        if input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None:
            async with info.context.db() as session:
                current_pair = (
                    await session.execute(
                        select(models.ProjectEvaluator, models.CodeEvaluator)
                        .join(
                            models.CodeEvaluator,
                            models.ProjectEvaluator.evaluator_id == models.CodeEvaluator.id,
                        )
                        .where(models.ProjectEvaluator.id == project_evaluator_id)
                    )
                ).one_or_none()
                if current_pair is None:
                    raise NotFound(
                        f"CODE project evaluator not found: {input.project_evaluator_id}"
                    )
                _, current_evaluator = current_pair
                current_language = current_evaluator.language
                current_with_version = await code_evaluator_with_latest_version(
                    session, current_evaluator.id
                )
                stored_source_code = (
                    current_with_version[1].source_code
                    if current_with_version is not None and current_with_version[1] is not None
                    else ""
                )
            # Source code supplied in this same request is what will be stored,
            # so the sandbox is validated against that rather than the version
            # it is about to replace.
            validated_sandbox_config_id = await _validate_code_evaluator_sandbox_config(
                info.context.db,
                sandbox_config_global_id=input.sandbox_config_id,
                language=current_language,
                action="updating this evaluator",
                source_code=(
                    input.source_code
                    if input.source_code is not UNSET and input.source_code is not None
                    else stored_source_code
                ),
                sandbox_runtime=info.context.sandbox_runtime,
            )

        try:
            async with info.context.db() as session:
                pair = (
                    await session.execute(
                        select(models.ProjectEvaluator, models.CodeEvaluator)
                        .join(
                            models.CodeEvaluator,
                            models.ProjectEvaluator.evaluator_id == models.CodeEvaluator.id,
                        )
                        .where(models.ProjectEvaluator.id == project_evaluator_id)
                    )
                ).one_or_none()
                if pair is None:
                    raise NotFound(
                        f"CODE project evaluator not found: {input.project_evaluator_id}"
                    )
                project_evaluator, evaluator = pair
                _validate_project_evaluator_target_update(
                    project_evaluator,
                    input.evaluation_target,
                )
                shared_evaluator_changed = False
                if project_evaluator.name != name:
                    evaluator.name = await _generate_unique_evaluator_name(session, name)
                    shared_evaluator_changed = True
                if input.description is not UNSET and evaluator.description != input.description:
                    evaluator.description = input.description
                    shared_evaluator_changed = True
                if input.evaluator_input_mapping is not UNSET:
                    assert input.evaluator_input_mapping is not None
                    evaluator_input_mapping = input.evaluator_input_mapping.to_orm()
                    if evaluator.input_mapping != evaluator_input_mapping:
                        evaluator.input_mapping = evaluator_input_mapping
                        shared_evaluator_changed = True

                if input.sandbox_config_id is not UNSET:
                    if input.sandbox_config_id is None:
                        sandbox_config_id = None
                    else:
                        sandbox_config_id = validated_sandbox_config_id
                    if evaluator.sandbox_config_id != sandbox_config_id:
                        evaluator.sandbox_config_id = sandbox_config_id
                        shared_evaluator_changed = True
                if input.output_configs is not UNSET:
                    output_configs = cast(
                        list[AnnotationConfigType],
                        _convert_output_config_inputs_to_pydantic(input.output_configs),
                    )
                    if evaluator.output_configs != output_configs:
                        evaluator.output_configs = output_configs
                        shared_evaluator_changed = True
                if input.source_code is not UNSET and input.source_code is not None:
                    _raise_on_uninferable_evaluate_signature(
                        input.source_code, Language(evaluator.language)
                    )
                    locked = await code_evaluator_with_latest_version(session, evaluator.id)
                    if locked is None:
                        raise NotFound(
                            f"CODE project evaluator not found: {input.project_evaluator_id}"
                        )
                    _, current_version = locked
                    candidate = models.CodeEvaluatorVersion(
                        code_evaluator_id=evaluator.id,
                        source_code=input.source_code,
                        user_id=user_id,
                    )
                    if current_version is None or not current_version.has_identical_content(
                        candidate
                    ):
                        session.add(candidate)
                        shared_evaluator_changed = True

                if shared_evaluator_changed:
                    evaluator.user_id = user_id

                project_evaluator.name = name
                project_evaluator.filter_condition = input.filter_condition
                project_evaluator.sampling_rate = input.sampling_rate
                project_evaluator.evaluation_target = input.evaluation_target.value
                if input.input_mapping is not UNSET:
                    project_evaluator.input_mapping = (
                        input.input_mapping.to_orm() if input.input_mapping is not None else None
                    )
                if input.evaluation_delay_seconds is not UNSET:
                    project_evaluator.evaluation_delay_seconds = (
                        _materialize_project_evaluator_evaluation_delay(
                            input.evaluation_delay_seconds, input.evaluation_target
                        )
                    )
                if input.enabled is not UNSET:
                    assert input.enabled is not None
                    project_evaluator.enabled = input.enabled
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=project_evaluator.id, db_record=project_evaluator),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Enable or disable a project evaluator. Flips only the enabled flag on the "
            "project binding, leaving the underlying evaluator untouched. Works for both "
            "LLM and CODE evaluators."
        ),
    )  # type: ignore
    async def set_project_evaluator_enabled(
        self, info: Info[Context, None], input: SetProjectEvaluatorEnabledInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_evaluator_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
        except ValueError as error:
            raise BadRequest(str(error))
        async with info.context.db() as session:
            project_evaluator = await session.get(models.ProjectEvaluator, project_evaluator_id)
            if project_evaluator is None:
                raise NotFound(f"Project evaluator not found: {input.project_evaluator_id}")
            project_evaluator.enabled = input.enabled
            await session.flush()
        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=project_evaluator.id, db_record=project_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_project_evaluators(
        self, info: Info[Context, None], input: DeleteProjectEvaluatorsInput
    ) -> DeleteProjectEvaluatorsPayload:
        project_evaluator_ids: list[int] = []
        for global_id in input.project_evaluator_ids:
            try:
                project_evaluator_ids.append(
                    from_global_id_with_expected_type(global_id, ProjectEvaluator.__name__)
                )
            except ValueError:
                raise BadRequest(f"Invalid project evaluator id: {global_id}")
        if not project_evaluator_ids:
            return DeleteProjectEvaluatorsPayload(project_evaluator_ids=[], query=Query())

        deleted_ids: list[GlobalID] = []
        async with info.context.db() as session:
            llm_evaluator_alias = aliased(models.LLMEvaluator, flat=True)
            rows = (
                await session.execute(
                    select(
                        models.ProjectEvaluator.id,
                        models.ProjectEvaluator.evaluator_id,
                        models.ProjectEvaluator.trace_project_id,
                        models.Evaluator.kind,
                        llm_evaluator_alias.prompt_id,
                    )
                    .join(
                        models.Evaluator,
                        models.ProjectEvaluator.evaluator_id == models.Evaluator.id,
                    )
                    .outerjoin(
                        llm_evaluator_alias,
                        models.ProjectEvaluator.evaluator_id == llm_evaluator_alias.id,
                    )
                    .where(models.ProjectEvaluator.id.in_(project_evaluator_ids))
                )
            ).all()
            evaluator_ids: set[int] = set()
            prompt_ids: set[int] = set()
            trace_project_ids: list[int] = []
            actual_project_evaluator_ids: list[int] = []
            for project_evaluator_id, evaluator_id, trace_project_id, kind, prompt_id in rows:
                actual_project_evaluator_ids.append(project_evaluator_id)
                trace_project_ids.append(trace_project_id)
                deleted_ids.append(GlobalID(ProjectEvaluator.__name__, str(project_evaluator_id)))
                if kind != "BUILTIN":
                    evaluator_ids.add(evaluator_id)
                    if prompt_id is not None:
                        prompt_ids.add(prompt_id)
            if actual_project_evaluator_ids:
                # A trigger that watches one of these evaluators would otherwise be left
                # matching every completion, so it goes with the evaluator it watches.
                watching_trigger_ids = list(
                    await session.scalars(
                        select(models.ProjectEvaluatorTriggerEvaluationPredicates.trigger_id).where(
                            models.ProjectEvaluatorTriggerEvaluationPredicates.source_project_evaluator_id.in_(
                                actual_project_evaluator_ids
                            )
                        )
                    )
                )
                if watching_trigger_ids:
                    await session.execute(
                        delete(models.ProjectEvaluatorTrigger).where(
                            models.ProjectEvaluatorTrigger.id.in_(watching_trigger_ids)
                        )
                    )
                await session.execute(
                    delete(models.ProjectEvaluator).where(
                        models.ProjectEvaluator.id.in_(actual_project_evaluator_ids)
                    )
                )
                await session.execute(
                    delete(models.Project).where(models.Project.id.in_(trace_project_ids))
                )
                await _garbage_collect_evaluators(
                    session,
                    evaluator_ids=evaluator_ids,
                    prompt_ids=prompt_ids,
                    delete_associated_prompt=input.delete_associated_prompt,
                )

        return DeleteProjectEvaluatorsPayload(
            project_evaluator_ids=deleted_ids,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_llm_evaluator(
        self, info: Info[Context, None], input: CreateDatasetLLMEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        dataset_id = from_global_id_with_expected_type(
            global_id=input.dataset_id, expected_type_name=Dataset.__name__
        )
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)
        try:
            prompt_version = input.prompt_version.to_orm_prompt_version(user_id)
        except ValidationError as error:
            raise BadRequest(str(error))
        # Validate output configs before conversion
        try:
            validated_configs = LLMEvaluatorOutputConfigs.from_inputs(input.output_configs)
        except (ValueError, ValidationError) as e:
            raise BadRequest(str(e))
        output_configs: list[CategoricalOutputConfig] = list(validated_configs.configs)
        try:
            validated_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        try:
            async with info.context.db() as session:
                evaluator_name = await _generate_unique_evaluator_name(session, validated_name)

                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_id)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_id} not found")

                dataset_evaluator_record = models.DatasetEvaluators(
                    dataset_id=dataset_id,
                    name=validated_name,
                    description=input.description if input.description is not UNSET else None,
                    output_configs=output_configs,
                    input_mapping=input.input_mapping.to_orm(),
                    user_id=user_id,
                    project=_get_project_for_dataset_evaluator(
                        dataset_name=dataset_name,
                        dataset_evaluator_name=str(evaluator_name),
                    ),
                )

                # Handle prompt version ID if provided
                target_prompt_version_id: Optional[int] = None
                prompt: models.Prompt | None = None

                if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                    prompt_version_id = from_global_id_with_expected_type(
                        global_id=input.prompt_version_id, expected_type_name=PromptVersion.__name__
                    )
                    prompt_version_and_prompt = (
                        await session.execute(
                            select(models.PromptVersion, models.Prompt)
                            .outerjoin(
                                models.Prompt,
                                models.Prompt.id == models.PromptVersion.prompt_id,
                            )
                            .where(models.PromptVersion.id == prompt_version_id)
                        )
                    ).one_or_none()
                    if prompt_version_and_prompt is None:
                        raise NotFound(
                            f"Prompt version with id {input.prompt_version_id} not found"
                        )
                    existing_prompt_version, prompt = prompt_version_and_prompt
                    existing_prompt_id = existing_prompt_version.prompt_id

                    if prompt is None:
                        raise NotFound(f"Prompt with id {existing_prompt_id} not found")

                    # Only create a new prompt version if the contents differ
                    if existing_prompt_version.has_identical_content(prompt_version):
                        target_prompt_version_id = existing_prompt_version.id
                    else:
                        prompt_version.prompt_id = existing_prompt_id
                        session.add(prompt_version)
                        await session.flush()
                        target_prompt_version_id = prompt_version.id
                else:
                    # No prompt version ID provided: create new prompt and prompt version
                    prompt_name = IdentifierModel.model_validate(
                        f"{input.name}-evaluator-{token_hex(4)}"
                    )
                    prompt = models.Prompt(
                        name=prompt_name,
                        description=input.description if input.description is not UNSET else None,
                        prompt_versions=[prompt_version],
                    )
                    target_prompt_version_id = None  # Will use prompt_version.id after flush

                llm_evaluator = models.LLMEvaluator(
                    name=evaluator_name,
                    description=input.description if input.description is not UNSET else None,
                    kind="LLM",
                    output_configs=output_configs,
                    user_id=user_id,
                    prompt=prompt,
                    dataset_evaluators=[dataset_evaluator_record],
                )

                try:
                    validate_consistent_llm_evaluator_and_prompt_version(
                        prompt_version, llm_evaluator
                    )
                except ValueError as error:
                    raise BadRequest(str(error))

                session.add(llm_evaluator)
                await session.flush()

                # Ensure the prompt is labeled as an evaluator prompt
                await _ensure_evaluator_prompt_label(session, prompt.id)
                tag_name = IdentifierModel.model_validate(f"{input.name}-evaluator-{token_hex(4)}")
                # Use the target prompt version ID (newly created if prompt_version_id
                # provided, otherwise the new prompt version)
                final_prompt_version_id = (
                    target_prompt_version_id
                    if target_prompt_version_id is not None
                    else prompt_version.id
                )
                prompt_tag = models.PromptVersionTag(
                    name=tag_name,
                    prompt_id=prompt.id,
                    prompt_version_id=final_prompt_version_id,
                )
                llm_evaluator.prompt_version_tag = prompt_tag
                # Manually update the updated_at field because updating the description
                # or other fields solely on the parent record Evaluator does not
                # trigger an update of the updated_at field on the LLMEvaluator record.
                llm_evaluator.updated_at = datetime.now(timezone.utc)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise BadRequest(f"Dataset with id {dataset_id} not found")
            raise BadRequest(
                f"An evaluator with name '{input.name}' already exists for this dataset"
            )
        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(
                id=dataset_evaluator_record.id, db_record=dataset_evaluator_record
            ),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_llm_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetLLMEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            evaluator_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        # Validate output configs before conversion
        try:
            validated_configs = LLMEvaluatorOutputConfigs.from_inputs(input.output_configs)
        except (ValueError, ValidationError) as e:
            raise BadRequest(str(e))
        output_configs: list[CategoricalOutputConfig] = list(validated_configs.configs)

        try:
            prompt_version = input.prompt_version.to_orm_prompt_version(user_id)
        except ValidationError as error:
            raise BadRequest(str(error))

        try:
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_evaluator_id,
                expected_type_name=DatasetEvaluator.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid DatasetEvaluator id: {input.dataset_evaluator_id}")

        async with info.context.db() as session:
            dataset_evaluator_row = await session.execute(
                select(
                    models.DatasetEvaluators,
                    models.LLMEvaluator,
                    models.PromptVersionTag,
                )
                .join(
                    models.LLMEvaluator,
                    models.DatasetEvaluators.evaluator_id == models.LLMEvaluator.id,
                )
                .outerjoin(
                    models.PromptVersionTag,
                    models.LLMEvaluator.prompt_version_tag_id == models.PromptVersionTag.id,
                )
                .where(models.DatasetEvaluators.id == dataset_evaluator_rowid)
            )
            dataset_evaluator_triplet = dataset_evaluator_row.one_or_none()
            if dataset_evaluator_triplet is None:
                dataset_evaluator = await session.get(
                    models.DatasetEvaluators, dataset_evaluator_rowid
                )
                if dataset_evaluator is None:
                    raise NotFound(
                        f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                    )
                evaluator = (
                    await session.get(models.Evaluator, dataset_evaluator.evaluator_id)
                    if dataset_evaluator.evaluator_id is not None
                    else None
                )
                if evaluator is not None and evaluator.kind == "BUILTIN":
                    raise BadRequest("Cannot update a built-in evaluator")
                raise NotFound(
                    f"LLM evaluator not found for DatasetEvaluator {input.dataset_evaluator_id}"
                )
            dataset_evaluator, llm_evaluator, prompt_version_tag = dataset_evaluator_triplet
            shared_evaluator_changed = False

            # Handle prompt_version_id if provided
            target_prompt_id = llm_evaluator.prompt_id
            provided_prompt_version_id: Optional[int] = None
            provided_prompt_version: Optional[models.PromptVersion] = None
            new_prompt: Optional[models.Prompt] = None
            if input.prompt_version_id is not UNSET and input.prompt_version_id is not None:
                provided_prompt_version_id = from_global_id_with_expected_type(
                    global_id=input.prompt_version_id, expected_type_name=PromptVersion.__name__
                )
                provided_prompt_version = await session.get(
                    models.PromptVersion, provided_prompt_version_id
                )
                if provided_prompt_version is None:
                    raise NotFound(f"Prompt version with id {input.prompt_version_id} not found")
                # If the provided prompt_version points to a different prompt, update the evaluator
                # to point to the new prompt
                if provided_prompt_version.prompt_id != llm_evaluator.prompt_id:
                    target_prompt_id = provided_prompt_version.prompt_id
                    llm_evaluator.prompt_id = target_prompt_id
                    shared_evaluator_changed = True
                # Update the prompt_version_tag to point to the provided prompt_version
                if llm_evaluator.prompt_version_tag_id is not None:
                    if prompt_version_tag is not None:
                        if (
                            prompt_version_tag.prompt_id != target_prompt_id
                            or prompt_version_tag.prompt_version_id != provided_prompt_version_id
                        ):
                            prompt_version_tag.prompt_id = target_prompt_id
                            prompt_version_tag.prompt_version_id = provided_prompt_version_id
                            shared_evaluator_changed = True
                    else:
                        raise NotFound(
                            f"Prompt version tag with id {llm_evaluator.prompt_version_tag_id} "
                            "not found"
                        )

            # Retrieve the active prompt version for comparison
            if provided_prompt_version is not None:
                active_prompt_version = provided_prompt_version
            else:
                # No prompt_version_id provided: create new prompt and prompt version
                prompt_name = IdentifierModel.model_validate(
                    f"{input.name}-evaluator-{token_hex(4)}"
                )
                new_prompt = models.Prompt(
                    name=prompt_name,
                    description=input.description or None,
                    prompt_versions=[prompt_version],
                )
                session.add(new_prompt)
                await session.flush()

                # Ensure the new prompt is labeled as an evaluator prompt
                await _ensure_evaluator_prompt_label(session, new_prompt.id)

                target_prompt_id = new_prompt.id
                llm_evaluator.prompt_id = target_prompt_id
                shared_evaluator_changed = True
                # Use the newly created prompt_version for comparison (it will always be "new")
                active_prompt_version = prompt_version

            dataset_evaluator.name = evaluator_name
            if input.description is not UNSET:
                dataset_evaluator.description = input.description
            dataset_evaluator.output_configs = list(output_configs)
            if input.input_mapping is None:
                raise BadRequest("input_mapping is required")
            dataset_evaluator.input_mapping = input.input_mapping.to_orm()
            dataset_evaluator.user_id = user_id

            if input.description is not UNSET and llm_evaluator.description != input.description:
                llm_evaluator.description = input.description
                shared_evaluator_changed = True
            if llm_evaluator.output_configs != list(output_configs):
                llm_evaluator.output_configs = list(output_configs)
                shared_evaluator_changed = True

            if new_prompt is not None:
                # We already created a new prompt above
                create_new_prompt_version = False
            else:
                # Check if prompt contents have changed and create new version if needed
                create_new_prompt_version = not active_prompt_version.has_identical_content(
                    prompt_version
                )
                if create_new_prompt_version:
                    prompt_version.prompt_id = target_prompt_id
                    session.add(prompt_version)
                    shared_evaluator_changed = True

            try:
                validate_consistent_llm_evaluator_and_prompt_version(prompt_version, llm_evaluator)
            except ValueError as error:
                raise BadRequest(str(error))

            try:
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("An evaluator with this name already exists")

            # Update prompt_version_tag to point to the final prompt version
            final_prompt_version_id = None
            if new_prompt is not None or create_new_prompt_version:
                final_prompt_version_id = prompt_version.id
            elif provided_prompt_version_id is not None:
                final_prompt_version_id = provided_prompt_version_id

            if final_prompt_version_id is not None:
                if llm_evaluator.prompt_version_tag_id is not None:
                    if prompt_version_tag is not None:
                        if (
                            prompt_version_tag.prompt_version_id != final_prompt_version_id
                            or prompt_version_tag.prompt_id != target_prompt_id
                        ):
                            prompt_version_tag.prompt_version_id = final_prompt_version_id
                            # Ensure prompt_id matches
                            prompt_version_tag.prompt_id = target_prompt_id
                            shared_evaluator_changed = True

            if shared_evaluator_changed:
                llm_evaluator.updated_at = datetime.now(timezone.utc)
                llm_evaluator.user_id = user_id

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_dataset_evaluators(
        self, info: Info[Context, None], input: DeleteDatasetEvaluatorsInput
    ) -> DeleteDatasetEvaluatorsPayload:
        """
        Remove the per-dataset evaluator links identified by the given IDs.

        Only the DatasetEvaluators rows are removed; shared evaluator definitions
        are preserved:
          - BUILTIN evaluator rows are global and are never deleted by this mutation.
          - LLM and CODE evaluator rows are garbage-collected only after the link
            is removed and no other DatasetEvaluators row still references them.

        If delete_associated_prompt is True (default), the prompt of an LLM evaluator
        is also deleted, but only when that LLMEvaluator was itself garbage-collected.

        The associated project for each removed dataset evaluator link is also deleted.
        """
        dataset_evaluator_rowids: list[int] = []
        for dataset_evaluator_gid in input.dataset_evaluator_ids:
            try:
                dataset_evaluator_rowid = from_global_id_with_expected_type(
                    global_id=dataset_evaluator_gid,
                    expected_type_name=DatasetEvaluator.__name__,
                )
            except ValueError:
                raise BadRequest(f"Invalid dataset evaluator id: {dataset_evaluator_gid}")
            dataset_evaluator_rowids.append(dataset_evaluator_rowid)

        if not dataset_evaluator_rowids:
            return DeleteDatasetEvaluatorsPayload(
                dataset_evaluator_ids=[],
                query=Query(),
            )

        deleted_gids: list[GlobalID] = []

        async with info.context.db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)

            # Gather link metadata (id, evaluator_id, project_id, kind,
            # prompt_id). On Postgres we fold the link DELETE into this step
            # via a data-modifying CTE — one round trip instead of two. SQLite
            # supports neither data-modifying CTEs nor DELETE...USING, so we
            # SELECT first and DELETE the links separately below.
            #
            # LLMEvaluator uses joined-table inheritance against Evaluator, so
            # we alias it (flat=True) before the LEFT JOIN to avoid SQLAlchemy
            # auto-aliasing the `evaluators` table and silently rewriting
            # `Evaluator.kind` to read from the aliased copy (which would be
            # NULL for non-LLM rows and break the BUILTIN check).
            llm_evaluator_alias = aliased(models.LLMEvaluator, flat=True)
            if dialect is SupportedSQLDialect.POSTGRESQL:
                deleted_links_cte = (
                    delete(models.DatasetEvaluators)
                    .where(models.DatasetEvaluators.id.in_(dataset_evaluator_rowids))
                    .returning(
                        models.DatasetEvaluators.id,
                        models.DatasetEvaluators.evaluator_id,
                        models.DatasetEvaluators.project_id,
                    )
                    .cte("deleted_links")
                )
                gather_stmt = (
                    select(
                        deleted_links_cte.c.id,
                        deleted_links_cte.c.evaluator_id,
                        deleted_links_cte.c.project_id,
                        models.Evaluator.kind,
                        llm_evaluator_alias.prompt_id,
                    )
                    .select_from(deleted_links_cte)
                    .join(
                        models.Evaluator,
                        models.Evaluator.id == deleted_links_cte.c.evaluator_id,
                    )
                    .outerjoin(
                        llm_evaluator_alias,
                        llm_evaluator_alias.id == deleted_links_cte.c.evaluator_id,
                    )
                )
            else:
                gather_stmt = (
                    select(
                        models.DatasetEvaluators.id,
                        models.DatasetEvaluators.evaluator_id,
                        models.DatasetEvaluators.project_id,
                        models.Evaluator.kind,
                        llm_evaluator_alias.prompt_id,
                    )
                    .join(
                        models.Evaluator,
                        models.DatasetEvaluators.evaluator_id == models.Evaluator.id,
                    )
                    .outerjoin(
                        llm_evaluator_alias,
                        models.DatasetEvaluators.evaluator_id == llm_evaluator_alias.id,
                    )
                    .where(models.DatasetEvaluators.id.in_(dataset_evaluator_rowids))
                )
            rows = (await session.execute(gather_stmt)).all()

            link_ids: list[int] = []
            project_ids: list[int] = []
            # Only non-BUILTIN evaluators are garbage collect candidates.
            gc_candidate_evaluator_ids: set[int] = set()
            candidate_prompt_ids: set[int] = set()

            for link_id, evaluator_id, project_id, kind, prompt_id in rows:
                link_ids.append(link_id)
                project_ids.append(project_id)
                deleted_gids.append(GlobalID(DatasetEvaluator.__name__, str(link_id)))
                if kind != "BUILTIN":
                    gc_candidate_evaluator_ids.add(evaluator_id)
                    if prompt_id is not None:
                        candidate_prompt_ids.add(prompt_id)

            if project_ids:
                cascade_rows = (
                    await session.execute(
                        select(
                            models.ProjectEvaluator.evaluator_id,
                            models.Evaluator.kind,
                            llm_evaluator_alias.prompt_id,
                        )
                        .join(
                            models.Evaluator,
                            models.ProjectEvaluator.evaluator_id == models.Evaluator.id,
                        )
                        .outerjoin(
                            llm_evaluator_alias,
                            models.ProjectEvaluator.evaluator_id == llm_evaluator_alias.id,
                        )
                        .where(models.ProjectEvaluator.project_id.in_(project_ids))
                    )
                ).all()
                for evaluator_id, kind, prompt_id in cascade_rows:
                    if kind != "BUILTIN":
                        gc_candidate_evaluator_ids.add(evaluator_id)
                        if prompt_id is not None:
                            candidate_prompt_ids.add(prompt_id)

            if not link_ids:
                return DeleteDatasetEvaluatorsPayload(
                    dataset_evaluator_ids=[],
                    query=Query(),
                )

            # On SQLite the link DELETE still needs to happen explicitly;
            # on Postgres it already executed inside the CTE above. Removing
            # the links first releases the RESTRICT FK on projects and lets
            # us safely garbage collect orphaned evaluator definitions.
            if dialect is not SupportedSQLDialect.POSTGRESQL:
                await session.execute(
                    delete(models.DatasetEvaluators).where(
                        models.DatasetEvaluators.id.in_(link_ids)
                    )
                )

            if project_ids:
                await delete_projects_and_evaluator_trace_projects(session, project_ids)

            await _garbage_collect_evaluators(
                session,
                evaluator_ids=gc_candidate_evaluator_ids,
                prompt_ids=candidate_prompt_ids,
                delete_associated_prompt=input.delete_associated_prompt,
            )

        return DeleteDatasetEvaluatorsPayload(
            dataset_evaluator_ids=deleted_gids,
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_builtin_evaluator(
        self, info: Info[Context, None], input: CreateDatasetBuiltinEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            built_in_evaluator_id, _ = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        input_mapping: EvaluatorInputMappingInput = input.input_mapping

        try:
            name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        # Validate output configs if provided
        if input.output_configs is not None:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as e:
                raise BadRequest(str(e))

        try:
            async with info.context.db() as session:
                builtin_and_dataset = (
                    await session.execute(
                        select(models.BuiltinEvaluator, models.Dataset.name)
                        .select_from(models.BuiltinEvaluator)
                        .join(models.Dataset, true())
                        .where(
                            models.BuiltinEvaluator.id == built_in_evaluator_id,
                            models.Dataset.id == dataset_rowid,
                        )
                    )
                ).one_or_none()
                if builtin_and_dataset is None:
                    builtin_db = await session.get(models.BuiltinEvaluator, built_in_evaluator_id)
                    if builtin_db is None:
                        raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")
                    dataset_name = await session.scalar(
                        select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                    )
                    if dataset_name is None:
                        raise NotFound(f"Dataset with id {dataset_rowid} not found")
                else:
                    builtin_db, dataset_name = builtin_and_dataset

                # Get the evaluator class from registry using the key
                builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
                if builtin_evaluator is None:
                    raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

                # If output_configs provided, convert them; otherwise store None
                # (resolver falls back to base evaluator configs at runtime)
                output_configs: Optional[list[OutputConfigType]] = None
                if input.output_configs is not None:
                    output_configs = _convert_output_config_inputs_to_pydantic(input.output_configs)

                dataset_evaluator = models.DatasetEvaluators(
                    dataset_id=dataset_rowid,
                    name=name,
                    input_mapping=input_mapping.to_orm(),
                    evaluator_id=built_in_evaluator_id,
                    output_configs=output_configs,
                    description=input.description,
                    user_id=user_id,
                    project=_get_project_for_dataset_evaluator(
                        dataset_name=dataset_name,
                        dataset_evaluator_name=str(name),
                    ),
                )

                session.add(dataset_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset with id {input.dataset_id} not found")
            raise BadRequest(
                f"DatasetEvaluator with name {input.name} already exists "
                f"for dataset {input.dataset_id}"
            )

        # Populate in-memory output_configs for the GQL response so the resolver
        # doesn't need a DB fallback (which would open a concurrent session).
        # The DB retains None, meaning "use base evaluator configs at runtime."
        if output_configs is None:
            dataset_evaluator.output_configs = list(builtin_evaluator().output_configs)

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_builtin_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetBuiltinEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_evaluator_id,
                expected_type_name=DatasetEvaluator.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset evaluator id: {input.dataset_evaluator_id}")

        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        input_mapping: EvaluatorInputMappingInput = input.input_mapping

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        # Validate output configs if provided
        if input.output_configs is not UNSET and input.output_configs is not None:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as e:
                raise BadRequest(str(e))

        try:
            async with info.context.db() as session:
                dataset_evaluator_row = await session.execute(
                    select(models.DatasetEvaluators, models.BuiltinEvaluator)
                    .join(
                        models.BuiltinEvaluator,
                        models.DatasetEvaluators.evaluator_id == models.BuiltinEvaluator.id,
                    )
                    .where(models.DatasetEvaluators.id == dataset_evaluator_rowid)
                )
                dataset_evaluator_pair = dataset_evaluator_row.one_or_none()
                if dataset_evaluator_pair is None:
                    dataset_evaluator = await session.get(
                        models.DatasetEvaluators, dataset_evaluator_rowid
                    )
                    if dataset_evaluator is None:
                        raise NotFound(
                            f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                        )
                    raise BadRequest("Cannot update a non-built-in evaluator")
                dataset_evaluator, builtin_db = dataset_evaluator_pair

                builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
                if builtin_evaluator is None:
                    raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

                try:
                    name = IdentifierModel.model_validate(input.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}")
                dataset_evaluator.name = name
                dataset_evaluator.input_mapping = input_mapping.to_orm()
                dataset_evaluator.updated_at = datetime.now(timezone.utc)
                dataset_evaluator.user_id = user_id

                if input.output_configs is not UNSET:
                    if input.output_configs is not None:
                        dataset_evaluator.output_configs = (
                            _convert_output_config_inputs_to_pydantic(input.output_configs)
                        )
                    else:
                        # Reset to None = fall back to base evaluator configs at runtime
                        dataset_evaluator.output_configs = None

                if input.description is not UNSET:
                    dataset_evaluator.description = input.description
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset evaluator with id {input.dataset_evaluator_id} not found")
            raise BadRequest(f"DatasetEvaluator with name {input.name} already exists")

        # Populate in-memory output_configs for the GQL response so the resolver
        # doesn't need a DB fallback (which would open a concurrent session).
        if dataset_evaluator.output_configs is None:
            dataset_evaluator.output_configs = list(builtin_evaluator().output_configs)

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_dataset_code_evaluator(
        self, info: Info[Context, None], input: CreateDatasetCodeEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_id,
                expected_type_name=Dataset.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset id: {input.dataset_id}")

        try:
            evaluator_id, evaluator_kind = _parse_evaluator_id(input.evaluator_id)
        except ValueError as e:
            raise BadRequest(f"Invalid evaluator id: {input.evaluator_id}. {e}")
        if evaluator_kind != "CODE":
            raise BadRequest("Evaluator must be a code evaluator")

        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        input_mapping: EvaluatorInputMappingInput = input.input_mapping

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        output_configs: Optional[list[OutputConfigType]] = None
        if input.output_configs is not None:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as e:
                raise BadRequest(str(e))
            output_configs = _convert_output_config_inputs_to_pydantic(input.output_configs)

        try:
            async with info.context.db() as session:
                evaluator_and_dataset = (
                    await session.execute(
                        select(models.CodeEvaluator, models.Dataset.name)
                        .select_from(models.CodeEvaluator)
                        .join(models.Dataset, true())
                        .where(
                            models.CodeEvaluator.id == evaluator_id,
                            models.Dataset.id == dataset_rowid,
                        )
                    )
                ).one_or_none()
                if evaluator_and_dataset is None:
                    code_evaluator = await session.get(models.CodeEvaluator, evaluator_id)
                    if code_evaluator is None:
                        raise NotFound(f"Code evaluator with id {input.evaluator_id} not found")
                    dataset_name = await session.scalar(
                        select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                    )
                    if dataset_name is None:
                        raise NotFound(f"Dataset with id {dataset_rowid} not found")
                else:
                    code_evaluator, dataset_name = evaluator_and_dataset

                dataset_evaluator = models.DatasetEvaluators(
                    dataset_id=dataset_rowid,
                    name=name,
                    input_mapping=input_mapping.to_orm(),
                    evaluator_id=evaluator_id,
                    output_configs=output_configs,
                    description=input.description,
                    user_id=user_id,
                    project=_get_project_for_dataset_evaluator(
                        dataset_name=dataset_name,
                        dataset_evaluator_name=str(name),
                    ),
                )

                session.add(dataset_evaluator)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset with id {input.dataset_id} not found")
            raise BadRequest(
                f"DatasetEvaluator with name {input.name} already exists "
                f"for dataset {input.dataset_id}"
            )

        if output_configs is None:
            dataset_evaluator.output_configs = as_output_configs(code_evaluator.output_configs)

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def update_dataset_code_evaluator(
        self, info: Info[Context, None], input: UpdateDatasetCodeEvaluatorInput
    ) -> DatasetEvaluatorMutationPayload:
        try:
            dataset_evaluator_rowid = from_global_id_with_expected_type(
                global_id=input.dataset_evaluator_id,
                expected_type_name=DatasetEvaluator.__name__,
            )
        except ValueError:
            raise BadRequest(f"Invalid dataset evaluator id: {input.dataset_evaluator_id}")

        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        input_mapping: EvaluatorInputMappingInput = input.input_mapping

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        if input.output_configs is not UNSET and input.output_configs is not None:
            try:
                validate_unique_config_names(input.output_configs)
            except ValueError as e:
                raise BadRequest(str(e))

        try:
            async with info.context.db() as session:
                dataset_evaluator_row = await session.execute(
                    select(models.DatasetEvaluators, models.CodeEvaluator)
                    .join(
                        models.CodeEvaluator,
                        models.DatasetEvaluators.evaluator_id == models.CodeEvaluator.id,
                    )
                    .where(models.DatasetEvaluators.id == dataset_evaluator_rowid)
                )
                dataset_evaluator_pair = dataset_evaluator_row.one_or_none()
                if dataset_evaluator_pair is None:
                    dataset_evaluator = await session.get(
                        models.DatasetEvaluators, dataset_evaluator_rowid
                    )
                    if dataset_evaluator is None:
                        raise NotFound(
                            f"DatasetEvaluator with id {input.dataset_evaluator_id} not found"
                        )
                    raise BadRequest("Cannot update a non-code dataset evaluator")
                dataset_evaluator, evaluator = dataset_evaluator_pair

                try:
                    name = IdentifierModel.model_validate(input.name)
                except ValidationError as error:
                    raise BadRequest(f"Invalid evaluator name: {error}")
                dataset_evaluator.name = name
                dataset_evaluator.input_mapping = input_mapping.to_orm()
                dataset_evaluator.updated_at = datetime.now(timezone.utc)
                dataset_evaluator.user_id = user_id

                if input.output_configs is not UNSET:
                    if input.output_configs is not None:
                        dataset_evaluator.output_configs = (
                            _convert_output_config_inputs_to_pydantic(input.output_configs)
                        )
                    else:
                        dataset_evaluator.output_configs = None

                if input.description is not UNSET:
                    dataset_evaluator.description = input.description
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            if "foreign" in str(e).lower():
                raise NotFound(f"Dataset evaluator with id {input.dataset_evaluator_id} not found")
            raise BadRequest(f"DatasetEvaluator with name {input.name} already exists")

        if dataset_evaluator.output_configs is None:
            dataset_evaluator.output_configs = as_output_configs(evaluator.output_configs)

        return DatasetEvaluatorMutationPayload(
            evaluator=DatasetEvaluator(id=dataset_evaluator.id, db_record=dataset_evaluator),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def create_code_evaluator(
        self,
        info: Info[Context, None],
        input: CreateCodeEvaluatorInput,
    ) -> CodeEvaluatorMutationPayload:
        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        try:
            validated_name = IdentifierModel.model_validate(input.name)
        except ValidationError as error:
            raise BadRequest(f"Invalid evaluator name: {error}")

        output_configs: list[OutputConfigType] = (
            _convert_output_config_inputs_to_pydantic(input.output_configs)
            if input.output_configs
            else []
        )
        if input.input_mapping is None:
            raise BadRequest("input_mapping is required")
        input_mapping_orm = input.input_mapping.to_orm()
        _raise_on_uninferable_evaluate_signature(input.source_code, input.language)
        sandbox_config_id = await _validate_code_evaluator_sandbox_config(
            info.context.db,
            sandbox_config_global_id=input.sandbox_config_id,
            language=input.language.value,
            action="creating this evaluator",
            source_code=input.source_code,
            sandbox_runtime=info.context.sandbox_runtime,
        )

        try:
            async with info.context.db() as session:
                row = models.CodeEvaluator(
                    name=validated_name,
                    description=input.description,
                    language=input.language.value,
                    user_id=user_id,
                    sandbox_config_id=sandbox_config_id,
                    input_mapping=input_mapping_orm,
                    output_configs=output_configs,
                )
                session.add(row)
                await session.flush()

                version = models.CodeEvaluatorVersion(
                    code_evaluator_id=row.id,
                    source_code=input.source_code,
                    user_id=user_id,
                )
                session.add(version)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            raise BadRequest(f"Could not create code evaluator: {e}")

        return CodeEvaluatorMutationPayload(
            evaluator=CodeEvaluator(id=row.id, db_record=row),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_code_evaluator(
        self,
        info: Info[Context, None],
        input: PatchCodeEvaluatorInput,
    ) -> CodeEvaluatorMutationPayload:
        evaluator_id = from_global_id_with_expected_type(
            global_id=input.id, expected_type_name=CodeEvaluator.__name__
        )

        if input.input_mapping is not UNSET and input.input_mapping is None:
            raise BadRequest("input_mapping cannot be set to null")
        if input.output_configs is not UNSET and input.output_configs is None:
            raise BadRequest("output_configs cannot be set to null")

        validated_sandbox_config_id: Optional[int] = None
        validated_source_code: Optional[str] = None
        if input.sandbox_config_id is not UNSET and input.sandbox_config_id is not None:
            async with info.context.db() as session:
                code_evaluator_with_version = await code_evaluator_with_latest_version(
                    session, evaluator_id
                )
                if code_evaluator_with_version is None:
                    raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
                current, current_version = code_evaluator_with_version
                language = current.language
                validated_source_code = current_version.source_code if current_version else ""
            validated_sandbox_config_id = await _validate_code_evaluator_sandbox_config(
                info.context.db,
                sandbox_config_global_id=input.sandbox_config_id,
                language=language,
                action="patching this evaluator",
                source_code=validated_source_code,
                sandbox_runtime=info.context.sandbox_runtime,
            )

        try:
            async with info.context.db() as session:
                code_evaluator_with_version = await code_evaluator_with_latest_version(
                    session, evaluator_id
                )
                if code_evaluator_with_version is None:
                    raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
                row, current_version = code_evaluator_with_version

                if input.name is not UNSET and input.name is not None:
                    try:
                        row.name = IdentifierModel.model_validate(input.name)
                    except ValidationError as error:
                        raise BadRequest(f"Invalid evaluator name: {error}")

                if input.description is not UNSET:
                    row.description = input.description

                if input.sandbox_config_id is not UNSET:
                    if input.sandbox_config_id is None:
                        row.sandbox_config_id = None
                    else:
                        latest_source_code = (
                            current_version.source_code if current_version is not None else ""
                        )
                        if latest_source_code != validated_source_code:
                            raise Conflict(
                                "The evaluator version changed during sandbox validation; retry."
                            )
                        row.sandbox_config_id = validated_sandbox_config_id

                if input.input_mapping is not UNSET and input.input_mapping is not None:
                    row.input_mapping = input.input_mapping.to_orm()

                if input.output_configs is not UNSET and input.output_configs is not None:
                    try:
                        validate_unique_config_names(input.output_configs)
                    except ValueError as e:
                        raise BadRequest(str(e))
                    row.output_configs = cast(
                        list[AnnotationConfigType],
                        _convert_output_config_inputs_to_pydantic(input.output_configs),
                    )

        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            raise BadRequest(f"Could not patch code evaluator: {e}")

        return CodeEvaluatorMutationPayload(
            evaluator=CodeEvaluator(id=row.id, db_record=row),
            query=Query(),
        )

    @strawberry.mutation(  # type: ignore
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Append a new immutable CodeEvaluatorVersion. If source_code matches the"
            " current tip, no row is appended and was_created=false."
        ),
    )
    async def create_code_evaluator_version(
        self,
        info: Info[Context, None],
        input: CreateCodeEvaluatorVersionInput,
    ) -> CreateCodeEvaluatorVersionPayload:
        evaluator_id = from_global_id_with_expected_type(
            global_id=input.code_evaluator_id, expected_type_name=CodeEvaluator.__name__
        )

        user_id: Optional[int] = None
        assert isinstance(request := info.context.request, Request)
        if "user" in request.scope:
            assert isinstance(user := request.user, PhoenixUser)
            user_id = int(user.identity)

        candidate = models.CodeEvaluatorVersion(
            code_evaluator_id=evaluator_id,
            source_code=input.source_code,
            user_id=user_id,
        )
        async with info.context.db() as session:
            code_evaluator_with_version = await code_evaluator_with_latest_version(
                session, evaluator_id
            )
            if code_evaluator_with_version is None:
                raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
            current, current_version = code_evaluator_with_version
            validated_language = current.language
            validated_sandbox_config_id = current.sandbox_config_id
            if current_version is not None and current_version.has_identical_content(candidate):
                return CreateCodeEvaluatorVersionPayload(
                    evaluator=CodeEvaluator(id=current.id, db_record=current),
                    was_created=False,
                    query=Query(),
                )
            validated_current_version_id = (
                current_version.id if current_version is not None else None
            )

        _raise_on_uninferable_evaluate_signature(input.source_code, Language(validated_language))
        if validated_sandbox_config_id is not None:
            await _validate_code_evaluator_sandbox_config(
                info.context.db,
                sandbox_config_global_id=GlobalID(
                    SandboxConfig.__name__, str(validated_sandbox_config_id)
                ),
                language=validated_language,
                action="creating this evaluator version",
                source_code=input.source_code,
                sandbox_runtime=info.context.sandbox_runtime,
            )

        try:
            async with info.context.db() as session:
                code_evaluator_with_version = await code_evaluator_with_latest_version(
                    session, evaluator_id
                )
                if code_evaluator_with_version is None:
                    raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
                row, current_version = code_evaluator_with_version
                if (
                    row.language != validated_language
                    or row.sandbox_config_id != validated_sandbox_config_id
                ):
                    raise Conflict("The evaluator sandbox changed during source validation; retry.")
                current_version_id = current_version.id if current_version is not None else None
                if current_version_id != validated_current_version_id:
                    if current_version is None or not current_version.has_identical_content(
                        candidate
                    ):
                        raise Conflict(
                            "The evaluator version changed during source validation; retry."
                        )
                was_created = current_version is None or not current_version.has_identical_content(
                    candidate
                )
                if was_created:
                    candidate.code_evaluator_id = row.id
                    session.add(candidate)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            raise BadRequest(f"Could not create code evaluator version: {e}")

        return CreateCodeEvaluatorVersionPayload(
            evaluator=CodeEvaluator(id=row.id, db_record=row),
            was_created=was_created,
            query=Query(),
        )


@strawberry.input(
    description=(
        "What an annotation must look like for an ANNOTATION_UPSERTED trigger to fire. Fields "
        "left out do not constrain the match."
    )
)
class ProjectEvaluatorTriggerAnnotationPredicatesInput:
    name: Optional[str] = UNSET
    label: Optional[str] = UNSET
    score_below: Optional[float] = UNSET
    score_above: Optional[float] = UNSET
    annotator_kind: Optional[AnnotatorKind] = UNSET
    annotation_change: Optional[AnnotationChange] = UNSET
    annotation_target: Optional[AnnotationTarget] = UNSET
    matches_evaluator_annotations: Optional[bool] = strawberry.field(
        default=UNSET,
        description=(
            "Also match annotations written by other project evaluators, not only the ones "
            "written by people or through the API. A project evaluator never matches its own "
            "annotations."
        ),
    )


@strawberry.input(
    description=(
        "What a finished evaluation must look like for an EVALUATION_COMPLETED trigger to fire. "
        "Fields left out do not constrain the match."
    )
)
class ProjectEvaluatorTriggerEvaluationPredicatesInput:
    name: Optional[str] = UNSET
    label: Optional[str] = UNSET
    score_below: Optional[float] = UNSET
    score_above: Optional[float] = UNSET
    source_project_evaluator_id: Optional[GlobalID] = strawberry.field(
        default=UNSET,
        description=(
            "Match only evaluations produced by this project evaluator, in the same project as "
            "the trigger. A project evaluator never triggers on its own result."
        ),
    )
    result_changed_only: Optional[bool] = UNSET


@strawberry.input(
    description=(
        "The predicate object must be the one that goes with the event kind; the other one is "
        "refused. Leaving both out makes a trigger that fires on every event of its kind "
        "in the project."
    )
)
class CreateProjectEvaluatorTriggerInput:
    project_evaluator_id: GlobalID
    event_kind: EvaluatorEventKind
    annotation_predicates: Optional[ProjectEvaluatorTriggerAnnotationPredicatesInput] = UNSET
    evaluation_predicates: Optional[ProjectEvaluatorTriggerEvaluationPredicatesInput] = UNSET


@strawberry.input(
    description=(
        "A predicate object left out is unchanged; one set to null drops every predicate it "
        "held, so the trigger fires on every event of its kind. Inside a predicate object, "
        "fields left out are unchanged and fields set to null stop constraining the match. "
        "Leaving the event kind out keeps it; changing it drops the predicates of the kind "
        "being left behind, since they cannot describe events of the new one."
    )
)
class PatchProjectEvaluatorTriggerInput:
    project_evaluator_trigger_id: GlobalID
    event_kind: Optional[EvaluatorEventKind] = UNSET
    annotation_predicates: Optional[ProjectEvaluatorTriggerAnnotationPredicatesInput] = UNSET
    evaluation_predicates: Optional[ProjectEvaluatorTriggerEvaluationPredicatesInput] = UNSET


@strawberry.input
class DeleteProjectEvaluatorTriggersInput:
    project_evaluator_trigger_ids: list[GlobalID]


@strawberry.type
class ProjectEvaluatorTriggerMutationPayload:
    trigger: ProjectEvaluatorTrigger
    query: Query


@strawberry.type
class DeleteProjectEvaluatorTriggersPayload:
    project_evaluator_trigger_ids: list[GlobalID]
    query: Query


# Only SESSION evaluators are ever loaded as trigger rules, so a trigger on any other
# target is inert the moment it is written while every surface still reads it as live.
# Refused at creation, in the same words the evaluate-now mutation refuses the same
# mistake with.
_TRIGGER_TARGET_MISMATCH = (
    "This evaluator does not evaluate sessions. Only an evaluator whose evaluation target "
    "is SESSION can be given a trigger."
)
MAX_PROJECT_EVALUATOR_TRIGGERS = 25


@dataclass(frozen=True)
class _PredicateFamily:
    """One event kind's predicate table, as the trigger mutations need to see it.

    A new event kind is a new entry here plus its nested field on the two inputs and on
    ProjectEvaluatorTrigger; nothing below branches on the kind itself.
    """

    event_kind: EvaluatorEventKind
    field_name: str
    model: Any
    columns: tuple[str, ...]
    # Columns whose "do not constrain" value is not NULL. A trigger with no predicate row
    # behaves as if its columns held these.
    defaults: Mapping[str, Any]


_PREDICATE_FAMILIES = (
    _PredicateFamily(
        event_kind=EvaluatorEventKind.ANNOTATION_UPSERTED,
        field_name="annotation_predicates",
        model=models.ProjectEvaluatorTriggerAnnotationPredicates,
        columns=(
            "name",
            "label",
            "score_below",
            "score_above",
            "annotator_kind",
            "annotation_change",
            "annotation_target",
            "matches_evaluator_annotations",
        ),
        defaults={"matches_evaluator_annotations": False},
    ),
    _PredicateFamily(
        event_kind=EvaluatorEventKind.EVALUATION_COMPLETED,
        field_name="evaluation_predicates",
        model=models.ProjectEvaluatorTriggerEvaluationPredicates,
        columns=(
            "name",
            "label",
            "score_below",
            "score_above",
            "source_project_evaluator_id",
            "result_changed_only",
        ),
        defaults={"result_changed_only": False},
    ),
)
_PREDICATE_FAMILY_BY_EVENT_KIND = {family.event_kind: family for family in _PREDICATE_FAMILIES}


def _selected_predicates(input: Any, family: _PredicateFamily) -> Any:
    """The predicate object for this event kind, refusing one meant for another kind."""
    for other in _PREDICATE_FAMILIES:
        if other is not family and getattr(input, other.field_name) is not UNSET:
            raise BadRequest(
                f"{to_camel_case(other.field_name)} cannot be set on a trigger whose event "
                f"kind is {family.event_kind.name}."
            )
    return getattr(input, family.field_name)


async def _predicate_values(
    session: AsyncSession,
    predicates: Any,
    *,
    family: _PredicateFamily,
    project_id: int,
) -> dict[str, Any]:
    """The predicate columns an input object names, leaving out the ones it did not."""
    values: dict[str, Any] = {}
    for column in family.columns:
        value = getattr(predicates, column, UNSET)
        if value is not UNSET:
            values[column] = _enum_value(value)
    # sourceProjectEvaluatorId is the one input field that is not named for its column:
    # it arrives as a global id and is stored as the project_evaluators row it points at.
    source = getattr(predicates, "source_project_evaluator_id", UNSET)
    if source is not UNSET:
        values["source_project_evaluator_id"] = await _resolve_trigger_source_project_evaluator_id(
            session, source, project_id=project_id
        )
    for column, default in family.defaults.items():
        # Clearing this predicate means "do not constrain", which for a flag is false.
        if values.get(column, UNSET) is None:
            values[column] = default
    return values


def _stored_predicate_values(record: Any, family: _PredicateFamily) -> Optional[dict[str, Any]]:
    """The predicate columns a stored row carries, or None when the trigger has no row."""
    if record is None:
        return None
    return {column: getattr(record, column) for column in family.columns}


def _enum_value(value: Any) -> Any:
    return value.value if isinstance(value, Enum) else value


def _raise_if_score_bounds_cannot_match(values: Mapping[str, Any]) -> None:
    """Refuse a score window no score can fall inside.

    Both bounds are strict and they are conjoined, so `above` must sit below `below`.
    Reversed, the rule is accepted, valid, and fires never.
    """
    above, below = values.get("score_above"), values.get("score_below")
    if above is None or below is None or above is UNSET or below is UNSET:
        return
    if above >= below:
        raise BadRequest(
            f"scoreAbove ({above}) must be less than scoreBelow ({below}); no score is both."
        )


async def _resolve_trigger_source_project_evaluator_id(
    session: AsyncSession,
    source_project_evaluator_id: Any,
    *,
    project_id: int,
) -> Any:
    """The project_evaluators a trigger watches, refusing one it could never match.

    Matching requires the watched evaluator and the rule to be in one project, so a
    source from another project makes a rule that is jointly unsatisfiable — configured,
    valid-looking, and silently dormant forever.
    """
    if source_project_evaluator_id is UNSET or source_project_evaluator_id is None:
        return source_project_evaluator_id
    try:
        source_project_evaluator_id = from_global_id_with_expected_type(
            source_project_evaluator_id, ProjectEvaluator.__name__
        )
    except ValueError as error:
        raise BadRequest(str(error))
    source = await session.get(models.ProjectEvaluator, source_project_evaluator_id)
    if source is None:
        raise NotFound(f"Project evaluator not found: {source_project_evaluator_id}")
    if source.project_id != project_id:
        raise BadRequest("A trigger can only watch a project evaluator in its own project.")
    return source_project_evaluator_id


async def _raise_on_duplicate_project_evaluator_trigger(
    session: AsyncSession,
    *,
    project_evaluator_id: int,
    family: _PredicateFamily,
    values: Optional[Mapping[str, Any]],
    exclude_trigger_id: Optional[int] = None,
) -> None:
    """Refuse a second trigger identical to one the evaluator already carries.

    A trigger with no predicate row and one whose predicates are all unconstrained match
    the same events, so the comparison reads an absent row as its default columns.
    """
    wanted: dict[str, Any] = {column: family.defaults.get(column) for column in family.columns}
    wanted.update(values or {})
    stmt = (
        select(models.ProjectEvaluatorTrigger.id)
        .outerjoin(family.model, family.model.trigger_id == models.ProjectEvaluatorTrigger.id)
        .where(
            models.ProjectEvaluatorTrigger.project_evaluator_id == project_evaluator_id,
            models.ProjectEvaluatorTrigger.event_kind == family.event_kind.value,
            *(_predicate_column_matches(family, column, value) for column, value in wanted.items()),
        )
    )
    if exclude_trigger_id is not None:
        stmt = stmt.where(models.ProjectEvaluatorTrigger.id != exclude_trigger_id)
    if (existing_id := await session.scalar(stmt)) is not None:
        existing = GlobalID(ProjectEvaluatorTrigger.__name__, str(existing_id))
        raise Conflict(
            f"This project evaluator already has a trigger with these predicates: {existing}"
        )


async def _raise_if_project_evaluator_trigger_limit_reached(
    session: AsyncSession,
    *,
    project_evaluator_id: int,
) -> None:
    """Bound synchronous event matching before accepting another trigger."""
    trigger_count = await session.scalar(
        select(func.count())
        .select_from(models.ProjectEvaluatorTrigger)
        .where(models.ProjectEvaluatorTrigger.project_evaluator_id == project_evaluator_id)
    )
    if (trigger_count or 0) >= MAX_PROJECT_EVALUATOR_TRIGGERS:
        raise BadRequest(
            f"A project evaluator can have at most {MAX_PROJECT_EVALUATOR_TRIGGERS} triggers."
        )


def _predicate_column_matches(family: _PredicateFamily, column: str, value: Any) -> Any:
    stored = getattr(family.model, column)
    if column in family.defaults:
        stored = func.coalesce(stored, family.defaults[column])
    return stored.is_not_distinct_from(value)


async def _load_trigger_with_predicates(
    session: AsyncSession, trigger_id: int
) -> models.ProjectEvaluatorTrigger:
    """Re-read a written trigger with its database-side timestamps and predicate children."""
    trigger = await session.scalar(
        select(models.ProjectEvaluatorTrigger)
        .where(models.ProjectEvaluatorTrigger.id == trigger_id)
        .options(
            selectinload(models.ProjectEvaluatorTrigger.annotation_predicates),
            selectinload(models.ProjectEvaluatorTrigger.evaluation_predicates),
        )
        .execution_options(populate_existing=True)
    )
    assert trigger is not None
    return trigger


@strawberry.type
class ProjectEvaluatorTriggerMutationMixin:
    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Add a rule that makes this project evaluator run whenever a matching event "
            "is recorded. Predicates left out do not constrain the match. The rule applies to "
            "events recorded after it is created and never to earlier ones; to evaluate "
            "sessions that already carry a matching annotation, ask for those evaluations "
            "directly with requestProjectSessionEvaluation."
        ),
    )  # type: ignore
    async def create_project_evaluator_trigger(
        self, info: Info[Context, None], input: CreateProjectEvaluatorTriggerInput
    ) -> ProjectEvaluatorTriggerMutationPayload:
        try:
            project_evaluator_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
        except ValueError as error:
            raise BadRequest(str(error))
        family = _PREDICATE_FAMILY_BY_EVENT_KIND[input.event_kind]
        predicates = _selected_predicates(input, family)
        async with info.context.db() as session:
            # Serialize trigger creation per evaluator so concurrent authors cannot pass
            # the cap together. The cap bounds the synchronous event-matching cross-product.
            project_evaluators = await session.scalar(
                select(models.ProjectEvaluator)
                .where(models.ProjectEvaluator.id == project_evaluator_id)
                .with_for_update()
            )
            if project_evaluator is None:
                raise NotFound(f"Project evaluator not found: {input.project_evaluator_id}")
            if project_evaluators.evaluation_target != "SESSION":
                raise BadRequest(_TRIGGER_TARGET_MISMATCH)
            await _raise_if_project_evaluator_trigger_limit_reached(
                session,
                project_evaluator_id=project_evaluator_id,
            )
            values = (
                None
                if predicates is UNSET or predicates is None
                else await _predicate_values(
                    session, predicates, family=family, project_id=project_evaluators.project_id
                )
            )
            _raise_if_score_bounds_cannot_match(values or {})
            await _raise_on_duplicate_project_evaluator_trigger(
                session,
                project_evaluator_id=project_evaluator_id,
                family=family,
                values=values,
            )
            trigger = models.ProjectEvaluatorTrigger(
                project_evaluator_id=project_evaluator_id,
                event_kind=input.event_kind.value,
            )
            session.add(trigger)
            try:
                await session.flush()
                if values is not None:
                    session.add(
                        family.model(
                            trigger_id=trigger.id,
                            event_kind=input.event_kind.value,
                            **values,
                        )
                    )
                    await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
                raise Conflict(f"Could not create trigger: {error}")
            payload = to_gql_project_evaluator_trigger(
                await _load_trigger_with_predicates(session, trigger.id)
            )
        return ProjectEvaluatorTriggerMutationPayload(trigger=payload, query=Query())

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description="Change the event kind or the predicates of an existing trigger.",
    )  # type: ignore
    async def patch_project_evaluator_trigger(
        self, info: Info[Context, None], input: PatchProjectEvaluatorTriggerInput
    ) -> ProjectEvaluatorTriggerMutationPayload:
        # Editing a rule is the same act as writing one, so it meets the same gate.
        # Deletion stays open: removing a rule the arm would never act on is cleanup.
        raise_if_session_evaluation_unavailable()
        try:
            trigger_id = from_global_id_with_expected_type(
                input.project_evaluator_trigger_id, ProjectEvaluatorTrigger.__name__
            )
        except ValueError as error:
            raise BadRequest(str(error))
        async with info.context.db() as session:
            trigger = await session.get(models.ProjectEvaluatorTrigger, trigger_id)
            if trigger is None:
                raise NotFound(
                    f"Trigger not found: {input.project_evaluator_trigger_id}",
                )
            previous_family = _PREDICATE_FAMILY_BY_EVENT_KIND[
                EvaluatorEventKind(trigger.event_kind)
            ]
            family = (
                previous_family
                if input.event_kind is UNSET or input.event_kind is None
                else _PREDICATE_FAMILY_BY_EVENT_KIND[input.event_kind]
            )
            predicates = _selected_predicates(input, family)
            project_evaluators = await session.get(models.ProjectEvaluator, trigger.project_evaluator_id)
            if project_evaluator is None:
                raise NotFound(f"Trigger not found: {input.project_evaluator_trigger_id}")
            # A kind change leaves the old family's row behind; nothing of it carries over.
            stored = (
                await session.scalar(
                    select(family.model).where(family.model.trigger_id == trigger_id)
                )
                if family is previous_family
                else None
            )
            if predicates is UNSET:
                values = _stored_predicate_values(stored, family)
            elif predicates is None:
                values = None
            else:
                patch = await _predicate_values(
                    session, predicates, family=family, project_id=project_evaluators.project_id
                )
                values = {**(_stored_predicate_values(stored, family) or {}), **patch}
            _raise_if_score_bounds_cannot_match(values or {})
            await _raise_on_duplicate_project_evaluator_trigger(
                session,
                project_evaluator_id=trigger.project_evaluator_id,
                family=family,
                values=values,
                exclude_trigger_id=trigger_id,
            )
            try:
                if family is not previous_family:
                    # The child's foreign key names (trigger_id, event_kind), so the row of
                    # the kind being left behind goes before the trigger's kind changes.
                    await session.execute(
                        delete(previous_family.model).where(
                            previous_family.model.trigger_id == trigger_id
                        )
                    )
                    await session.flush()
                    trigger.event_kind = family.event_kind.value
                    await session.flush()
                if values is None:
                    if stored is not None:
                        await session.delete(stored)
                elif stored is not None:
                    for column, value in values.items():
                        setattr(stored, column, value)
                else:
                    session.add(
                        family.model(
                            trigger_id=trigger_id,
                            event_kind=family.event_kind.value,
                            **values,
                        )
                    )
                await session.flush()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError) as error:
                raise Conflict(f"Could not update trigger: {error}")
            payload = to_gql_project_evaluator_trigger(
                await _load_trigger_with_predicates(session, trigger_id)
            )
        return ProjectEvaluatorTriggerMutationPayload(trigger=payload, query=Query())

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description="Remove triggers, leaving the evaluators they belong to in place.",
    )  # type: ignore
    async def delete_project_evaluator_triggers(
        self, info: Info[Context, None], input: DeleteProjectEvaluatorTriggersInput
    ) -> DeleteProjectEvaluatorTriggersPayload:
        trigger_ids: list[int] = []
        for global_id in input.project_evaluator_trigger_ids:
            try:
                trigger_ids.append(
                    from_global_id_with_expected_type(global_id, ProjectEvaluatorTrigger.__name__)
                )
            except ValueError:
                raise BadRequest(f"Invalid trigger id: {global_id}")
        if not trigger_ids:
            return DeleteProjectEvaluatorTriggersPayload(
                project_evaluator_trigger_ids=[], query=Query()
            )
        async with info.context.db() as session:
            deleted = list(
                await session.scalars(
                    select(models.ProjectEvaluatorTrigger.id).where(
                        models.ProjectEvaluatorTrigger.id.in_(trigger_ids)
                    )
                )
            )
            if deleted:
                await session.execute(
                    delete(models.ProjectEvaluatorTrigger).where(
                        models.ProjectEvaluatorTrigger.id.in_(deleted)
                    )
                )
        return DeleteProjectEvaluatorTriggersPayload(
            project_evaluator_trigger_ids=[
                GlobalID(ProjectEvaluatorTrigger.__name__, str(trigger_id))
                for trigger_id in deleted
            ],
            query=Query(),
        )

