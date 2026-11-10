"""Database resolution and factory functions for evaluator definitions."""

from typing import Callable, Optional, Sequence

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_polymorphic
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import latest_code_evaluator_versions_by_evaluator_id
from phoenix.db.types.annotation_configs import OutputConfigType, as_output_configs
from phoenix.db.types.evaluator_definition import (
    BuiltInEvaluatorDefinition,
    EvaluatorDefinition,
    InlineCodeEvaluatorDefinition,
    InlineDecisionEvaluatorDefinition,
    InlineLLMEvaluatorDefinition,
    StoredCodeEvaluatorDefinition,
    StoredDecisionEvaluatorDefinition,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.decision_clients import resolve_decision_client
from phoenix.server.api.helpers.playground_clients import get_playground_client
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.decisions.validation import validate_questions, validate_template
from phoenix.server.evaluators.runtime.base import BaseEvaluator
from phoenix.server.evaluators.runtime.builtin import (
    BuiltInEvaluator,
    get_builtin_evaluator_by_key,
)
from phoenix.server.evaluators.runtime.code import (
    DEFAULT_PAYLOAD_LIMIT_REMEDIATION,
    CodeEvaluatorRunner,
)
from phoenix.server.evaluators.runtime.decision import DecisionEvaluator
from phoenix.server.evaluators.runtime.llm import LLMEvaluator
from phoenix.server.evaluators.snapshots import (
    capture_decision_evaluator_definition,
    get_decision_evaluator,
    pin_evaluator_definition,
    stored_evaluator_definition,
)
from phoenix.server.sandbox import MissingSecretError, SecretsContext, build_sandbox_backend
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import (
    SandboxBackend,
    SandboxRuntimeContext,
    UnsupportedOperation,
)


async def build_decision_evaluator(
    definition: InlineDecisionEvaluatorDefinition | StoredDecisionEvaluatorDefinition,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Optional[Sequence[GenerativeCredentialInput]] = None,
    max_request_bytes: Optional[int] = None,
) -> DecisionEvaluator:
    """Build a native judge from its saved or frozen definition."""
    if isinstance(definition, StoredDecisionEvaluatorDefinition):
        definition = capture_decision_evaluator_definition(
            await get_decision_evaluator(session, definition.decision_evaluator_id)
        )
    try:
        validate_template(definition.template_format, definition.state, definition.questions)
        validate_questions(definition.questions)
    except ValueError as error:
        raise BadRequest(str(error)) from error
    client = await resolve_decision_client(
        model_provider=definition.model_provider,
        model_name=definition.model_name,
        custom_provider_id=definition.custom_provider_id,
        session=session,
        decrypt=decrypt,
        credentials=credentials,
    )
    return DecisionEvaluator(definition, client, max_request_bytes=max_request_bytes)


async def get_evaluators(
    *,
    dataset_evaluator_ids: Sequence[int],
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    experiment_id: int,
    credentials: Sequence[GenerativeCredentialInput] | None = None,
    sandbox_session_manager: SandboxSessionManager,
    sandbox_runtime: Optional[SandboxRuntimeContext] = None,
) -> list[BaseEvaluator]:
    """
    Build the evaluators for the given DatasetEvaluator row IDs, in the same order.

    The order matters: callers correlate each evaluator with its binding by position.
    Each binding's evaluator is turned into the definition it runs now and built by
    `build_evaluator_from_definition`, so bindings that share an evaluator (e.g. two
    "Contains" bindings with different names) each get their own instance.

    ``experiment_id`` partitions the sandbox session key for code evaluators
    so two concurrent experiments using the same evaluator never converge on
    the same provider sandbox. Intra-experiment reuse still amortizes the
    sandbox warmup across all runs of the same experiment.
    """
    if not dataset_evaluator_ids:
        return []

    # Join subclass tables so BuiltinEvaluator.key / LLM columns are loaded (see with_polymorphic).
    PolymorphicEvaluator = with_polymorphic(
        models.Evaluator,
        [
            models.LLMEvaluator,
            models.CodeEvaluator,
            models.BuiltinEvaluator,
            models.DecisionEvaluator,
        ],
    )
    rows = (
        await session.execute(
            select(models.DatasetEvaluators, PolymorphicEvaluator)
            .join(
                PolymorphicEvaluator,
                models.DatasetEvaluators.evaluator_id == PolymorphicEvaluator.id,
            )
            .where(models.DatasetEvaluators.id.in_(dataset_evaluator_ids))
        )
    ).all()
    bindings_by_id: dict[int, tuple[models.DatasetEvaluators, models.Evaluator]] = {
        binding.id: (binding, evaluator) for binding, evaluator in rows
    }
    for binding_id in dataset_evaluator_ids:
        if binding_id not in bindings_by_id:
            raise NotFound(f"DatasetEvaluator with ID '{binding_id}' not found")

    evaluators: list[BaseEvaluator] = []
    for binding_id in dataset_evaluator_ids:
        binding, evaluator = bindings_by_id[binding_id]
        definition = await pin_evaluator_definition(
            stored_evaluator_definition(
                evaluator,
                name=binding.name.root,
                description=binding.description,
                dataset_evaluator_id=binding.id,
            ),
            session=session,
        )
        evaluators.append(
            await build_evaluator_from_definition(
                definition=definition,
                session=session,
                decrypt=decrypt,
                credentials=credentials,
                sandbox_runtime=sandbox_runtime,
                sandbox_session_manager=sandbox_session_manager,
                session_key=code_evaluator_sandbox_session_key(
                    evaluator=str(evaluator.id),
                    experiment_id=experiment_id,
                    replica_id=sandbox_session_manager.replica_id,
                ),
            )
        )
    return evaluators


def code_evaluator_sandbox_session_key(
    *, evaluator: str, experiment_id: int, replica_id: str
) -> str:
    """The sandbox session key for a code evaluator running in an experiment.

    Partitioned by evaluator, experiment and replica so concurrent runs never converge on
    the same provider sandbox while reuse within one experiment still amortizes. Dataset
    evaluators pass their id; an experiment's own evaluator task passes ``"task"``.
    """
    return f"evaluator:{evaluator}:exp:{experiment_id}:{replica_id}"


async def build_evaluator_from_definition(
    *,
    definition: EvaluatorDefinition,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Sequence[GenerativeCredentialInput] | None = None,
    sandbox_runtime: Optional[SandboxRuntimeContext] = None,
    sandbox_session_manager: Optional[SandboxSessionManager] = None,
    session_key: Optional[str] = None,
    max_message_bytes: Optional[int] = None,
    max_payload_bytes: Optional[int] = None,
    payload_limit_remediation: Optional[str] = None,
    execution_deadline_seconds: Optional[float] = None,
) -> BaseEvaluator:
    """
    Build the runtime evaluator a definition describes.

    Every context constructs its evaluator here from a definition plus its own limits,
    so a preview, an experiment and online evaluation run the same evaluator.

    Args:
        definition: An inline LLM or code evaluator, or a reference to a stored one.
        session: Database session for stored evaluators, sandbox configurations and secrets.
        decrypt: Decrypts stored secrets for model and sandbox credentials.
        credentials: Ephemeral model credentials supplied with the request, if any.
        sandbox_runtime: Runtime context handed to sandbox backends.
        sandbox_session_manager: When given, a code evaluator reuses one sandbox session per
            ``session_key`` instead of creating an ephemeral sandbox for each evaluation.
        session_key: Partitions sandbox sessions; required with a session manager.
        max_message_bytes: Cap on the rendered LLM messages, or None for no cap.
        max_payload_bytes: Cap on the rendered sandbox payload, or None for no cap.
        payload_limit_remediation: What the payload-limit error tells the user to do; it
            names the cap the caller applied, so the caller that sets ``max_payload_bytes``
            sets this too.
        execution_deadline_seconds: The caller's deadline for one evaluation, or None. A
            code evaluator's sandbox and runner timeouts are clamped to finish inside it.

    Raises:
        BadRequest: The definition cannot be honoured: a missing or disabled sandbox
            configuration, a judge prompt version without tools, or a stored evaluator
            that no longer exists.
    """
    if isinstance(
        definition, (InlineDecisionEvaluatorDefinition, StoredDecisionEvaluatorDefinition)
    ):
        return await build_decision_evaluator(
            definition,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
            max_request_bytes=max_message_bytes,
        )
    if isinstance(definition, BuiltInEvaluatorDefinition):
        return await _build_builtin_evaluator(definition, session=session)
    if isinstance(definition, InlineLLMEvaluatorDefinition):
        return await _build_inline_llm_evaluator(
            definition,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
            max_message_bytes=max_message_bytes,
        )
    if isinstance(definition, (StoredCodeEvaluatorDefinition, InlineCodeEvaluatorDefinition)):
        return await _build_code_evaluator(
            definition,
            session=session,
            decrypt=decrypt,
            sandbox_runtime=sandbox_runtime,
            sandbox_session_manager=sandbox_session_manager,
            session_key=session_key,
            max_payload_bytes=max_payload_bytes,
            payload_limit_remediation=payload_limit_remediation,
            execution_deadline_seconds=execution_deadline_seconds,
        )
    assert_never(definition)


async def _build_builtin_evaluator(
    definition: BuiltInEvaluatorDefinition,
    *,
    session: AsyncSession,
) -> BuiltInEvaluator:
    record = await session.get(models.BuiltinEvaluator, definition.builtin_evaluator_id)
    if record is None:
        raise BadRequest(f"Built-in evaluator with id {definition.builtin_evaluator_id} not found")
    evaluator_class = get_builtin_evaluator_by_key(record.key)
    if evaluator_class is None:
        raise BadRequest(f"Built-in evaluator class for key '{record.key}' not found")
    return evaluator_class()


async def _build_inline_llm_evaluator(
    definition: InlineLLMEvaluatorDefinition,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Sequence[GenerativeCredentialInput] | None,
    max_message_bytes: Optional[int],
) -> LLMEvaluator:
    prompt_version = definition.prompt_version
    llm_client = await get_playground_client(
        model_provider=prompt_version.model_provider,
        model_name=prompt_version.model_name,
        session=session,
        decrypt=decrypt,
        credentials=credentials,
        connection=prompt_version.custom_provider_id,
    )
    tools = prompt_version.tools
    if tools is None:
        raise BadRequest("Evaluator prompts require tools")
    return LLMEvaluator(
        name=definition.name,
        description=definition.description,
        template=prompt_version.template,
        template_format=prompt_version.template_format,
        tools=tools,
        invocation_parameters=prompt_version.invocation_parameters,
        model_provider=prompt_version.model_provider,
        llm_client=llm_client,
        output_configs=definition.output_configs,
        prompt_name=definition.name,
        max_message_bytes=max_message_bytes,
    )


async def _build_code_evaluator(
    definition: StoredCodeEvaluatorDefinition | InlineCodeEvaluatorDefinition,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    sandbox_runtime: Optional[SandboxRuntimeContext],
    sandbox_session_manager: Optional[SandboxSessionManager],
    session_key: Optional[str],
    max_payload_bytes: Optional[int],
    payload_limit_remediation: Optional[str],
    execution_deadline_seconds: Optional[float],
) -> CodeEvaluatorRunner:
    evaluator_version_id: Optional[str] = None
    if isinstance(definition, StoredCodeEvaluatorDefinition):
        record, version = await _stored_code_evaluator_version(definition, session=session)
        name = record.name.root
        description = record.description
        source_code = version.source_code
        output_configs: Sequence[OutputConfigType] = as_output_configs(record.output_configs)
        language = definition.language or record.language
        sandbox_config_id = definition.sandbox_config_id or record.sandbox_config_id
        evaluator_version_id = str(GlobalID("CodeEvaluatorVersion", str(version.id)))
        if sandbox_config_id is None:
            raise BadRequest(
                f"Code evaluator '{name}' has no sandbox backend configured"
                f" for language '{language}'. "
                "Please configure a sandbox provider at /settings/sandboxes."
            )
    else:
        name = definition.name
        description = definition.description
        source_code = definition.source_code
        output_configs = definition.output_configs
        language = definition.language
        sandbox_config_id = definition.sandbox_config_id
    sandbox_backend, sandbox_timeout = await _resolve_sandbox_backend(
        session=session,
        sandbox_config_id=sandbox_config_id,
        language=language,
        decrypt=decrypt,
        sandbox_runtime=sandbox_runtime,
    )
    timeout = sandbox_timeout
    runner_timeout: Optional[float] = None
    if execution_deadline_seconds is not None:
        timeout = min(sandbox_timeout, max(1, int(execution_deadline_seconds * 0.9)))
        runner_timeout = min(execution_deadline_seconds * 0.95, timeout + max(1.0, timeout * 0.05))
    return CodeEvaluatorRunner(
        name=name,
        description=description,
        source_code=source_code,
        stored_output_configs=output_configs,
        sandbox_backend=sandbox_backend,
        language=language,
        timeout=timeout,
        runner_timeout=runner_timeout,
        evaluator_version_id=evaluator_version_id,
        sandbox_session_manager=sandbox_session_manager,
        session_key=session_key,
        max_payload_bytes=max_payload_bytes,
        payload_limit_remediation=(payload_limit_remediation or DEFAULT_PAYLOAD_LIMIT_REMEDIATION),
    )


async def _stored_code_evaluator_version(
    definition: StoredCodeEvaluatorDefinition, *, session: AsyncSession
) -> tuple[models.CodeEvaluator, models.CodeEvaluatorVersion]:
    """The stored code evaluator and the version a definition runs: its pinned one, or the
    current one when unpinned."""
    record = await session.get(models.CodeEvaluator, definition.code_evaluator_id)
    if record is None:
        raise BadRequest(f"Code evaluator with id {definition.code_evaluator_id} not found")
    if definition.code_evaluator_version_id is not None:
        version = await session.get(
            models.CodeEvaluatorVersion, definition.code_evaluator_version_id
        )
        if version is None or version.code_evaluator_id != record.id:
            raise BadRequest(
                f"Code evaluator version with id {definition.code_evaluator_version_id} "
                f"not found for code evaluator {record.id}"
            )
        return record, version
    latest = (await latest_code_evaluator_versions_by_evaluator_id([record.id], session)).get(
        record.id
    )
    if latest is None:
        raise BadRequest(
            f"Code evaluator with id {definition.code_evaluator_id} has no current version"
        )
    return record, latest


async def _resolve_sandbox_backend(
    *,
    session: AsyncSession,
    sandbox_config_id: int,
    language: str,
    decrypt: Callable[[bytes], bytes],
    sandbox_runtime: Optional[SandboxRuntimeContext],
) -> tuple[SandboxBackend, int]:
    """Return the backend and timeout of an enabled sandbox configuration for a language."""
    sandbox_config = await session.get(models.SandboxConfig, sandbox_config_id)
    if sandbox_config is None:
        raise BadRequest(f"Sandbox configuration with id {sandbox_config_id} was not found")
    if not sandbox_config.enabled:
        raise BadRequest(
            f"Sandbox configuration '{sandbox_config.name}' is disabled. "
            "Enable it before testing this evaluator."
        )
    provider = await session.scalar(
        select(models.SandboxProvider).where(
            models.SandboxProvider.backend_type == sandbox_config.backend_type
        )
    )
    if provider is None:
        raise BadRequest(
            f"Sandbox provider for configuration '{sandbox_config.name}' was not found"
        )
    if not provider.enabled:
        raise BadRequest(
            f"Sandbox provider '{provider.backend_type}' is disabled. "
            "Enable it before testing this evaluator."
        )
    if sandbox_config.language != language:
        raise BadRequest("Sandbox provider language does not match code evaluator language")
    try:
        sandbox_backend = await build_sandbox_backend(
            sandbox_config,
            secrets=SecretsContext(session=session, decrypt=decrypt),
            runtime=sandbox_runtime,
        )
    except (
        MissingSecretError,
        UnsupportedOperation,
        PydanticValidationError,
        ValueError,
    ) as error:
        raise BadRequest(str(error))
    if sandbox_backend is None:
        raise BadRequest(
            f"Sandbox backend '{provider.backend_type}' is unavailable for language "
            f"'{language}'. Ensure the backend is installed and configured."
        )
    return sandbox_backend, sandbox_config.timeout
