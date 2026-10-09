"""Shared evaluator validation, naming, and cleanup helpers."""

from secrets import token_hex
from typing import Callable, Optional

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.models import (
    DEFAULT_EVALUATION_DELAY_SECONDS,
    MINIMUM_EVALUATION_DELAY_SECONDS,
    EvaluatorKind,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.code_evaluator_schema import (
    infer_python_evaluate_input_schema,
    infer_typescript_evaluate_input_schema,
)
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.sandbox import SANDBOX_ADAPTERS
from phoenix.server.sandbox.types import SandboxRuntimeContext, SandboxValidationUnavailable
from phoenix.server.session_filters import validate_session_filter_condition
from phoenix.server.trace_filters import validate_trace_filter_condition
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.filter import validate_span_filter_condition

_EVALUATOR_KIND_BY_TYPENAME: dict[str, EvaluatorKind] = {
    "LLMEvaluator": "LLM",
    "CodeEvaluator": "CODE",
    "BuiltInEvaluator": "BUILTIN",
}


async def is_sole_evaluator_binding(
    session: AsyncSession,
    evaluator_id: int,
) -> bool:
    """Whether the evaluator has exactly one binding across both binding tables."""
    # Preserve existing UI behavior: a sole-binding rename also renames its definition.
    # This check is best effort; a concurrent attachment may still see the new name.
    # CODE renames accept that race to avoid extra locks and lock-order complexity.
    dataset_binding_count = (
        select(func.count())
        .select_from(models.DatasetEvaluators)
        .where(models.DatasetEvaluators.evaluator_id == evaluator_id)
        .scalar_subquery()
    )
    project_binding_count = (
        select(func.count())
        .select_from(models.ProjectEvaluator)
        .where(models.ProjectEvaluator.evaluator_id == evaluator_id)
        .scalar_subquery()
    )
    binding_count = await session.scalar(select(dataset_binding_count + project_binding_count))
    return binding_count == 1


def raise_on_uninferable_evaluate_signature(
    source_code: str, language: models.LanguageName
) -> None:
    if language == "PYTHON":
        _, error_message = infer_python_evaluate_input_schema(source_code)
    elif language == "TYPESCRIPT":
        _, error_message = infer_typescript_evaluate_input_schema(source_code)
    else:
        error_message = f"Unsupported code evaluator language: {language}"
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
    try:
        sandbox_config_id = from_global_id_with_expected_type(
            sandbox_config_global_id, "SandboxConfig"
        )
    except ValueError:
        raise BadRequest(f"Invalid sandbox config id: {sandbox_config_global_id}")
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
            raise NotFound(f"Sandbox config not found: {sandbox_config_global_id}")
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


async def release_evaluator_prompt_label(session: AsyncSession, prompt_id: int) -> None:
    """Remove the "evaluator" label from a prompt that no LLM evaluator references anymore."""
    if await session.scalar(
        select(models.LLMEvaluator.id).where(models.LLMEvaluator.prompt_id == prompt_id).limit(1)
    ):
        return
    await session.execute(
        delete(models.PromptPromptLabel).where(
            models.PromptPromptLabel.prompt_id == prompt_id,
            models.PromptPromptLabel.prompt_label_id.in_(
                select(models.PromptLabel.id).where(models.PromptLabel.name == "evaluator")
            ),
        )
    )


async def release_llm_evaluator_prompt(
    session: AsyncSession,
    *,
    prompt_version_tag_id: Optional[int],
    prompt_id: int,
) -> None:
    """Delete the tag a removed LLM evaluator owned and drop its prompt's "evaluator" label.

    Call this once the evaluator row itself is gone: the tag's ON DELETE RESTRICT FK from
    llm_evaluators only allows deleting the tag in that order. Both this and the label removal
    are no-ops when the prompt was deleted too (a prompt's delete cascades to its tags, and
    there is no prompt left to un-label), so the caller doesn't need to track that separately.
    """
    if prompt_version_tag_id is not None:
        await session.execute(
            delete(models.PromptVersionTag).where(
                models.PromptVersionTag.id == prompt_version_tag_id,
                ~select(models.LLMEvaluator.id)
                .where(models.LLMEvaluator.prompt_version_tag_id == models.PromptVersionTag.id)
                .exists(),
            )
        )
    if await session.get(models.Prompt, prompt_id) is not None:
        await release_evaluator_prompt_label(session, prompt_id)


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
    evaluation_target: models.EvaluationTarget,
) -> None:
    """Compile the filter with the DSL of the target it selects: span, trace, or session."""
    validate: Callable[[str], object]
    if evaluation_target == "SPAN":
        validate = validate_span_filter_condition
    elif evaluation_target == "SESSION":
        validate = validate_session_filter_condition
    elif evaluation_target == "TRACE":
        validate = validate_trace_filter_condition
    else:
        assert_never(evaluation_target)
    try:
        validate(filter_condition)
    except Exception:
        raise BadRequest("Invalid filter condition: unable to compile for supported databases")


