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
from phoenix.db.types.prompts import PromptChatTemplate
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
from phoenix.server.evaluators.services.prompt_source import resolve_evaluator_prompt_version
from phoenix.server.evaluators.snapshots import (
    capture_decision_evaluator_definition,
    get_decision_evaluator,
)
from phoenix.server.evaluators.validation import validate_evaluator_prompt_and_configs
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


async def _get_llm_evaluators(
    *,
    llm_evaluator_orms: Sequence[models.LLMEvaluator],
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: Sequence[GenerativeCredentialInput] | None = None,
) -> list[LLMEvaluator]:
    """
    Build runtime LLM evaluators from ORM rows already loaded (e.g. via polymorphic join).

    Returns instances in the same order as ``llm_evaluator_orms``.
    """
    if not llm_evaluator_orms:
        return []

    result: list[LLMEvaluator] = []
    for llm_evaluator_orm in llm_evaluator_orms:
        prompt_id = llm_evaluator_orm.prompt_id
        prompt_version = await resolve_evaluator_prompt_version(session, llm_evaluator_orm)
        if prompt_version is None:
            raise NotFound(f"Prompt version not found for LLM evaluator id {llm_evaluator_orm.id}")

        # Get the prompt to access its name
        prompt = await session.get(models.Prompt, prompt_id)
        if prompt is None:
            raise NotFound(f"Prompt not found for LLM evaluator id {llm_evaluator_orm.id}")

        llm_client = await get_playground_client(
            model_provider=prompt_version.model_provider,
            model_name=prompt_version.model_name,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
            connection=prompt_version.custom_provider_id,
        )

        template = prompt_version.template
        assert isinstance(template, PromptChatTemplate)
        tools = prompt_version.tools
        assert tools is not None

        result.append(
            LLMEvaluator(
                name=llm_evaluator_orm.name.root,
                description=llm_evaluator_orm.description,
                template=template,
                template_format=prompt_version.template_format,
                tools=tools,
                invocation_parameters=prompt_version.invocation_parameters,
                model_provider=prompt_version.model_provider,
                llm_client=llm_client,
                output_configs=llm_evaluator_orm.output_configs,
                prompt_name=prompt.name.root,
            )
        )

    return result


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
    Get all evaluators for the given DatasetEvaluator row IDs.

    Returns a list of BaseEvaluator instances in the same order as the input IDs.
    This ordering guarantee is important for correlating evaluators with their inputs.

    For each DatasetEvaluator, resolves to the underlying LLM or BuiltIn evaluator.
    Multiple DatasetEvaluators can reference the same underlying evaluator (e.g., two
    "Contains" evaluators with different names), and this function preserves that
    multiplicity by returning separate evaluator instances for each.

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
    dataset_evaluators_result = (
        await session.execute(
            select(models.DatasetEvaluators, PolymorphicEvaluator)
            .join(
                PolymorphicEvaluator,
                models.DatasetEvaluators.evaluator_id == PolymorphicEvaluator.id,
            )
            .where(models.DatasetEvaluators.id.in_(dataset_evaluator_ids))
        )
    ).all()
    dataset_evaluators_by_id: dict[int, tuple[models.DatasetEvaluators, models.Evaluator]] = {
        de.id: (de, ev) for de, ev in dataset_evaluators_result
    }

    for de_id in dataset_evaluator_ids:
        if de_id not in dataset_evaluators_by_id:
            raise NotFound(f"DatasetEvaluator with ID '{de_id}' not found")

    llm_orm_by_id: dict[int, models.LLMEvaluator] = {}
    code_orm_by_id: dict[int, models.CodeEvaluator] = {}
    for _, ev in dataset_evaluators_result:
        if isinstance(ev, models.LLMEvaluator):
            llm_orm_by_id[ev.id] = ev
        elif isinstance(ev, models.CodeEvaluator):
            code_orm_by_id[ev.id] = ev

    llm_evaluators_by_id: dict[int, LLMEvaluator] = {}
    if llm_orm_by_id:
        llm_evaluator_orms = [llm_orm_by_id[eid] for eid in sorted(llm_orm_by_id)]
        llm_evaluators_list = await _get_llm_evaluators(
            llm_evaluator_orms=llm_evaluator_orms,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
        )
        for llm_evaluator_orm, llm_evaluator in zip(llm_evaluator_orms, llm_evaluators_list):
            llm_evaluators_by_id[llm_evaluator_orm.id] = llm_evaluator

    code_evaluators_by_id: dict[int, CodeEvaluatorRunner] = {}
    code_evaluator_languages_by_id: dict[int, str] = {}
    if code_orm_by_id:
        code_rows = [code_orm_by_id[evaluator_id] for evaluator_id in sorted(code_orm_by_id)]
        latest_versions = await latest_code_evaluator_versions_by_evaluator_id(
            list(code_orm_by_id), session
        )
        tip_sandbox_config_ids = {
            code_row.sandbox_config_id
            for code_row in code_rows
            if code_row.sandbox_config_id is not None
        }
        sandbox_by_config_id: dict[int, tuple[models.SandboxConfig, models.SandboxProvider]] = {}
        if tip_sandbox_config_ids:
            sandbox_rows = await session.execute(
                select(models.SandboxConfig, models.SandboxProvider)
                .join(
                    models.SandboxProvider,
                    models.SandboxProvider.backend_type == models.SandboxConfig.backend_type,
                )
                .where(models.SandboxConfig.id.in_(tip_sandbox_config_ids))
            )
            sandbox_by_config_id = {
                sandbox_config.id: (sandbox_config, sandbox_provider)
                for sandbox_config, sandbox_provider in sandbox_rows
            }
        backend_by_sandbox_key: dict[tuple[str, int], Optional[SandboxBackend]] = {}
        evaluator_base_by_id = {
            evaluator.id: evaluator for _, evaluator in dataset_evaluators_by_id.values()
        }

        for code_row in code_rows:
            code_version = latest_versions.get(code_row.id)
            if code_version is None:
                continue
            evaluator_language = code_row.language
            code_evaluator_languages_by_id[code_row.id] = evaluator_language

            backend = None
            language = evaluator_language
            sandbox_timeout: Optional[int] = None
            tip_sandbox_config_id = code_row.sandbox_config_id
            if tip_sandbox_config_id is not None:
                sandbox_pair = sandbox_by_config_id.get(tip_sandbox_config_id)
                if sandbox_pair is None:
                    raise BadRequest(f"SandboxConfig not found: {tip_sandbox_config_id}")
                live_sandbox_config, live_sandbox_provider = sandbox_pair
                if not live_sandbox_config.enabled:
                    raise BadRequest(
                        (
                            f"Sandbox configuration '{live_sandbox_config.name}' is disabled. "
                            "Enable it before testing this evaluator."
                        )
                    )
                if not live_sandbox_provider.enabled:
                    raise BadRequest(
                        (
                            f"Sandbox provider '{live_sandbox_provider.backend_type}' is disabled. "
                            "Enable it before testing this evaluator."
                        )
                    )
                sandbox_timeout = live_sandbox_config.timeout
                sandbox_key = (live_sandbox_provider.backend_type, live_sandbox_config.id)
                if sandbox_key not in backend_by_sandbox_key:
                    try:
                        backend_by_sandbox_key[sandbox_key] = await build_sandbox_backend(
                            live_sandbox_config,
                            secrets=SecretsContext(session=session, decrypt=decrypt),
                            runtime=sandbox_runtime,
                        )
                    except (
                        MissingSecretError,
                        UnsupportedOperation,
                        PydanticValidationError,
                        ValueError,
                    ) as exc:
                        raise BadRequest(str(exc))
                backend = backend_by_sandbox_key[sandbox_key]

            evaluator_base = evaluator_base_by_id.get(code_row.id)
            eval_name = evaluator_base.name.root if evaluator_base else str(code_row.id)
            eval_description = evaluator_base.description if evaluator_base else None

            if backend is not None:
                output_cfgs: list[OutputConfigType] = as_output_configs(code_row.output_configs)
                runner = CodeEvaluatorRunner(
                    name=eval_name,
                    description=eval_description,
                    source_code=code_version.source_code,
                    stored_output_configs=output_cfgs,
                    sandbox_backend=backend,
                    language=language,
                    timeout=sandbox_timeout,
                    evaluator_version_id=str(
                        GlobalID("CodeEvaluatorVersion", str(code_version.id))
                    ),
                    session_key=code_evaluator_sandbox_session_key(
                        evaluator=str(code_row.id),
                        experiment_id=experiment_id,
                        replica_id=sandbox_session_manager.replica_id,
                    ),
                    sandbox_session_manager=sandbox_session_manager,
                )
                code_evaluators_by_id[code_row.id] = runner

    evaluators: list[BaseEvaluator] = []
    for de_id in dataset_evaluator_ids:
        de, ev = dataset_evaluators_by_id[de_id]
        if isinstance(ev, models.LLMEvaluator):
            resolved = llm_evaluators_by_id.get(ev.id)
            if resolved is None:
                raise NotFound(f"LLM evaluator with ID '{ev.id}' not found")
            evaluators.append(resolved)
        elif isinstance(ev, models.BuiltinEvaluator):
            builtin_evaluator_cls = get_builtin_evaluator_by_key(ev.key)
            if builtin_evaluator_cls is None:
                raise NotFound(f"Built-in evaluator with key '{ev.key}' not found in registry")
            evaluators.append(builtin_evaluator_cls())
        elif isinstance(ev, models.CodeEvaluator):
            code_runner = code_evaluators_by_id.get(ev.id)
            if code_runner is None:
                ev_name = ev.name.root if ev.name else str(ev.id)
                evaluator_lang = code_evaluator_languages_by_id.get(ev.id, "")
                lang_hint = f" for language '{evaluator_lang}'" if evaluator_lang else ""
                raise NotFound(
                    f"Code evaluator '{ev_name}' could not be resolved{lang_hint}. "
                    "Please configure a sandbox provider at /settings/sandboxes."
                )
            evaluators.append(code_runner)
        elif isinstance(ev, models.DecisionEvaluator):
            definition = capture_decision_evaluator_definition(
                ev,
                name=de.name.root,
                description=de.description,
                dataset_evaluator_id=de.id,
            )
            evaluators.append(
                await build_decision_evaluator(
                    definition, session=session, decrypt=decrypt, credentials=credentials
                )
            )
        else:
            raise BadRequest(
                f"DatasetEvaluator '{de_id}' references evaluator with unsupported kind: {ev.kind}"
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
) -> BaseEvaluator:
    """
    Build the runtime evaluator a definition describes.

    Evaluator previews and experiment evaluator tasks both construct their evaluator here,
    so a preview exercises the evaluator that an experiment will run.

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

    Raises:
        BadRequest: The definition cannot be honoured: a missing or disabled sandbox
            configuration, a judge prompt whose tools do not match its output configs,
            or a stored evaluator that no longer exists.
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
    if isinstance(definition, StoredCodeEvaluatorDefinition):
        return await _build_stored_code_evaluator(
            definition,
            session=session,
            decrypt=decrypt,
            sandbox_runtime=sandbox_runtime,
            sandbox_session_manager=sandbox_session_manager,
            session_key=session_key,
            max_payload_bytes=max_payload_bytes,
            payload_limit_remediation=payload_limit_remediation,
        )
    if isinstance(definition, InlineCodeEvaluatorDefinition):
        return await _build_inline_code_evaluator(
            definition,
            session=session,
            decrypt=decrypt,
            sandbox_runtime=sandbox_runtime,
            sandbox_session_manager=sandbox_session_manager,
            session_key=session_key,
            max_payload_bytes=max_payload_bytes,
            payload_limit_remediation=payload_limit_remediation,
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
    try:
        validate_evaluator_prompt_and_configs(
            prompt_tools=prompt_version.tools,
            prompt_response_format=prompt_version.response_format,
            evaluator_output_configs=list(definition.output_configs),
            evaluator_description=definition.description,
        )
    except ValueError as error:
        raise BadRequest(str(error))
    tools = prompt_version.tools
    assert tools is not None  # the validation above requires tools
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


async def _build_stored_code_evaluator(
    definition: StoredCodeEvaluatorDefinition,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    sandbox_runtime: Optional[SandboxRuntimeContext],
    sandbox_session_manager: Optional[SandboxSessionManager],
    session_key: Optional[str],
    max_payload_bytes: Optional[int],
    payload_limit_remediation: Optional[str],
) -> CodeEvaluatorRunner:
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
    else:
        latest_versions = await latest_code_evaluator_versions_by_evaluator_id([record.id], session)
        latest = latest_versions.get(record.id)
        if latest is None:
            raise BadRequest(
                f"Code evaluator with id {definition.code_evaluator_id} has no current version"
            )
        version = latest
    evaluator_name = record.name.root
    language = definition.language or record.language
    sandbox_config_id = definition.sandbox_config_id or record.sandbox_config_id
    if sandbox_config_id is None:
        raise BadRequest(
            f"Code evaluator '{evaluator_name}' has no sandbox backend configured"
            f" for language '{language}'. "
            "Please configure a sandbox provider at /settings/sandboxes."
        )
    sandbox_backend, sandbox_timeout = await _resolve_sandbox_backend(
        session=session,
        sandbox_config_id=sandbox_config_id,
        language=language,
        decrypt=decrypt,
        sandbox_runtime=sandbox_runtime,
    )
    return CodeEvaluatorRunner(
        name=evaluator_name,
        description=record.description,
        source_code=version.source_code,
        stored_output_configs=as_output_configs(record.output_configs),
        sandbox_backend=sandbox_backend,
        language=language,
        timeout=sandbox_timeout,
        evaluator_version_id=str(GlobalID("CodeEvaluatorVersion", str(version.id))),
        sandbox_session_manager=sandbox_session_manager,
        session_key=session_key,
        max_payload_bytes=max_payload_bytes,
        payload_limit_remediation=(payload_limit_remediation or DEFAULT_PAYLOAD_LIMIT_REMEDIATION),
    )


async def _build_inline_code_evaluator(
    definition: InlineCodeEvaluatorDefinition,
    *,
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    sandbox_runtime: Optional[SandboxRuntimeContext],
    sandbox_session_manager: Optional[SandboxSessionManager],
    session_key: Optional[str],
    max_payload_bytes: Optional[int],
    payload_limit_remediation: Optional[str],
) -> CodeEvaluatorRunner:
    sandbox_backend, sandbox_timeout = await _resolve_sandbox_backend(
        session=session,
        sandbox_config_id=definition.sandbox_config_id,
        language=definition.language,
        decrypt=decrypt,
        sandbox_runtime=sandbox_runtime,
    )
    return CodeEvaluatorRunner(
        name=definition.name,
        description=definition.description,
        source_code=definition.source_code,
        stored_output_configs=definition.output_configs,
        sandbox_backend=sandbox_backend,
        language=definition.language,
        timeout=sandbox_timeout,
        sandbox_session_manager=sandbox_session_manager,
        session_key=session_key,
        max_payload_bytes=max_payload_bytes,
        payload_limit_remediation=(payload_limit_remediation or DEFAULT_PAYLOAD_LIMIT_REMEDIATION),
    )


async def _resolve_sandbox_backend(
    *,
    session: AsyncSession,
    sandbox_config_id: int,
    language: str,
    decrypt: Callable[[bytes], bytes],
    sandbox_runtime: Optional[SandboxRuntimeContext],
) -> tuple[SandboxBackend, Optional[int]]:
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
