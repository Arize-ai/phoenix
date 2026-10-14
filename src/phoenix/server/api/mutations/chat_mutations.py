import logging
from typing import Any, Optional, cast

import strawberry
from strawberry.types import Info

from phoenix.config import (
    get_env_online_eval_max_llm_message_bytes,
    get_env_online_eval_max_sandbox_payload_bytes,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    build_evaluator_from_definition,
)
from phoenix.server.api.evaluators import (
    EvaluationResult as EvaluationResultDict,
)
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.helpers.evaluators import result_annotation_names
from phoenix.server.api.helpers.expected_outputs import without_own_annotations
from phoenix.server.api.helpers.playground_clients import initialize_playground_clients
from phoenix.server.api.input_types.EvaluatorDefinitionInput import (
    EvaluatorPreviewsInput,
)
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.Trace import Trace
from phoenix.server.monty_runtime import (
    MontyBusy,
    MontyDeadlineExceeded,
    MontyServiceError,
    MontyShuttingDown,
    MontyUnavailable,
    MontyWorkerCrashed,
    MontyWorkerTurnTimedOut,
)
from phoenix.server.online_eval.session_policy import ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION

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


async def _evaluate_preview(
    evaluator: BaseEvaluator,
    *,
    context: dict[str, Any],
    input_mapping: InputMapping,
) -> list[EvaluationResultDict]:
    try:
        context = {
            **context,
            "metadata": without_own_annotations(
                context.get("metadata", {}),
                result_annotation_names(evaluator.name, evaluator.output_configs),
            ),
        }
        return await evaluator.evaluate(
            context=context,
            input_mapping=input_mapping,
            name=evaluator.name,
            output_configs=evaluator.output_configs,
        )
    except MontyBusy as exc:
        raise BadRequest("The Monty runtime is busy. Retry shortly.") from exc
    except MontyUnavailable as exc:
        raise BadRequest(
            "The Monty runtime is unavailable. Check the server configuration and retry."
        ) from exc
    except MontyShuttingDown as exc:
        raise BadRequest(
            "The Monty runtime is shutting down. Retry after the server restarts."
        ) from exc
    except (MontyDeadlineExceeded, MontyWorkerTurnTimedOut) as exc:
        raise BadRequest(
            "Monty execution timed out. Retry or reduce the evaluator's work."
        ) from exc
    except MontyWorkerCrashed as exc:
        raise BadRequest("The Monty worker stopped unexpectedly. Retry the preview.") from exc
    except MontyServiceError as exc:
        raise BadRequest("The Monty runtime failed unexpectedly. Retry the preview.") from exc


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    @classmethod
    async def evaluator_previews(
        cls, info: Info[Context, None], input: EvaluatorPreviewsInput
    ) -> EvaluatorPreviewsPayload:
        all_results: list[EvaluationResult] = []

        for preview_item in input.previews:
            context = cast(dict[str, Any], preview_item.context)
            input_mapping = preview_item.input_mapping.to_orm()
            # Read from the server's configuration, never from the request: a
            # preview that stands in for a scheduled run has to be rejected by
            # the same caps, and a client-supplied cap would not be one.
            max_message_bytes: Optional[int] = None
            max_payload_bytes: Optional[int] = None
            payload_limit_remediation: Optional[str] = None
            if preview_item.apply_online_evaluation_limits:
                max_message_bytes = get_env_online_eval_max_llm_message_bytes()
                max_payload_bytes = get_env_online_eval_max_sandbox_payload_bytes()
                payload_limit_remediation = ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION

            definition = preview_item.evaluator.to_definition()
            # Preview runs are ephemeral by design: no sandbox session manager is
            # passed, so each preview spins up a fresh sandbox through the backend's
            # own ``async with`` lifecycle and tears it down on exit. Cleanup then
            # never depends on a follow-up request reaching the same replica.
            async with info.context.db() as session:
                evaluator = await build_evaluator_from_definition(
                    definition=definition,
                    session=session,
                    decrypt=info.context.decrypt,
                    credentials=input.credentials,
                    sandbox_runtime=info.context.sandbox_runtime,
                    max_message_bytes=max_message_bytes,
                    max_payload_bytes=max_payload_bytes,
                    payload_limit_remediation=payload_limit_remediation,
                )
            eval_results = await _evaluate_preview(
                evaluator,
                context=context,
                input_mapping=input_mapping,
            )
            for eval_result in eval_results:
                all_results.append(_to_evaluation_result(eval_result, eval_result["name"]))

        return EvaluatorPreviewsPayload(results=all_results)
