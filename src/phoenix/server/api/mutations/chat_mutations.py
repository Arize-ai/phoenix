import logging
from typing import Any, Optional, cast

import strawberry
from pydantic import ValidationError
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalOutputConfig,
    ContinuousOutputConfig,
)
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    EvaluationResult as EvaluationResultDict,
)
from phoenix.server.api.evaluators import (
    create_llm_evaluator_from_inline,
    get_builtin_evaluator_by_key,
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
    from phoenix.server.sandbox import MissingSecretError, get_or_create_backend
    from phoenix.server.sandbox.types import UnsupportedOperation

    if sandbox_config_id is None:
        raise BadRequest(
            f"No sandbox configuration selected for language '{language}'. "
            "Choose a sandbox configuration before testing this evaluator."
        )

    sandbox_config_db_id = from_global_id_with_expected_type(
        sandbox_config_id, SandboxConfig.__name__
    )

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
        provider = await session.get(models.SandboxProvider, sandbox_cfg.sandbox_provider_id)
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

        provider_language_row = await session.get(models.Language, provider.language_id)
        if provider_language_row is not None and provider_language_row.name != language:
            raise BadRequest("Sandbox provider language does not match code evaluator language")

        # Admin-authored provider config wins over user-authored
        # SandboxConfig.config on key collision — consistent with
        # the factory's credentials-win merge order.
        merged_config = {
            **sandbox_cfg.config,
            **provider.config,
        }
        backend_type = provider.backend_type
        try:
            sandbox_backend = await get_or_create_backend(
                backend_type,
                config=merged_config,
                session=session,
                decrypt=info.context.decrypt,
            )
        except (
            MissingSecretError,
            UnsupportedOperation,
            ValidationError,
        ) as exc:
            raise BadRequest(str(exc))

    if sandbox_backend is None:
        raise BadRequest(
            f"Sandbox backend '{backend_type}' is unavailable for language '{language}'. "
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

                from phoenix.server.api.evaluators import CodeEvaluatorRunner
                from phoenix.server.sandbox import MissingSecretError, get_or_create_backend
                from phoenix.server.sandbox.types import UnsupportedOperation

                async with info.context.db() as session:
                    code_evaluator_record = await session.get(models.CodeEvaluator, db_id)
                    if code_evaluator_record is None:
                        raise BadRequest(f"Code evaluator with id {code_evaluator_id} not found")

                    # Resolve language within session to avoid DetachedInstanceError
                    language_row = await session.get(
                        models.Language, code_evaluator_record.language_id
                    )
                    if language_row is None:
                        raise ValueError(
                            f"Language with id {code_evaluator_record.language_id} "
                            "not found in languages table"
                        )
                    language = language_row.name

                    # Resolve sandbox backend via config -> provider chain
                    sandbox_backend = None
                    backend_type: str | None = None
                    merged_config: dict[str, Any] | None = None
                    sandbox_timeout: int | None = None
                    if code_evaluator_record.sandbox_config_id is not None:
                        sandbox_cfg = await session.get(
                            models.SandboxConfig, code_evaluator_record.sandbox_config_id
                        )
                        if sandbox_cfg is not None and sandbox_cfg.enabled:
                            sandbox_timeout = sandbox_cfg.timeout
                            provider = await session.get(
                                models.SandboxProvider, sandbox_cfg.sandbox_provider_id
                            )
                            if provider is not None and provider.enabled:
                                backend_type = provider.backend_type
                                if (
                                    code_evaluator_record.language_id is not None
                                    and provider.language_id != code_evaluator_record.language_id
                                ):
                                    raise BadRequest(
                                        "Sandbox provider language does not match "
                                        "code evaluator language"
                                    )
                                # Admin-authored provider config wins over user-authored
                                # SandboxConfig.config on key collision — consistent with
                                # the factory's credentials-win merge order.
                                merged_config = {
                                    **sandbox_cfg.config,
                                    **provider.config,
                                }

                    # Eagerly capture scalar fields before session closes
                    evaluator_name = str(code_evaluator_record.name)
                    evaluator_description = code_evaluator_record.description
                    evaluator_source_code = code_evaluator_record.source_code
                    output_configs = [
                        c
                        for c in code_evaluator_record.output_configs
                        if isinstance(c, (CategoricalOutputConfig, ContinuousOutputConfig))
                    ]

                    if backend_type is not None:
                        try:
                            sandbox_backend = await get_or_create_backend(
                                backend_type,
                                config=merged_config,
                                session=session,
                                decrypt=info.context.decrypt,
                            )
                        except (
                            MissingSecretError,
                            UnsupportedOperation,
                            ValidationError,
                        ) as exc:
                            raise BadRequest(str(exc))
                if sandbox_backend is None:
                    raise BadRequest(
                        f"No sandbox backend configured for language '{language}'. "
                        "Please configure a sandbox provider for this evaluator."
                    )

                runner = CodeEvaluatorRunner(
                    name=evaluator_name,
                    description=evaluator_description,
                    source_code=evaluator_source_code,
                    stored_output_configs=output_configs,
                    sandbox_backend=sandbox_backend,
                    language=language,
                    timeout=sandbox_timeout,
                )
                eval_results = await runner.evaluate(
                    context=context,
                    input_mapping=input_mapping.to_orm(),
                    name=evaluator_name,
                    output_configs=output_configs,
                    session_key="",
                )
                for eval_result in eval_results:
                    all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))

            elif inline_code_evaluator := evaluator_input.inline_code_evaluator:
                from phoenix.server.api.evaluators import CodeEvaluatorRunner

                language = inline_code_evaluator.language.value
                evaluator_name = inline_code_evaluator.name
                evaluator_description = inline_code_evaluator.description
                source_code = inline_code_evaluator.source_code

                # Convert output configs
                output_configs = [
                    c
                    for c in _convert_output_config_inputs_to_pydantic(
                        inline_code_evaluator.output_configs
                    )
                    if isinstance(c, (CategoricalOutputConfig, ContinuousOutputConfig))
                ]

                sandbox_backend, sandbox_timeout = await _resolve_inline_code_evaluator_backend(
                    info=info,
                    sandbox_config_id=inline_code_evaluator.sandbox_config_id,
                    language=language,
                )

                runner = CodeEvaluatorRunner(
                    name=evaluator_name,
                    description=evaluator_description,
                    source_code=source_code,
                    stored_output_configs=output_configs,
                    sandbox_backend=sandbox_backend,
                    language=language,
                    timeout=sandbox_timeout,
                )
                eval_results = await runner.evaluate(
                    context=context,
                    input_mapping=input_mapping.to_orm(),
                    name=evaluator_name,
                    output_configs=output_configs,
                    session_key="",
                )
                for eval_result in eval_results:
                    all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))

            else:
                raise BadRequest("Either evaluator_id or inline evaluator must be provided")

        return EvaluatorPreviewsPayload(results=all_results)
