from datetime import datetime, timezone
from secrets import token_hex
from typing import Optional, cast

import strawberry
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, code_evaluator_with_latest_version_for_update
from phoenix.db.models import EvaluatorKind
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfigType,
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
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.api.types.SandboxConfig import (
    Language,
    SandboxConfig,
)
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.online_eval.session_policy import MINIMUM_EVALUATION_DELAY_SECONDS
from phoenix.trace.dsl.filter import validate_span_filter_condition


def _output_config_input_to_pydantic(input: AnnotationConfigInput) -> OutputConfigType:
    """
    Convert AnnotationConfigInput to pydantic for evaluator output configs.
    Always includes name.
    """
    from phoenix.db.types.annotation_configs import (
        AnnotationType,
        CategoricalAnnotationValue,
    )

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
    session: AsyncSession,
    *,
    sandbox_config_global_id: GlobalID,
    language: str,
    action: str,
) -> int:
    sandbox_config_id = from_global_id_with_expected_type(
        sandbox_config_global_id, SandboxConfig.__name__
    )
    target_cfg = await session.get(models.SandboxConfig, sandbox_config_id)
    if target_cfg is None:
        raise BadRequest(f"Sandbox config not found: {sandbox_config_global_id}")
    if not target_cfg.enabled:
        raise BadRequest(
            f"Sandbox configuration '{target_cfg.name}' is disabled. Enable it before {action}."
        )

    provider = await session.get(models.SandboxProvider, target_cfg.backend_type)
    if provider is None:
        raise BadRequest(f"Sandbox provider for configuration '{target_cfg.name}' was not found")
    if not provider.enabled:
        raise BadRequest(
            f"Sandbox provider '{provider.backend_type}' is disabled. Enable it before {action}."
        )

    if target_cfg.language != language:
        raise BadRequest("Evaluator language does not match sandbox config language")

    # Backend runtime availability (installed dependencies, downloaded binaries)
    # is enforced at execution time, not authoring time.
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
    # Get or create the "evaluator" label
    stmt = select(models.PromptLabel).where(models.PromptLabel.name == "evaluator")
    result = await session.execute(stmt)
    label = result.scalar_one_or_none()

    if label is None:
        # Create the label if it doesn't exist
        label = models.PromptLabel(
            name="evaluator",
            description="Automatically assigned to prompts created for LLM evaluators",
            color="#4ecf50",
        )
        session.add(label)
        await session.flush()  # Flush to get the ID

    # Step 2: Check if association already exists
    assoc_stmt = select(models.PromptPromptLabel).where(
        models.PromptPromptLabel.prompt_id == prompt_id,
        models.PromptPromptLabel.prompt_label_id == label.id,
    )
    assoc_result = await session.execute(assoc_stmt)
    existing_association = assoc_result.scalar_one_or_none()

    if existing_association is None:
        # Create the association if it doesn't exist
        association = models.PromptPromptLabel(
            prompt_id=prompt_id,
            prompt_label_id=label.id,
        )
        session.add(association)


def _validate_project_evaluator_filter(filter_condition: str) -> None:
    try:
        validate_span_filter_condition(filter_condition)
    except Exception:
        raise BadRequest("Invalid filter condition: unable to compile for supported databases")


def _validate_project_evaluator_sampling_rate(sampling_rate: float) -> None:
    if not 0.0 <= sampling_rate <= 1.0:
        raise BadRequest("samplingRate must be between 0.0 and 1.0")


