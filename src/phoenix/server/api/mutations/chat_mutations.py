import logging
from typing import Optional

import strawberry
from pydantic import ValidationError
from strawberry.types import Info

from phoenix.db import models
from phoenix.db.types.annotation_configs import CategoricalOutputConfig
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
from phoenix.server.api.input_types.ModelClientOptionsInput import (
    BuiltinClientOptionsInput,
    ModelClientOptionsInput,
    OpenAIApiType,
)
from phoenix.server.api.mutations.evaluator_mutations import (
    _convert_output_config_inputs_to_pydantic,
)
from phoenix.server.api.types.Evaluator import BuiltInEvaluator
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.node import from_global_id
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
            context = preview_item.context
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
                evaluator_preview_client_options = (
                    None
                    if prompt_version.custom_provider_id is not None
                    else ModelClientOptionsInput(
                        builtin=BuiltinClientOptionsInput(
                            openai_api_type=OpenAIApiType.RESPONSES,
                        )
                    )
                )
                async with info.context.db() as session:
                    llm_client = await get_playground_client(
                        model_provider=prompt_version.model_provider.to_model_provider(),
                        model_name=prompt_version.model_name,
                        custom_provider_id=prompt_version.resolved_custom_provider_id(),
                        session=session,
                        decrypt=info.context.decrypt,
                        credentials=input.credentials,
                        client_options=evaluator_preview_client_options,
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

            else:
                raise BadRequest("Either evaluator_id or inline_llm_evaluator must be provided")

        return EvaluatorPreviewsPayload(results=all_results)