def validate_project_evaluator_sampling_rate(sampling_rate: float) -> None:
    if not 0.0 <= sampling_rate <= 1.0:
        raise BadRequest("The sampling rate must be between 0 and 1")


def materialize_project_evaluator_evaluation_delay(
    evaluation_delay_seconds: Optional[int],
    evaluation_target: models.EvaluationTarget,
) -> int:
    """Default omitted delays and validate explicit delays; SPAN rejects explicit delays."""
    if evaluation_delay_seconds is None:
        return 0 if evaluation_target == "SPAN" else DEFAULT_EVALUATION_DELAY_SECONDS
    if evaluation_target == "SPAN":
        raise BadRequest(
            "An evaluation delay is not accepted for SPAN evaluators: span scheduling "
            "does not honor an evaluation delay"
        )
    if evaluation_delay_seconds < MINIMUM_EVALUATION_DELAY_SECONDS:
        raise BadRequest(
            f"The evaluation delay must be at least {MINIMUM_EVALUATION_DELAY_SECONDS} seconds"
        )
    return evaluation_delay_seconds


def validate_project_evaluator_target_update(
    project_evaluator: models.ProjectEvaluator,
    evaluation_target: models.EvaluationTarget,
) -> None:
    if project_evaluator.evaluation_target == evaluation_target:
        return
    raise BadRequest("The evaluation target is fixed when the project evaluator is created")


async def garbage_collect_evaluators(
    session: AsyncSession,
    *,
    evaluator_ids: set[int],
    prompt_ids: set[int],
    delete_associated_prompt: bool,
) -> None:
    deleted_ids: set[int] = set()
    llm_evaluator_prompts: dict[int, tuple[Optional[int], int]] = {}
    if evaluator_ids:
        # Read the LLM evaluators' tag and prompt before deleting: once a row is gone there is
        # nothing left to join it against. RETURNING then reports only the evaluators this
        # delete actually removed, so a binding added between this read and that delete (which
        # keeps the row) can't be cleaned up as if it were unbound.
        llm_evaluator_prompts = {
            row.id: (row.prompt_version_tag_id, row.prompt_id)
            for row in await session.execute(
                select(
                    models.LLMEvaluator.id,
                    models.LLMEvaluator.prompt_version_tag_id,
                    models.LLMEvaluator.prompt_id,
                ).where(models.LLMEvaluator.id.in_(evaluator_ids))
            )
        }
        deleted_ids = set(
            await session.scalars(
                delete(models.Evaluator)
                .where(
                    models.Evaluator.id.in_(evaluator_ids),
                    ~select(models.DatasetEvaluators.id)
                    .where(models.DatasetEvaluators.evaluator_id == models.Evaluator.id)
                    .exists(),
                    ~select(models.ProjectEvaluator.id)
                    .where(models.ProjectEvaluator.evaluator_id == models.Evaluator.id)
                    .exists(),
                )
                .returning(models.Evaluator.id)
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
    for evaluator_id in deleted_ids:
        if (prompt_info := llm_evaluator_prompts.get(evaluator_id)) is not None:
            tag_id, prompt_id = prompt_info
            await release_llm_evaluator_prompt(
                session, prompt_version_tag_id=tag_id, prompt_id=prompt_id
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