def _validate_project_evaluator_evaluation_delay(
    evaluation_delay_seconds: Optional[int],
) -> None:
    if (
        evaluation_delay_seconds is not None
        and evaluation_delay_seconds < MINIMUM_EVALUATION_DELAY_SECONDS
    ):
        raise BadRequest(
            f"evaluationDelaySeconds must be at least {MINIMUM_EVALUATION_DELAY_SECONDS} seconds"
        )


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
                ~select(models.ProjectEvaluatorCriteria.id)
                .where(models.ProjectEvaluatorCriteria.evaluator_id == models.Evaluator.id)
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
    evaluator_types: dict[str, EvaluatorKind] = {
        LLMEvaluator.__name__: "LLM",
        CodeEvaluator.__name__: "CODE",
        BuiltInEvaluator.__name__: "BUILTIN",
    }
    if type_name not in evaluator_types:
        raise ValueError(
            f"Invalid evaluator type: {type_name}. "
            f"Expected one of {', '.join(evaluator_types.keys())}"
        )
    return evaluator_rowid, evaluator_types[type_name]


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
    description: Optional[str] = None
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
            "Seconds of inactivity before a SESSION evaluation. Null uses the default delay."
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
    evaluation_target: EvaluationTarget
    filter_condition: str
    enabled: bool
    description: Optional[str] = None
    prompt_version_id: Optional[GlobalID] = UNSET
    evaluation_delay_seconds: Optional[int] = strawberry.field(
        default=UNSET,
        description=(
            "SESSION evaluation delay in seconds. Omit to preserve the current setting or use "
            "null to restore the default delay."
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
            "Seconds of inactivity before a SESSION evaluation. Null uses the default delay."
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
            "Seconds of inactivity before a SESSION evaluation. Null uses the default delay."
        ),
    )


