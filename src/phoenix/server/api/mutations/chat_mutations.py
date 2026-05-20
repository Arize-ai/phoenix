import logging
from typing import Any, Optional, cast

import strawberry
from pydantic import ValidationError
from sqlalchemy import select
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
)
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    CodeEvaluatorRunner,
    create_llm_evaluator_from_inline,
    get_builtin_evaluator_by_key,
)
from phoenix.server.api.evaluators import (
    EvaluationResult as EvaluationResultDict,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.evaluators import (
    validate_evaluator_prompt_and_configs,
)
from phoenix.server.api.helpers.playground_clients import (
    get_playground_client,
    initialize_playground_clients,
)
from phoenix.server.api.input_types.EvaluatorPreviewInput import (
    EvaluatorPreviewsInput,
)
from phoenix.server.api.mutations.evaluator_mutations import (
    _convert_output_config_inputs_to_pydantic,
)
from phoenix.server.api.types.Evaluator import BuiltInEvaluator, CodeEvaluator
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.SandboxConfig import SandboxConfig
from phoenix.server.api.types.Trace import Trace
from phoenix.server.sandbox import (
    MissingSecretError,
    SecretsContext,
    build_sandbox_backend,
)
from phoenix.server.sandbox.types import UnsupportedOperation

logger = logging.getLogger(__name__)

initialize_playground_clients()


@strawberry.type
class EvaluationResult:
    evaluator_name: str
    annotation: Optional[ExperimentRunAnnotation] = None
    trace: Optional[Trace] = None
    error: Optional[str] = None


@strawberry.type
class EvaluatorPreviewsPayload:
    results: list[EvaluationResult]


def _to_annotation(eval_result: EvaluationResultDict) -> ExperimentRunAnnotation:
    return ExperimentRunAnnotation.from_dict(
        {
            "name": eval_result["name"],
            "annotator_kind": eval_result["annotator_kind"],
            "label": eval_result["label"],
            "score": eval_result["score"],
            "explanation": eval_result["explanation"],
            "error": eval_result["error"],
            "metadata": eval_result["metadata"],
            "start_time": eval_result["start_time"],
            "end_time": eval_result["end_time"],
            "trace_id": eval_result["trace_id"],
        }
    )


def _to_evaluation_result(
    eval_result: EvaluationResultDict,
    evaluator_name: str,
    trace: Optional[Trace] = None,
) -> EvaluationResult:
    if eval_result["error"] is not None:
        return EvaluationResult(
            evaluator_name=evaluator_name,
            error=eval_result["error"],
            trace=trace,
        )
    return EvaluationResult(
        evaluator_name=evaluator_name,
        annotation=_to_annotation(eval_result),
        trace=trace,
    )


async def _resolve_inline_code_evaluator_backend(
    *,
    info: Info[Context, None],
    sandbox_config_id: Optional[strawberry.relay.GlobalID],
    language: str,
) -> tuple[Any, Optional[int]]:
    if sandbox_config_id is None:
        raise BadRequest(
            f"No sandbox configuration selected for language '{language}'. "
            "Choose a sandbox configuration before testing this evaluator."
        )

    try:
        sandbox_config_db_id = from_global_id_with_expected_type(
            sandbox_config_id, SandboxConfig.__name__
        )
    except ValueError as exc:
        raise BadRequest(str(exc))

    async with info.context.db() as session:
        sandbox_cfg = await session.get(models.SandboxConfig, sandbox_config_db_id)
        if sandbox_cfg is None:
            raise BadRequest(f"Sandbox configuration with id {sandbox_config_id} was not found")
        if not sandbox_cfg.enabled:
            raise BadRequest(
                (
                    f"Sandbox configuration '{sandbox_cfg.name}' is disabled. Enable it before "
                    "testing this evaluator."
                )
            )

        sandbox_timeout = sandbox_cfg.timeout
        provider = await session.scalar(
            select(models.SandboxProvider).where(
                models.SandboxProvider.backend_type == sandbox_cfg.backend_type
            )
        )
        if provider is None:
            raise BadRequest(
                f"Sandbox provider for configuration '{sandbox_cfg.name}' was not found"
            )
        if not provider.enabled:
            raise BadRequest(
                (
                    f"Sandbox provider '{provider.backend_type}' is disabled. Enable it before "
                    "testing this evaluator."
                )
            )

        if sandbox_cfg.language != language:
            raise BadRequest("Sandbox provider language does not match code evaluator language")

        try:
            sandbox_backend = await build_sandbox_backend(
                sandbox_cfg,
                secrets=SecretsContext(session=session, decrypt=info.context.decrypt),
            )
        except (
            MissingSecretError,
            UnsupportedOperation,
            ValidationError,
            ValueError,
        ) as exc:
            raise BadRequest(str(exc))

    if sandbox_backend is None:
        raise BadRequest(
            f"Sandbox backend '{provider.backend_type}' is unavailable for language '{language}'. "
            "Ensure the backend is installed and configured."
        )

    return sandbox_backend, sandbox_timeout


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    @classmethod
    async def evaluator_previews(
        cls, info: Info[Context, None], input: EvaluatorPreviewsInput
    ) -> EvaluatorPreviewsPayload:
        all_results: list[EvaluationResult] = []

        for preview_item in input.previews:
            evaluator_input = preview_item.evaluator
            context = cast(dict[str, Any], preview_item.context)
            input_mapping = preview_item.input_mapping

            if evaluator_id := evaluator_input.built_in_evaluator_id:
                type_name, db_id = from_global_id(evaluator_id)

                if type_name != BuiltInEvaluator.__name__:
                    raise BadRequest(f"Expected built-in evaluator, got {type_name}")

                # Look up the builtin evaluator key from the database
                async with info.context.db() as session:
                    builtin_evaluator_record = await session.get(models.BuiltinEvaluator, db_id)
                if builtin_evaluator_record is None:
                    raise BadRequest(f"Built-in evaluator with id {evaluator_id} not found")

                builtin_evaluator_cls = get_builtin_evaluator_by_key(builtin_evaluator_record.key)
                if builtin_evaluator_cls is None:
                    key = builtin_evaluator_record.key
                    raise BadRequest(f"Built-in evaluator class for key '{key}' not found")
                builtin_evaluator = builtin_evaluator_cls()

                eval_results = await builtin_evaluator.evaluate(
                    context=context,
                    input_mapping=input_mapping.to_orm(),
                    name=builtin_evaluator.name,
                    output_configs=builtin_evaluator.output_configs,
                )
                for eval_result in eval_results:
                    all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))
            elif inline_llm_evaluator := evaluator_input.inline_llm_evaluator:
                prompt_version = inline_llm_evaluator.prompt_version
                async with info.context.db() as session:
                    llm_client = await get_playground_client(
                        model_provider=prompt_version.model_provider.to_model_provider(),
                        model_name=prompt_version.model_name,
                        session=session,
                        decrypt=info.context.decrypt,
                        credentials=input.credentials,
                        connection=prompt_version.resolved_custom_provider_id,
                    )
                try:
                    prompt_version_orm = inline_llm_evaluator.prompt_version.to_orm_prompt_version(
                        user_id=None
                    )
                except ValidationError as error:
                    raise BadRequest(str(error))

                all_configs = _convert_output_config_inputs_to_pydantic(
                    inline_llm_evaluator.output_configs
                )
                categorical_configs: list[CategoricalOutputConfig] = []
                for config in all_configs:
                    if not isinstance(config, CategoricalOutputConfig):
                        raise BadRequest(
                            "Only categorical annotation configs "
                            "are supported for LLM evaluator previews"
                        )
                    categorical_configs.append(config)

                evaluator = create_llm_evaluator_from_inline(
                    prompt_version_orm=prompt_version_orm,
                    llm_client=llm_client,
                    output_configs=categorical_configs,
                    name=inline_llm_evaluator.name,
                    description=inline_llm_evaluator.description,
                )

                try:
                    validate_evaluator_prompt_and_configs(
                        prompt_tools=prompt_version_orm.tools,
                        prompt_response_format=prompt_version_orm.response_format,
                        evaluator_output_configs=categorical_configs,
                        evaluator_description=inline_llm_evaluator.description,
                    )
                except ValueError as error:
                    raise BadRequest(str(error))

                eval_results = await evaluator.evaluate(
                    context=context,
                    input_mapping=input_mapping.to_orm(),
                    name=evaluator.name,
                    output_configs=categorical_configs,
                )
                for eval_result in eval_results:
                    all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))

            elif code_evaluator_id := evaluator_input.code_evaluator_id:
                type_name, db_id = from_global_id(code_evaluator_id)
                if type_name != CodeEvaluator.__name__:
                    raise BadRequest(f"Expected code evaluator, got {type_name}")

                code_evaluator_version = (
                    await info.context.data_loaders.latest_code_evaluator_versions.load(db_id)
                )
                if code_evaluator_version is None:
                    raise BadRequest(
                        f"Code evaluator with id {code_evaluator_id} has no current version"
                    )

                async with info.context.db() as session:
                    code_evaluator_record = await session.get(models.CodeEvaluator, db_id)
                    if code_evaluator_record is None:
                        raise BadRequest(f"Code evaluator with id {code_evaluator_id} not found")
                    language = code_evaluator_record.language

                    sandbox_backend = None
                    live_sandbox_config: models.SandboxConfig | None = None
                    sandbox_timeout: int | None = None
                    tip_sandbox_config_id = code_evaluator_record.sandbox_config_id
                    if tip_sandbox_config_id is not None:
                        live_sandbox_config = await session.get(
                            models.SandboxConfig, tip_sandbox_config_id
                        )
                        if live_sandbox_config is None:
                            raise BadRequest(f"SandboxConfig not found: {tip_sandbox_config_id}")
                        if not live_sandbox_config.enabled:
                            raise BadRequest(
                                (
                                    f"Sandbox configuration '{live_sandbox_config.name}' is "
                                    "disabled. Enable it before testing this evaluator."
                                )
                            )
                        live_sandbox_provider = await session.scalar(
                            select(models.SandboxProvider).where(
                                models.SandboxProvider.backend_type
                                == live_sandbox_config.backend_type
                            )
                        )
                        if live_sandbox_provider is None:
                            pk = live_sandbox_config.backend_type
                            raise BadRequest(f"SandboxProvider not found: {pk}")
                        if not live_sandbox_provider.enabled:
                            raise BadRequest(
                                (
                                    f"Sandbox provider '{live_sandbox_provider.backend_type}' is "
                                    "disabled. Enable it before testing this evaluator."
                                )
                            )
                        sandbox_timeout = live_sandbox_config.timeout

                    evaluator_name = code_evaluator_record.name.root
                    evaluator_description = code_evaluator_record.description
                    evaluator_source_code = code_evaluator_version.source_code
                    output_configs = [
                        c
                        for c in code_evaluator_record.output_configs
                        if isinstance(
                            c,
                            (
                                CategoricalOutputConfig,
                                ContinuousOutputConfig,
                                FreeformOutputConfig,
                            ),
                        )
                    ]

                    if live_sandbox_config is not None:
                        try:
                            sandbox_backend = await build_sandbox_backend(
                                live_sandbox_config,
                                secrets=SecretsContext(
                                    session=session, decrypt=info.context.decrypt
                                ),
                            )
                        except (
                            MissingSecretError,
                            UnsupportedOperation,
                            ValidationError,
                            ValueError,
                        ) as exc:
                            raise BadRequest(str(exc))
                if sandbox_backend is None:
                    raise BadRequest(
                        f"Code evaluator '{evaluator_name}' has no sandbox backend configured"
                        f" for language '{language}'. "
                        "Please configure a sandbox provider at /settings/sandboxes."
                    )

                # Test mutation runs are ephemeral by design: each click spins
                # up a fresh sandbox via ``backend.execute``'s own
                # ``async with`` lifecycle and tears it down on exit. The
                # session manager is intentionally bypassed so test cleanup
                # never depends on hitting the same replica on a follow-up
                # request — a property the deprecated ``stopEvaluatorSession``
                # mutation could not deliver under load balancing. No
                # ``session_key`` is supplied because the ephemeral
                # ``backend.execute`` path does not consult it.
                runner = CodeEvaluatorRunner(
                    name=evaluator_name,
                    description=evaluator_description,
                    source_code=evaluator_source_code,
                    stored_output_configs=output_configs,
                    sandbox_backend=sandbox_backend,
                    language=language,
                    timeout=sandbox_timeout,
                    evaluator_version_id=str(
                        GlobalID("CodeEvaluatorVersion", str(code_evaluator_version.id))
                    ),
                    sandbox_session_manager=None,
                )
                eval_results = await runner.evaluate(
                    context=context,
                    input_mapping=input_mapping.to_orm(),
                    name=evaluator_name,
                    output_configs=output_configs,
                )
                for eval_result in eval_results:
                    all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))

            elif inline_code_evaluator := evaluator_input.inline_code_evaluator:
                language = inline_code_evaluator.language.value
                evaluator_name = inline_code_evaluator.name
                evaluator_description = inline_code_evaluator.description
                source_code = inline_code_evaluator.source_code

                output_configs = [
                    c
                    for c in _convert_output_config_inputs_to_pydantic(
                        inline_code_evaluator.output_configs
                    )
                    if isinstance(
                        c,
                        (
                            CategoricalOutputConfig,
                            ContinuousOutputConfig,
                            FreeformOutputConfig,
                        ),
                    )
                ]

                sandbox_backend, sandbox_timeout = await _resolve_inline_code_evaluator_backend(
                    info=info,
                    sandbox_config_id=inline_code_evaluator.sandbox_config_id,
                    language=language,
                )

                # Test mutation runs are ephemeral by design: each click spins
                # up a fresh sandbox via ``backend.execute``'s own
                # ``async with`` lifecycle and tears it down on exit. The
                # session manager is intentionally bypassed so test cleanup
                # never depends on hitting the same replica on a follow-up
                # request — a property the deprecated ``stopEvaluatorSession``
                # mutation could not deliver under load balancing. No
                # ``session_key`` is supplied because the ephemeral
                # ``backend.execute`` path does not consult it.
                runner = CodeEvaluatorRunner(
                    name=evaluator_name,
                    description=evaluator_description,
                    source_code=source_code,
                    stored_output_configs=output_configs,
                    sandbox_backend=sandbox_backend,
                    language=language,
                    timeout=sandbox_timeout,
                    sandbox_session_manager=None,
                )
                eval_results = await runner.evaluate(
                    context=context,
                    input_mapping=input_mapping.to_orm(),
                    name=evaluator_name,
                    output_configs=output_configs,
                )
                for eval_result in eval_results:
                    all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))

            else:
                raise BadRequest("Either evaluator_id or inline evaluator must be provided")

        return EvaluatorPreviewsPayload(results=all_results)
