"""Run one evaluator definition against many subjects and stream a result per subject."""

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any, Optional, cast

import anyio
from anyio.streams.memory import MemoryObjectSendStream
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import (
    get_env_online_eval_max_llm_message_bytes,
    get_env_online_eval_max_sandbox_payload_bytes,
)
from phoenix.db import models
from phoenix.db.types.evaluator_definition import (
    EvaluatorDefinition,
    InlineDecisionEvaluatorDefinition,
    StoredDecisionEvaluatorDefinition,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    BaseEvaluator,
    build_evaluator_from_definition,
)
from phoenix.server.api.evaluators import (
    EvaluationResult as EvaluationResultDict,
)
from phoenix.server.api.exceptions import BadRequest, CustomGraphQLError, NotFound
from phoenix.server.api.helpers.decision_evaluator_service import get_decision_evaluator
from phoenix.server.api.helpers.decision_evaluators import (
    capture_decision_evaluator_definition,
    parse_decision_annotation,
)
from phoenix.server.api.helpers.evaluators import result_annotation_names
from phoenix.server.api.helpers.expected_outputs import without_own_annotations
from phoenix.server.api.input_types.EvaluatorDefinitionInput import (
    EvaluatorPreviewInput,
    EvaluatorPreviewSubjectInput,
    _node_id,
)
from phoenix.server.api.types.EvaluatorPreviewSubjectResult import (
    EvaluationResult,
    EvaluatorPreviewSubjectResult,
)
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
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

# Subjects of one preview evaluated at once; the rest wait their turn. A bench's
# "test all" sends every listed record in one request, so this is what keeps one
# click from opening that many LLM calls or sandbox executions at the same time.
MAX_CONCURRENT_SUBJECTS = 5

UNEXPECTED_SUBJECT_ERROR = "An unexpected error occurred while evaluating this subject."


async def stream_evaluator_preview(
    context: Context, input: EvaluatorPreviewInput
) -> AsyncIterator[EvaluatorPreviewSubjectResult]:
    """
    Build the evaluator once and yield one result per subject, in completion order.

    A definition that cannot be built (an unknown evaluator, a missing sandbox
    configuration or provider) fails the request before any subject runs, since it would
    fail every subject the same way. Anything that goes wrong while one subject runs
    becomes that subject's error and the others continue.

    Closing the stream (a client that disconnects) cancels the subjects still running,
    with their LLM calls and sandbox executions; each sandbox is torn down as its
    execution is cancelled.
    """
    subject_keys = [subject.key for subject in input.subjects]
    if len(set(subject_keys)) != len(subject_keys):
        raise BadRequest("Each evaluator preview subject needs a unique key")
    if not input.subjects:
        return
    # Read from the server's configuration, never from the request: a preview that
    # stands in for a scheduled run has to be rejected by the same caps, and a
    # client-supplied cap would not be one.
    max_message_bytes: Optional[int] = None
    max_payload_bytes: Optional[int] = None
    payload_limit_remediation: Optional[str] = None
    if input.apply_online_evaluation_limits:
        max_message_bytes = get_env_online_eval_max_llm_message_bytes()
        max_payload_bytes = get_env_online_eval_max_sandbox_payload_bytes()
        payload_limit_remediation = ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION
    definition = input.evaluator.to_definition() if input.evaluator is not None else None
    binding_id = (
        _node_id(input.dataset_evaluator_id, "DatasetEvaluator", "dataset evaluator")
        if input.dataset_evaluator_id is not None
        else None
    )
    # Converted before the evaluator is built, so nothing that can fail sits between
    # building it and the cleanup below.
    input_mapping = input.input_mapping.to_orm()
    # No sandbox session manager: each subject runs in an ephemeral sandbox that the
    # backend creates and tears down inside the call. A shared session, as experiments
    # use, would serialize subjects on backends that cannot run concurrently in one
    # session, take slots from the per-provider session cap that online evaluations
    # use, and leave a lock per request in the manager. Cleanup also never depends on
    # a later request reaching the same replica.
    async with context.db() as session:
        if binding_id is not None:
            definition = await _capture_binding_definition(session, definition, binding_id)
        if definition is None:
            raise BadRequest("Evaluator definition or datasetEvaluatorId is required")
        evaluator = await build_evaluator_from_definition(
            definition=definition,
            session=session,
            decrypt=context.decrypt,
            credentials=input.credentials or None,
            sandbox_runtime=context.sandbox_runtime,
            max_message_bytes=max_message_bytes,
            max_payload_bytes=max_payload_bytes,
            payload_limit_remediation=payload_limit_remediation,
        )
    send_stream, receive_stream = anyio.create_memory_object_stream[EvaluatorPreviewSubjectResult](
        max_buffer_size=len(input.subjects)
    )
    # The subjects run in their own task, not in a task group around the yields below:
    # a generator that is closed from another task cannot exit a cancel scope it opened.
    producer = asyncio.create_task(
        _evaluate_subjects(evaluator, input.subjects, input_mapping, send_stream)
    )
    reported = 0
    try:
        async with receive_stream:
            async for result in receive_stream:
                reported += 1
                yield result
    finally:
        if not producer.done():
            logger.info(
                "Evaluator preview closed with %d of %d subjects unreported; cancelling them",
                len(input.subjects) - reported,
                len(input.subjects),
            )
            producer.cancel()
        await asyncio.gather(producer, return_exceptions=True)