@strawberry.input
class UpdateProjectCodeEvaluatorInput:
    project_evaluator_id: GlobalID
    name: Identifier
    evaluator_input_mapping: EvaluatorInputMappingInput
    sampling_rate: float
    evaluation_target: EvaluationTarget
    filter_condition: str
    enabled: bool
    description: Optional[str] = None
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
            "SESSION evaluation delay in seconds. Omit to preserve the current setting or use "
            "null to restore the default delay."
        ),
    )


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
        description=(
            "Create an LLM project evaluator. SPAN evaluators run on matching spans; "
            "unfiltered SESSION evaluators with full sampling run after their evaluation delay. "
            "TRACE evaluators are stored but not scheduled."
        ),
    )  # type: ignore
    async def create_project_llm_evaluator(
        self, info: Info[Context, None], input: CreateProjectLLMEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
        except ValueError:
            raise BadRequest(f"Invalid project id: {input.project_id}")
        _validate_project_evaluator_filter(input.filter_condition)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        _validate_project_evaluator_evaluation_delay(input.evaluation_delay_seconds)
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
                if await session.get(models.Project, project_id) is None:
                    raise NotFound(f"Project not found: {input.project_id}")
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
                criteria = models.ProjectEvaluatorCriteria(
                    project_id=project_id,
                    evaluator_id=evaluator.id,
                    name=name,
                    filter_condition=input.filter_condition,
                    sampling_rate=input.sampling_rate,
                    evaluation_target=input.evaluation_target.value,
                    input_mapping=input.input_mapping.to_orm(),
                    evaluation_delay_seconds=input.evaluation_delay_seconds,
                    enabled=input.enabled,
                )
                session.add(criteria)
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=criteria.id, db_record=criteria),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Update an LLM project evaluator. SPAN evaluators run on matching spans; "
            "unfiltered SESSION evaluators with full sampling run after their evaluation delay. "
            "TRACE evaluators are stored but not scheduled."
        ),
    )  # type: ignore
    async def update_project_llm_evaluator(
        self, info: Info[Context, None], input: UpdateProjectLLMEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            criteria_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
        except ValueError:
            raise BadRequest(f"Invalid project evaluator id: {input.project_evaluator_id}")
        _validate_project_evaluator_filter(input.filter_condition)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        if input.evaluation_delay_seconds is not UNSET:
            _validate_project_evaluator_evaluation_delay(input.evaluation_delay_seconds)
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
                        select(models.ProjectEvaluatorCriteria, models.LLMEvaluator)
                        .join(
                            models.LLMEvaluator,
                            models.ProjectEvaluatorCriteria.evaluator_id == models.LLMEvaluator.id,
                        )
                        .where(models.ProjectEvaluatorCriteria.id == criteria_id)
                    )
                ).one_or_none()
                if pair is None:
                    raise NotFound(f"LLM project evaluator not found: {input.project_evaluator_id}")
                criteria, evaluator = pair
                if criteria.name != name:
                    evaluator.name = await _generate_unique_evaluator_name(session, name)

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

                evaluator.description = input.description
                evaluator.output_configs = output_configs
                evaluator.user_id = user_id
                evaluator.prompt_id = target_prompt_id
                evaluator.updated_at = datetime.now(timezone.utc)
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
                else:
                    prompt_version_tag = await session.get(
                        models.PromptVersionTag, evaluator.prompt_version_tag_id
                    )
                    if prompt_version_tag is None:
                        raise NotFound("Prompt version tag was not found")
                    prompt_version_tag.prompt_id = target_prompt_id
                    prompt_version_tag.prompt_version_id = final_prompt_version_id

                criteria.name = name
                criteria.filter_condition = input.filter_condition
                criteria.sampling_rate = input.sampling_rate
                criteria.evaluation_target = input.evaluation_target.value
                criteria.input_mapping = input.input_mapping.to_orm()
                if input.evaluation_delay_seconds is not UNSET:
                    criteria.evaluation_delay_seconds = input.evaluation_delay_seconds
                criteria.enabled = input.enabled
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=criteria.id, db_record=criteria),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Bind an existing CODE evaluator to a project. The evaluator's configuration is "
            "shared with every project and dataset it is bound to. SPAN evaluators run on "
            "matching spans; unfiltered SESSION evaluators with full sampling run after their "
            "evaluation delay. TRACE evaluators are stored but not scheduled."
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
        _validate_project_evaluator_filter(input.filter_condition)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        _validate_project_evaluator_evaluation_delay(input.evaluation_delay_seconds)

        try:
            async with info.context.db() as session:
                if await session.get(models.Project, project_id) is None:
                    raise NotFound(f"Project not found: {input.project_id}")
                if await session.get(models.CodeEvaluator, evaluator_id) is None:
                    raise BadRequest("CODE evaluator not found")
                criteria = models.ProjectEvaluatorCriteria(
                    project_id=project_id,
                    evaluator_id=evaluator_id,
                    name=name,
                    filter_condition=input.filter_condition,
                    sampling_rate=input.sampling_rate,
                    evaluation_target=input.evaluation_target.value,
                    input_mapping=(
                        input.input_mapping.to_orm() if input.input_mapping is not None else None
                    ),
                    evaluation_delay_seconds=input.evaluation_delay_seconds,
                    enabled=input.enabled,
                )
                session.add(criteria)
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=criteria.id, db_record=criteria),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Create a CODE project evaluator. SPAN evaluators run on matching spans; "
            "unfiltered SESSION evaluators with full sampling run after their evaluation delay. "
            "TRACE evaluators are stored but not scheduled."
        ),
    )  # type: ignore
    async def create_project_code_evaluator(
        self, info: Info[Context, None], input: CreateProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            project_id = from_global_id_with_expected_type(input.project_id, Project.__name__)
            name = IdentifierModel.model_validate(input.name)
        except (ValueError, ValidationError) as error:
            raise BadRequest(str(error))
        _validate_project_evaluator_filter(input.filter_condition)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        _validate_project_evaluator_evaluation_delay(input.evaluation_delay_seconds)
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

        try:
            async with info.context.db() as session:
                if await session.get(models.Project, project_id) is None:
                    raise NotFound(f"Project not found: {input.project_id}")
                evaluator_name = await _generate_unique_evaluator_name(session, name)
                sandbox_config_id = await _validate_code_evaluator_sandbox_config(
                    session,
                    sandbox_config_global_id=input.sandbox_config_id,
                    language=input.language.value,
                    action="creating this evaluator",
                )
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
                criteria = models.ProjectEvaluatorCriteria(
                    project_id=project_id,
                    evaluator_id=evaluator.id,
                    name=name,
                    filter_condition=input.filter_condition,
                    sampling_rate=input.sampling_rate,
                    evaluation_target=input.evaluation_target.value,
                    input_mapping=(
                        input.input_mapping.to_orm() if input.input_mapping is not None else None
                    ),
                    evaluation_delay_seconds=input.evaluation_delay_seconds,
                    enabled=input.enabled,
                )
                session.add(criteria)
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=criteria.id, db_record=criteria),
            query=Query(),
        )

    @strawberry.mutation(
        permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked],
        description=(
            "Update a CODE project evaluator. Editing changes the underlying evaluator, which "
            "applies to every project and dataset it is bound to. SPAN evaluators run on matching "
            "spans; unfiltered SESSION evaluators with full sampling run after their evaluation "
            "delay. TRACE evaluators are stored but not scheduled."
        ),
    )  # type: ignore
    async def update_project_code_evaluator(
        self, info: Info[Context, None], input: UpdateProjectCodeEvaluatorInput
    ) -> ProjectEvaluatorMutationPayload:
        try:
            criteria_id = from_global_id_with_expected_type(
                input.project_evaluator_id, ProjectEvaluator.__name__
            )
            name = IdentifierModel.model_validate(input.name)
        except (ValueError, ValidationError) as error:
            raise BadRequest(str(error))
        _validate_project_evaluator_filter(input.filter_condition)
        _validate_project_evaluator_sampling_rate(input.sampling_rate)
        if input.evaluation_delay_seconds is not UNSET:
            _validate_project_evaluator_evaluation_delay(input.evaluation_delay_seconds)
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

        try:
            async with info.context.db() as session:
                pair = (
                    await session.execute(
                        select(models.ProjectEvaluatorCriteria, models.CodeEvaluator)
                        .join(
                            models.CodeEvaluator,
                            models.ProjectEvaluatorCriteria.evaluator_id == models.CodeEvaluator.id,
                        )
                        .where(models.ProjectEvaluatorCriteria.id == criteria_id)
                    )
                ).one_or_none()
                if pair is None:
                    raise NotFound(
                        f"CODE project evaluator not found: {input.project_evaluator_id}"
                    )
                criteria, evaluator = pair
                if criteria.name != name:
                    evaluator.name = await _generate_unique_evaluator_name(session, name)
                evaluator.description = input.description
                evaluator.user_id = user_id
                evaluator.input_mapping = input.evaluator_input_mapping.to_orm()

                if input.sandbox_config_id is not UNSET:
                    if input.sandbox_config_id is None:
                        evaluator.sandbox_config_id = None
                    else:
                        evaluator.sandbox_config_id = await _validate_code_evaluator_sandbox_config(
                            session,
                            sandbox_config_global_id=input.sandbox_config_id,
                            language=evaluator.language,
                            action="updating this evaluator",
                        )
                if input.output_configs is not UNSET:
                    evaluator.output_configs = cast(
                        list[AnnotationConfigType],
                        _convert_output_config_inputs_to_pydantic(input.output_configs),
                    )
                if input.source_code is not UNSET and input.source_code is not None:
                    _raise_on_uninferable_evaluate_signature(
                        input.source_code, Language(evaluator.language)
                    )
                    locked = await code_evaluator_with_latest_version_for_update(
                        session, evaluator.id
                    )
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

                criteria.name = name
                criteria.filter_condition = input.filter_condition
                criteria.sampling_rate = input.sampling_rate
                criteria.evaluation_target = input.evaluation_target.value
                if input.input_mapping is not UNSET:
                    criteria.input_mapping = (
                        input.input_mapping.to_orm() if input.input_mapping is not None else None
                    )
                if input.evaluation_delay_seconds is not UNSET:
                    criteria.evaluation_delay_seconds = input.evaluation_delay_seconds
                criteria.enabled = input.enabled
                await session.flush()
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            raise Conflict("A project evaluator with this name already exists for this project")

        return ProjectEvaluatorMutationPayload(
            evaluator=ProjectEvaluator(id=criteria.id, db_record=criteria),
            query=Query(),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def delete_project_evaluators(
        self, info: Info[Context, None], input: DeleteProjectEvaluatorsInput
    ) -> DeleteProjectEvaluatorsPayload:
        criteria_ids: list[int] = []
        for global_id in input.project_evaluator_ids:
            try:
                criteria_ids.append(
                    from_global_id_with_expected_type(global_id, ProjectEvaluator.__name__)
                )
            except ValueError:
                raise BadRequest(f"Invalid project evaluator id: {global_id}")
        if not criteria_ids:
            return DeleteProjectEvaluatorsPayload(project_evaluator_ids=[], query=Query())

        deleted_ids: list[GlobalID] = []
        async with info.context.db() as session:
            llm_evaluator_alias = aliased(models.LLMEvaluator, flat=True)
            rows = (
                await session.execute(
                    select(
                        models.ProjectEvaluatorCriteria.id,
                        models.ProjectEvaluatorCriteria.evaluator_id,
                        models.Evaluator.kind,
                        llm_evaluator_alias.prompt_id,
                    )
                    .join(
                        models.Evaluator,
                        models.ProjectEvaluatorCriteria.evaluator_id == models.Evaluator.id,
                    )
                    .outerjoin(
                        llm_evaluator_alias,
                        models.ProjectEvaluatorCriteria.evaluator_id == llm_evaluator_alias.id,
                    )
                    .where(models.ProjectEvaluatorCriteria.id.in_(criteria_ids))
                )
            ).all()
            evaluator_ids: set[int] = set()
            prompt_ids: set[int] = set()
            actual_criteria_ids: list[int] = []
            for criteria_id, evaluator_id, kind, prompt_id in rows:
                actual_criteria_ids.append(criteria_id)
                deleted_ids.append(GlobalID(ProjectEvaluator.__name__, str(criteria_id)))
                if kind != "BUILTIN":
                    evaluator_ids.add(evaluator_id)
                    if prompt_id is not None:
                        prompt_ids.add(prompt_id)
            if actual_criteria_ids:
                await session.execute(
                    delete(models.ProjectEvaluatorCriteria).where(
                        models.ProjectEvaluatorCriteria.id.in_(actual_criteria_ids)
                    )
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
                    existing_prompt_version = await session.get(
                        models.PromptVersion, prompt_version_id
                    )
                    if existing_prompt_version is None:
                        raise NotFound(
                            f"Prompt version with id {input.prompt_version_id} not found"
                        )
                    existing_prompt_id = existing_prompt_version.prompt_id

                    # Fetch the existing prompt
                    prompt = await session.get(models.Prompt, existing_prompt_id)
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
                llm_evaluator.updated_at = datetime.now(timezone.utc)

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
                session.add(llm_evaluator)
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
                select(models.DatasetEvaluators, models.LLMEvaluator)
                .join(
                    models.LLMEvaluator,
                    models.DatasetEvaluators.evaluator_id == models.LLMEvaluator.id,
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
            dataset_evaluator, llm_evaluator = dataset_evaluator_pair

            # Handle prompt_version_id if provided
            target_prompt_id = llm_evaluator.prompt_id
            provided_prompt_version_id: Optional[int] = None
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
                # Update the prompt_version_tag to point to the provided prompt_version
                if llm_evaluator.prompt_version_tag_id is not None:
                    prompt_version_tag = await session.get(
                        models.PromptVersionTag, llm_evaluator.prompt_version_tag_id
                    )
                    if prompt_version_tag is not None:
                        prompt_version_tag.prompt_id = target_prompt_id
                        prompt_version_tag.prompt_version_id = provided_prompt_version_id
                    else:
                        raise NotFound(
                            f"Prompt version tag with id {llm_evaluator.prompt_version_tag_id} "
                            "not found"
                        )

            # Retrieve the active prompt version for comparison
            if provided_prompt_version_id is not None:
                active_prompt_version = await session.get(
                    models.PromptVersion, provided_prompt_version_id
                )
                if active_prompt_version is None:
                    raise NotFound(f"Prompt version with id {provided_prompt_version_id} not found")
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
                # Use the newly created prompt_version for comparison (it will always be "new")
                active_prompt_version = prompt_version

            dataset_evaluator.name = evaluator_name
            dataset_evaluator.description = (
                input.description if isinstance(input.description, str) else None
            )
            dataset_evaluator.output_configs = list(output_configs)
            if input.input_mapping is None:
                raise BadRequest("input_mapping is required")
            dataset_evaluator.input_mapping = input.input_mapping.to_orm()
            dataset_evaluator.user_id = user_id

            llm_evaluator.description = (
                input.description if isinstance(input.description, str) else None
            )
            llm_evaluator.output_configs = list(output_configs)
            llm_evaluator.updated_at = datetime.now(timezone.utc)
            llm_evaluator.user_id = user_id

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
                    prompt_version_tag = await session.get(
                        models.PromptVersionTag, llm_evaluator.prompt_version_tag_id
                    )
                    if prompt_version_tag is not None:
                        prompt_version_tag.prompt_version_id = final_prompt_version_id
                        # Ensure prompt_id matches
                        prompt_version_tag.prompt_id = target_prompt_id

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
                            models.ProjectEvaluatorCriteria.evaluator_id,
                            models.Evaluator.kind,
                            llm_evaluator_alias.prompt_id,
                        )
                        .join(
                            models.Evaluator,
                            models.ProjectEvaluatorCriteria.evaluator_id == models.Evaluator.id,
                        )
                        .outerjoin(
                            llm_evaluator_alias,
                            models.ProjectEvaluatorCriteria.evaluator_id == llm_evaluator_alias.id,
                        )
                        .where(models.ProjectEvaluatorCriteria.project_id.in_(project_ids))
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
                await session.execute(
                    delete(models.Project).where(models.Project.id.in_(project_ids))
                )

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
                # Look up the builtin evaluator from DB to get its key
                builtin_db = await session.get(models.BuiltinEvaluator, built_in_evaluator_id)
                if builtin_db is None:
                    raise NotFound(f"Built-in evaluator with id {input.evaluator_id} not found")

                # Get the evaluator class from registry using the key
                builtin_evaluator = get_builtin_evaluator_by_key(builtin_db.key)
                if builtin_evaluator is None:
                    raise NotFound(f"Built-in evaluator class not found for key: {builtin_db.key}")

                # If output_configs provided, convert them; otherwise store None
                # (resolver falls back to base evaluator configs at runtime)
                output_configs: Optional[list[OutputConfigType]] = None
                if input.output_configs is not None:
                    output_configs = _convert_output_config_inputs_to_pydantic(input.output_configs)

                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_rowid} not found")

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
                code_evaluator = await session.get(models.CodeEvaluator, evaluator_id)
                if code_evaluator is None:
                    raise NotFound(f"Code evaluator with id {input.evaluator_id} not found")

                dataset_name = await session.scalar(
                    select(models.Dataset.name).where(models.Dataset.id == dataset_rowid)
                )
                if dataset_name is None:
                    raise NotFound(f"Dataset with id {dataset_rowid} not found")

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
            dataset_evaluator.output_configs = [
                config
                for config in code_evaluator.output_configs
                if isinstance(
                    config,
                    (CategoricalOutputConfig, ContinuousOutputConfig, FreeformOutputConfig),
                )
            ]

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
            dataset_evaluator.output_configs = [
                config
                for config in evaluator.output_configs
                if isinstance(
                    config,
                    (CategoricalOutputConfig, ContinuousOutputConfig, FreeformOutputConfig),
                )
            ]

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

        try:
            async with info.context.db() as session:
                sandbox_config_id = await _validate_code_evaluator_sandbox_config(
                    session,
                    sandbox_config_global_id=input.sandbox_config_id,
                    language=input.language.value,
                    action="creating this evaluator",
                )

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

        try:
            async with info.context.db() as session:
                row = await session.get(models.CodeEvaluator, evaluator_id)
                if row is None:
                    raise NotFound(f"CodeEvaluator not found: {evaluator_id}")

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
                        sandbox_config_id = await _validate_code_evaluator_sandbox_config(
                            session,
                            sandbox_config_global_id=input.sandbox_config_id,
                            language=row.language,
                            action="patching this evaluator",
                        )
                        row.sandbox_config_id = sandbox_config_id

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

        try:
            async with info.context.db() as session:
                code_evaluator_with_version = await code_evaluator_with_latest_version_for_update(
                    session, evaluator_id
                )
                if code_evaluator_with_version is None:
                    raise NotFound(f"CodeEvaluator not found: {evaluator_id}")
                row, current_version = code_evaluator_with_version
                _raise_on_uninferable_evaluate_signature(input.source_code, Language(row.language))

                candidate = models.CodeEvaluatorVersion(
                    code_evaluator_id=row.id,
                    source_code=input.source_code,
                    user_id=user_id,
                )

                was_created = current_version is None or not current_version.has_identical_content(
                    candidate
                )
                if was_created:
                    session.add(candidate)
        except (PostgreSQLIntegrityError, SQLiteIntegrityError) as e:
            raise BadRequest(f"Could not create code evaluator version: {e}")

        return CreateCodeEvaluatorVersionPayload(
            evaluator=CodeEvaluator(id=row.id, db_record=row),
            was_created=was_created,
            query=Query(),
        )
