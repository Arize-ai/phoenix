"""Shared evaluator validation, naming, and cleanup helpers."""

from secrets import token_hex
from typing import Optional

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.models import EvaluatorKind
from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfigType,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.evaluators import (
    _infer_python_evaluate_input_schema,
    _infer_typescript_evaluate_input_schema,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigInput,
)
from phoenix.server.api.types.Evaluator import (
    BuiltInEvaluator,
    CodeEvaluator,
    EvaluationTarget,
    LLMEvaluator,
)
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.SandboxConfig import (
    Language,
    SandboxConfig,
)
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

PROJECT_EVALUATOR_SCHEDULING_DESCRIPTION = (
    "SPAN evaluators run on matching sampled spans. A SESSION evaluator decides once per "
    "session at the first quiet period after the evaluation delay: it applies the session "
    "filter first, then deterministic sampling, and schedules admitted work asynchronously. "
    "A filter non-match or sampling miss is permanently declined for that evaluator "
    "configuration; later activity does not reopen the decision. TRACE evaluators are stored "
    "but not scheduled. Only SESSION scheduling honors the evaluation delay, which a SPAN "
    "target rejects. The target is fixed at creation."
)


def _output_config_input_to_pydantic(input: AnnotationConfigInput) -> OutputConfigType:
    """Convert an annotation input to a named evaluator output configuration."""
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


def convert_output_config_inputs_to_pydantic(
    configs: list[AnnotationConfigInput],
) -> list[OutputConfigType]:
    """Convert annotation inputs to evaluator output configurations."""
    return [_output_config_input_to_pydantic(c) for c in configs]


def raise_on_uninferable_evaluate_signature(source_code: str, language: Language) -> None:
    if language is Language.PYTHON:
        _, error_message = _infer_python_evaluate_input_schema(source_code)
    elif language is Language.TYPESCRIPT:
        _, error_message = _infer_typescript_evaluate_input_schema(source_code)
    else:
        error_message = f"Unsupported code evaluator language: {language.value}"
    if error_message is not None:
        raise BadRequest(error_message)


async def validate_code_evaluator_sandbox_config(
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

    # Release SQLite's database lock before waiting for sandbox worker capacity.
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


async def generate_unique_evaluator_name(
    session: AsyncSession,
    base_name: Identifier,
    max_attempts: int = 5,
) -> Identifier:
    """Return an unused name, trying at most max_attempts random suffixes on collision."""
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


def get_project_for_dataset_evaluator(
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


def get_trace_project_for_project_evaluator(
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


async def ensure_evaluator_prompt_label(
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
        label = models.PromptLabel(
            name="evaluator",
            description="Automatically assigned to prompts created for LLM evaluators",
            color="#4ecf50",
        )
        session.add(label)
        await session.flush()
        existing_association = None
    else:
        label, existing_association = label_and_association

    if existing_association is None:
        association = models.PromptPromptLabel(
            prompt_id=prompt_id,
            prompt_label_id=label.id,
        )
        session.add(association)


async def validate_project_evaluator_project(
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


def validate_project_evaluator_filter(
    filter_condition: str,
    evaluation_target: EvaluationTarget,
) -> None:
    """Compile SESSION filters with the session DSL; SPAN and TRACE filters with the span DSL."""
    try:
        if evaluation_target is EvaluationTarget.SESSION:
            validate_session_filter_condition(filter_condition)
        else:
            validate_span_filter_condition(filter_condition)
    except Exception:
        raise BadRequest("Invalid filter condition: unable to compile for supported databases")


def validate_project_evaluator_sampling_rate(sampling_rate: float) -> None:
    if not 0.0 <= sampling_rate <= 1.0:
        raise BadRequest("samplingRate must be between 0.0 and 1.0")


def materialize_project_evaluator_evaluation_delay(
    evaluation_delay_seconds: Optional[int],
    evaluation_target: EvaluationTarget,
) -> int:
    """Default omitted delays and validate explicit delays; SPAN rejects explicit delays."""
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


def validate_project_evaluator_target_update(
    project_evaluator: models.ProjectEvaluator,
    evaluation_target: EvaluationTarget,
) -> None:
    if project_evaluator.evaluation_target == evaluation_target.value:
        return
    raise BadRequest("evaluationTarget is fixed at project evaluator creation")


async def garbage_collect_evaluators(
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


def parse_evaluator_id(global_id: GlobalID) -> tuple[int, EvaluatorKind]:
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