async def _capture_binding_definition(
    session: AsyncSession, definition: Optional[EvaluatorDefinition], binding_id: int
) -> InlineDecisionEvaluatorDefinition:
    """Capture a saved evaluator as a dataset binding, matching what an experiment would run."""
    if definition is not None and not isinstance(definition, StoredDecisionEvaluatorDefinition):
        raise BadRequest("datasetEvaluatorId requires a saved decision evaluator")
    binding = await session.get(models.DatasetEvaluators, binding_id)
    if binding is None:
        raise NotFound(f"Dataset evaluator not found: {binding_id}")
    if (
        isinstance(definition, StoredDecisionEvaluatorDefinition)
        and binding.evaluator_id != definition.decision_evaluator_id
    ):
        raise BadRequest("The dataset evaluator is not bound to the given decision evaluator")
    judge = await get_decision_evaluator(session, binding.evaluator_id)
    try:
        return capture_decision_evaluator_definition(
            judge,
            name=binding.name.root,
            description=binding.description,
            dataset_evaluator_id=binding.id,
        )
    except ValueError as error:
        raise BadRequest(str(error)) from error


async def _evaluate_subjects(
    evaluator: BaseEvaluator,
    subjects: list[EvaluatorPreviewSubjectInput],
    input_mapping: InputMapping,
    send_stream: MemoryObjectSendStream[EvaluatorPreviewSubjectResult],
) -> None:
    limiter = anyio.CapacityLimiter(MAX_CONCURRENT_SUBJECTS)

    async def run_subject(
        subject: EvaluatorPreviewSubjectInput,
        subject_send_stream: MemoryObjectSendStream[EvaluatorPreviewSubjectResult],
    ) -> None:
        async with subject_send_stream:
            async with limiter:
                result = await _evaluate_subject(
                    evaluator, subject=subject, input_mapping=input_mapping
                )
            await subject_send_stream.send(result)

    async with send_stream:
        async with anyio.create_task_group() as task_group:
            for subject in subjects:
                task_group.start_soon(run_subject, subject, send_stream.clone())


async def _evaluate_subject(
    evaluator: BaseEvaluator,
    *,
    subject: EvaluatorPreviewSubjectInput,
    input_mapping: InputMapping,
) -> EvaluatorPreviewSubjectResult:
    try:
        eval_results = await _evaluate(
            evaluator,
            context=cast(dict[str, Any], subject.context),
            input_mapping=input_mapping,
        )
    except _SubjectRunError as error:
        return EvaluatorPreviewSubjectResult(key=subject.key, results=[], error=str(error))
    except CustomGraphQLError as error:
        return EvaluatorPreviewSubjectResult(key=subject.key, results=[], error=str(error))
    except Exception:
        logger.exception("Evaluator preview subject %r failed", subject.key)
        return EvaluatorPreviewSubjectResult(
            key=subject.key, results=[], error=UNEXPECTED_SUBJECT_ERROR
        )
    return EvaluatorPreviewSubjectResult(
        key=subject.key,
        results=[_to_evaluation_result(eval_result) for eval_result in eval_results],
    )


class _SubjectRunError(Exception):
    """A runtime failure that is reported on the subject it happened to."""


async def _evaluate(
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
        raise _SubjectRunError("The Monty runtime is busy. Retry shortly.") from exc
    except MontyUnavailable as exc:
        raise _SubjectRunError(
            "The Monty runtime is unavailable. Check the server configuration and retry."
        ) from exc
    except MontyShuttingDown as exc:
        raise _SubjectRunError(
            "The Monty runtime is shutting down. Retry after the server restarts."
        ) from exc
    except (MontyDeadlineExceeded, MontyWorkerTurnTimedOut) as exc:
        raise _SubjectRunError(
            "Monty execution timed out. Retry or reduce the evaluator's work."
        ) from exc
    except MontyWorkerCrashed as exc:
        raise _SubjectRunError("The Monty worker stopped unexpectedly. Retry the preview.") from exc
    except MontyServiceError as exc:
        raise _SubjectRunError("The Monty runtime failed unexpectedly. Retry the preview.") from exc


def _to_evaluation_result(eval_result: EvaluationResultDict) -> EvaluationResult:
    if eval_result["error"] is not None:
        return EvaluationResult(
            evaluator_name=eval_result["name"], status="error", error=eval_result["error"]
        )
    decision = parse_decision_annotation(eval_result["metadata"])
    return EvaluationResult(
        evaluator_name=eval_result["name"],
        status=decision.status if decision is not None else "answered",
        annotation=ExperimentRunAnnotation.from_dict(
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
        ),
    )
