import asyncio
import json
import logging
from dataclasses import asdict, field
from datetime import datetime, timezone
from itertools import chain, islice
from traceback import format_exc
from typing import Any, Iterable, Iterator, Optional, TypeVar, Union

import strawberry
from openinference.instrumentation import safe_json_dumps
from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace.id_generator import RandomIdGenerator as DefaultOTelIDGenerator
from opentelemetry.trace import StatusCode
from pydantic import ValidationError
from sqlalchemy import insert, select
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import (
    get_dataset_example_revisions,
    insert_experiment_with_examples_snapshot,
)
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    EvaluationResult,
    create_llm_evaluator_from_inline,
    evaluation_result_to_model,
    evaluation_result_to_span_annotation,
    get_builtin_evaluator_by_id,
    get_llm_evaluators,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.dataset_helpers import get_dataset_example_output
from phoenix.server.api.helpers.evaluators import (
    validate_evaluator_prompt_and_config,
)
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    get_playground_client,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_spans import (
    input_value_and_mime_type,
    llm_input_messages,
    llm_invocation_parameters,
    llm_model_name,
    llm_span_kind,
    llm_tools,
    prompt_metadata,
)
from phoenix.server.api.helpers.playground_users import get_user
from phoenix.server.api.helpers.prompts.template_helpers import get_template_formatter
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.input_types.EvaluatorPreviewInput import (
    EvaluatorPreviewsInput,
)
from phoenix.server.api.input_types.GenerativeModelInput import (
    GenerativeModelBuiltinProviderInput,
    GenerativeModelInput,
)
from phoenix.server.api.input_types.PromptTemplateOptions import PromptTemplateOptions
from phoenix.server.api.mutations.annotation_config_mutations import (
    _to_pydantic_categorical_annotation_config,
)
from phoenix.server.api.subscriptions import (
    _default_playground_experiment_name,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import BuiltInEvaluator
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.server.experiments.utils import generate_experiment_project_name
from phoenix.trace.attributes import get_attribute_value, unflatten
from phoenix.trace.schemas import SpanException
from phoenix.utilities.json import jsonify

logger = logging.getLogger(__name__)

initialize_playground_clients()

ExampleRowID: TypeAlias = int
RepetitionNumber: TypeAlias = int

ChatCompletionMessage = tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[Any]]]


@strawberry.type
class ChatCompletionFunctionCall:
    name: str
    arguments: str


@strawberry.type
class ChatCompletionToolCall:
    id: str
    function: ChatCompletionFunctionCall


@strawberry.type
class ChatCompletionRepetition:
    repetition_number: int
    content: Optional[str]
    tool_calls: list[ChatCompletionToolCall]
    span: Optional[Span]
    error_message: Optional[str]
    evaluations: list[ExperimentRunAnnotation] = field(default_factory=list)


@strawberry.type
class ChatCompletionMutationPayload:
    repetitions: list[ChatCompletionRepetition]


@strawberry.type
class ChatCompletionOverDatasetMutationExamplePayload:
    dataset_example_id: GlobalID
    repetition_number: int
    experiment_run_id: GlobalID
    repetition: ChatCompletionRepetition


@strawberry.type
class ChatCompletionOverDatasetMutationPayload:
    dataset_id: GlobalID
    dataset_version_id: GlobalID
    experiment_id: GlobalID
    examples: list[ChatCompletionOverDatasetMutationExamplePayload] = field(default_factory=list)


@strawberry.type
class EvaluatorPreviewPayload:
    results: list[ExperimentRunAnnotation]


def _to_annotation(eval_result: EvaluationResult) -> ExperimentRunAnnotation:
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
        }
    )


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    @classmethod
    async def chat_completion_over_dataset(
        cls,
        info: Info[Context, None],
        input: ChatCompletionOverDatasetInput,
    ) -> ChatCompletionOverDatasetMutationPayload:
        llm_client = await get_playground_client(input.model, info.context.db, info.context.decrypt)
        dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
        dataset_version_id = (
            from_global_id_with_expected_type(
                global_id=input.dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if input.dataset_version_id
            else None
        )
        project_name = generate_experiment_project_name()
        async with info.context.db() as session:
            dataset = await session.scalar(select(models.Dataset).filter_by(id=dataset_id))
            if dataset is None:
                raise NotFound("Dataset not found")
            if dataset_version_id is None:
                resolved_version_id = await session.scalar(
                    select(models.DatasetVersion.id)
                    .filter_by(dataset_id=dataset_id)
                    .order_by(models.DatasetVersion.id.desc())
                    .limit(1)
                )
                if resolved_version_id is None:
                    raise NotFound("No versions found for the given dataset")
            else:
                resolved_version_id = dataset_version_id
            # Parse split IDs if provided
            resolved_split_ids: Optional[list[int]] = None
            if input.split_ids is not None and len(input.split_ids) > 0:
                resolved_split_ids = [
                    from_global_id_with_expected_type(split_id, models.DatasetSplit.__name__)
                    for split_id in input.split_ids
                ]

            revisions = [
                revision
                async for revision in await session.stream_scalars(
                    get_dataset_example_revisions(
                        resolved_version_id,
                        split_ids=resolved_split_ids,
                    ).order_by(models.DatasetExampleRevision.id)
                )
            ]
            if not revisions:
                raise NotFound("No examples found for the given dataset and version")
            user_id = get_user(info)
            experiment = models.Experiment(
                dataset_id=from_global_id_with_expected_type(input.dataset_id, Dataset.__name__),
                dataset_version_id=resolved_version_id,
                name=input.experiment_name
                or _default_playground_experiment_name(input.prompt_name),
                description=input.experiment_description,
                repetitions=1,
                metadata_=input.experiment_metadata or dict(),
                project_name=project_name,
                user_id=user_id,
            )
            if resolved_split_ids:
                experiment.experiment_dataset_splits = [
                    models.ExperimentDatasetSplit(dataset_split_id=split_id)
                    for split_id in resolved_split_ids
                ]
            await insert_experiment_with_examples_snapshot(session, experiment)

        results: list[Union[tuple[ChatCompletionRepetition, models.Span], BaseException]] = []
        batch_size = 3
        start_time = datetime.now(timezone.utc)
        unbatched_items = [
            (revision, repetition_number)
            for revision in revisions
            for repetition_number in range(1, input.repetitions + 1)
        ]
        for batch in _get_batches(unbatched_items, batch_size):
            batch_results = await asyncio.gather(
                *(
                    cls._chat_completion(
                        info,
                        llm_client,
                        ChatCompletionInput(
                            model=input.model,
                            messages=input.messages,
                            tools=input.tools,
                            invocation_parameters=input.invocation_parameters,
                            template=PromptTemplateOptions(
                                format=input.template_format,
                                variables=revision.input,
                            ),
                            prompt_name=input.prompt_name,
                            repetitions=repetition_number,
                            evaluators=input.evaluators,
                        ),
                        repetition_number=repetition_number,
                        project_name=project_name,
                    )
                    for revision, repetition_number in batch
                ),
                return_exceptions=True,
            )
            results.extend(batch_results)

        payload = ChatCompletionOverDatasetMutationPayload(
            dataset_id=GlobalID(models.Dataset.__name__, str(dataset.id)),
            dataset_version_id=GlobalID(DatasetVersion.__name__, str(resolved_version_id)),
            experiment_id=GlobalID(models.Experiment.__name__, str(experiment.id)),
        )
        experiment_runs = []
        for (revision, repetition_number), result in zip(unbatched_items, results):
            if isinstance(result, BaseException):
                experiment_run = models.ExperimentRun(
                    experiment_id=experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    output={},
                    repetition_number=repetition_number,
                    start_time=start_time,
                    end_time=start_time,
                    error=str(result),
                )
            else:
                repetition, db_span = result
                experiment_run = models.ExperimentRun(
                    experiment_id=experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    trace_id=db_span.trace.trace_id,
                    output=models.ExperimentRunOutput(
                        task_output=get_dataset_example_output(db_span),
                    ),
                    prompt_token_count=db_span.cumulative_llm_token_count_prompt,
                    completion_token_count=db_span.cumulative_llm_token_count_completion,
                    repetition_number=repetition_number,
                    start_time=db_span.start_time,
                    end_time=db_span.end_time,
                    error=str(repetition.error_message) if repetition.error_message else None,
                )
            experiment_runs.append(experiment_run)

        async with info.context.db() as session:
            session.add_all(experiment_runs)
            await session.flush()

        evaluations: dict[tuple[ExampleRowID, RepetitionNumber], list[ExperimentRunAnnotation]] = {}
        if input.evaluators:
            async with info.context.db() as session:
                llm_evaluators = await get_llm_evaluators(
                    evaluator_node_ids=[evaluator.id for evaluator in input.evaluators],
                    session=session,
                    llm_client=llm_client,
                )
                for (revision, repetition_number), experiment_run in zip(
                    unbatched_items, experiment_runs
                ):
                    if experiment_run.error:
                        continue  # skip runs that errored out
                    evaluation_key = (revision.dataset_example_id, repetition_number)
                    evaluations[evaluation_key] = []

                    context_dict: dict[str, Any] = {
                        "input": json.dumps(revision.input),
                        "expected": json.dumps(revision.output),
                        "output": json.dumps(experiment_run.output),
                    }

                    # Run builtin evaluators
                    for evaluator in input.evaluators:
                        _, db_id = from_global_id(evaluator.id)
                        if _is_builtin_evaluator(db_id):
                            builtin_evaluator = get_builtin_evaluator_by_id(db_id)
                            if builtin_evaluator is None:
                                continue
                            builtin = builtin_evaluator()
                            eval_result: EvaluationResult = builtin.evaluate(
                                context=context_dict,
                                input_mapping=evaluator.input_mapping,
                            )
                            annotation_model = evaluation_result_to_model(
                                eval_result,
                                experiment_run_id=experiment_run.id,
                            )
                            session.add(annotation_model)
                            await session.flush()
                            evaluations[evaluation_key].append(
                                ExperimentRunAnnotation(
                                    id=annotation_model.id,
                                    db_record=annotation_model,
                                )
                            )

                    # Run LLM evaluators
                    input_mappings_by_evaluator_node_id = {
                        evaluator.id: evaluator.input_mapping for evaluator in input.evaluators
                    }
                    for llm_evaluator in llm_evaluators:
                        input_mapping = input_mappings_by_evaluator_node_id[llm_evaluator.node_id]
                        eval_result = await llm_evaluator.evaluate(
                            context=context_dict,
                            input_mapping=input_mapping,
                        )
                        annotation_model = evaluation_result_to_model(
                            eval_result,
                            experiment_run_id=experiment_run.id,
                        )
                        session.add(annotation_model)
                        await session.flush()
                        evaluations[evaluation_key].append(
                            ExperimentRunAnnotation(
                                id=annotation_model.id,
                                db_record=annotation_model,
                            )
                        )

        for (revision, repetition_number), experiment_run, result in zip(
            unbatched_items, experiment_runs, results
        ):
            dataset_example_id = GlobalID(
                models.DatasetExample.__name__, str(revision.dataset_example_id)
            )
            experiment_run_id = GlobalID(models.ExperimentRun.__name__, str(experiment_run.id))
            evaluation_key = (revision.dataset_example_id, repetition_number)

            if isinstance(result, BaseException):
                repetition = ChatCompletionRepetition(
                    repetition_number=repetition_number,
                    content=None,
                    tool_calls=[],
                    span=None,
                    error_message=str(result),
                    evaluations=[],
                )
            else:
                repetition = result[0]
                repetition.evaluations = evaluations.get(evaluation_key, [])

            example_payload = ChatCompletionOverDatasetMutationExamplePayload(
                dataset_example_id=dataset_example_id,
                repetition_number=repetition_number,
                experiment_run_id=experiment_run_id,
                repetition=repetition,
            )
            payload.examples.append(example_payload)
        return payload

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    @classmethod
    async def chat_completion(
        cls, info: Info[Context, None], input: ChatCompletionInput
    ) -> ChatCompletionMutationPayload:
        llm_client = await get_playground_client(input.model, info.context.db, info.context.decrypt)
        results: list[Union[tuple[ChatCompletionRepetition, models.Span], BaseException]] = []
        batch_size = 3
        for batch in _get_batches(range(1, input.repetitions + 1), batch_size):
            batch_results = await asyncio.gather(
                *(
                    cls._chat_completion(
                        info, llm_client, input, repetition_number=repetition_number
                    )
                    for repetition_number in batch
                ),
                return_exceptions=True,
            )
            results.extend(batch_results)

        # Run evaluations if evaluators are specified
        evaluations_by_repetition: dict[int, list[ExperimentRunAnnotation]] = {}
        if input.evaluators:
            async with info.context.db() as session:
                llm_evaluators = await get_llm_evaluators(
                    evaluator_node_ids=[evaluator.id for evaluator in input.evaluators],
                    session=session,
                    llm_client=llm_client,
                )
                for repetition_number, result in enumerate(results, start=1):
                    if isinstance(result, BaseException):
                        continue  # skip failed completions
                    _, db_span = result
                    evaluations_by_repetition[repetition_number] = []

                    context_dict: dict[str, Any] = {
                        "input": json.dumps(
                            get_attribute_value(db_span.attributes, LLM_INPUT_MESSAGES)
                        ),
                        "output": json.dumps(
                            get_attribute_value(db_span.attributes, LLM_OUTPUT_MESSAGES)
                        ),
                    }

                    # Run builtin evaluators
                    for evaluator in input.evaluators:
                        _, db_id = from_global_id(evaluator.id)
                        if _is_builtin_evaluator(db_id):
                            builtin_evaluator = get_builtin_evaluator_by_id(db_id)
                            if builtin_evaluator is None:
                                continue
                            builtin = builtin_evaluator()
                            eval_result: EvaluationResult = builtin.evaluate(
                                context=context_dict,
                                input_mapping=evaluator.input_mapping,
                            )
                            annotation_model = evaluation_result_to_span_annotation(
                                eval_result,
                                span_rowid=db_span.id,
                            )
                            session.add(annotation_model)
                            await session.flush()
                            evaluations_by_repetition[repetition_number].append(
                                ExperimentRunAnnotation.from_dict(
                                    {
                                        "name": eval_result["name"],
                                        "label": eval_result["label"],
                                        "score": eval_result["score"],
                                        "explanation": eval_result["explanation"],
                                        "metadata": eval_result["metadata"],
                                    }
                                )
                            )

                    # Run LLM evaluators
                    input_mappings_by_evaluator_node_id = {
                        evaluator.id: evaluator.input_mapping for evaluator in input.evaluators
                    }
                    for llm_evaluator in llm_evaluators:
                        input_mapping = input_mappings_by_evaluator_node_id[llm_evaluator.node_id]
                        eval_result = await llm_evaluator.evaluate(
                            context=context_dict,
                            input_mapping=input_mapping,
                        )
                        annotation_model = evaluation_result_to_span_annotation(
                            eval_result,
                            span_rowid=db_span.id,
                        )
                        session.add(annotation_model)
                        await session.flush()
                        evaluations_by_repetition[repetition_number].append(
                            ExperimentRunAnnotation.from_dict(
                                {
                                    "name": eval_result["name"],
                                    "label": eval_result["label"],
                                    "score": eval_result["score"],
                                    "explanation": eval_result["explanation"],
                                    "metadata": eval_result["metadata"],
                                }
                            )
                        )

        repetitions: list[ChatCompletionRepetition] = []
        for repetition_number, result in enumerate(results, start=1):
            if isinstance(result, BaseException):
                repetitions.append(
                    ChatCompletionRepetition(
                        repetition_number=repetition_number,
                        content=None,
                        tool_calls=[],
                        span=None,
                        error_message=str(result),
                        evaluations=[],
                    )
                )
            else:
                repetition, _ = result
                repetition.evaluations = evaluations_by_repetition.get(repetition_number, [])
                repetitions.append(repetition)

        return ChatCompletionMutationPayload(repetitions=repetitions)

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    @classmethod
    async def evaluator_previews(
        cls, info: Info[Context, None], input: EvaluatorPreviewsInput
    ) -> EvaluatorPreviewPayload:
        all_results: list[ExperimentRunAnnotation] = []

        for preview_item in input.previews:
            evaluator_input = preview_item.evaluator
            context = preview_item.context
            input_mapping = preview_item.input_mapping

            if evaluator_id := evaluator_input.built_in_evaluator_id:
                type_name, db_id = from_global_id(evaluator_id)

                if type_name != BuiltInEvaluator.__name__:
                    raise BadRequest(f"Expected built-in evaluator, got {type_name}")
                builtin_evaluator_cls = get_builtin_evaluator_by_id(db_id)
                if builtin_evaluator_cls is None:
                    raise BadRequest(f"Built-in evaluator with id {evaluator_id} not found")
                builtin_evaluator = builtin_evaluator_cls()

                eval_result = builtin_evaluator.evaluate(
                    context=context,
                    input_mapping=input_mapping,
                )
                context_result = _to_annotation(eval_result)

            elif inline_llm_evaluator := evaluator_input.inline_llm_evaluator:
                model_provider = inline_llm_evaluator.prompt_version.model_provider
                model_name = inline_llm_evaluator.prompt_version.model_name
                generative_provider_key = _convert_model_provider_to_generative_provider_key(
                    model_provider
                )
                model_input = GenerativeModelInput(
                    builtin=GenerativeModelBuiltinProviderInput(
                        provider_key=generative_provider_key,
                        name=model_name,
                    )
                )
                llm_client = await get_playground_client(
                    model_input, info.context.db, info.context.decrypt
                )
                try:
                    prompt_version_orm = inline_llm_evaluator.prompt_version.to_orm_prompt_version(
                        user_id=None
                    )
                except ValidationError as error:
                    raise BadRequest(str(error))

                output_config = _to_pydantic_categorical_annotation_config(
                    inline_llm_evaluator.output_config
                )

                evaluator = create_llm_evaluator_from_inline(
                    prompt_version_orm=prompt_version_orm,
                    annotation_name=inline_llm_evaluator.output_config.name,
                    output_config=output_config,
                    llm_client=llm_client,
                    description=inline_llm_evaluator.description,
                )

                try:
                    validate_evaluator_prompt_and_config(
                        prompt_tools=prompt_version_orm.tools,
                        prompt_response_format=prompt_version_orm.response_format,
                        evaluator_annotation_name=inline_llm_evaluator.output_config.name,
                        evaluator_output_config=output_config,
                        evaluator_description=inline_llm_evaluator.description,
                    )
                except ValueError as error:
                    raise BadRequest(str(error))

                eval_result = await evaluator.evaluate(
                    context=context,
                    input_mapping=input_mapping,
                )
                context_result = _to_annotation(eval_result)

            else:
                raise BadRequest("Either evaluator_id or inline_llm_evaluator must be provided")

            all_results.append(context_result)

        return EvaluatorPreviewPayload(results=all_results)

    @classmethod
    async def _chat_completion(
        cls,
        info: Info[Context, None],
        llm_client: PlaygroundStreamingClient,
        input: ChatCompletionInput,
        repetition_number: int,
        project_name: str = PLAYGROUND_PROJECT_NAME,
        project_description: str = "Traces from prompt playground",
    ) -> tuple[ChatCompletionRepetition, models.Span]:
        attributes: dict[str, Any] = {}
        attributes.update(dict(prompt_metadata(input.prompt_name)))

        messages = [
            (
                message.role,
                message.content,
                message.tool_call_id if isinstance(message.tool_call_id, str) else None,
                message.tool_calls if isinstance(message.tool_calls, list) else None,
            )
            for message in input.messages
        ]
        if template_options := input.template:
            messages = list(_formatted_messages(messages, template_options))
            attributes.update(
                {PROMPT_TEMPLATE_VARIABLES: safe_json_dumps(template_options.variables)}
            )

        invocation_parameters = llm_client.construct_invocation_parameters(
            input.invocation_parameters
        )

        text_content = ""
        tool_calls: dict[str, ChatCompletionToolCall] = {}
        events = []
        if input.model.builtin:
            model_name = input.model.builtin.name
        else:
            assert input.model.custom
            model_name = input.model.custom.model_name
        attributes.update(
            chain(
                llm_span_kind(),
                llm_model_name(model_name),
                llm_tools(input.tools or []),
                llm_input_messages(messages),
                llm_invocation_parameters(invocation_parameters),
                input_value_and_mime_type(input),
            )
        )

        start_time = normalize_datetime(dt=local_now(), tz=timezone.utc)
        status_code = StatusCode.OK
        status_message = ""
        try:
            async for chunk in llm_client.chat_completion_create(
                messages=messages, tools=input.tools or [], **invocation_parameters
            ):
                # Process the chunk
                if isinstance(chunk, TextChunk):
                    text_content += chunk.content
                elif isinstance(chunk, ToolCallChunk):
                    if chunk.id not in tool_calls:
                        tool_calls[chunk.id] = ChatCompletionToolCall(
                            id=chunk.id,
                            function=ChatCompletionFunctionCall(
                                name=chunk.function.name,
                                arguments=chunk.function.arguments,
                            ),
                        )
                    else:
                        tool_calls[chunk.id].function.arguments += chunk.function.arguments
                else:
                    assert_never(chunk)
        except Exception as e:
            # Handle exceptions and record exception event
            status_code = StatusCode.ERROR
            status_message = str(e)
            end_time = normalize_datetime(dt=local_now(), tz=timezone.utc)
            assert end_time is not None
            events.append(
                SpanException(
                    timestamp=end_time,
                    message=status_message,
                    exception_type=type(e).__name__,
                    exception_escaped=False,
                    exception_stacktrace=format_exc(),
                )
            )
        else:
            end_time = normalize_datetime(dt=local_now(), tz=timezone.utc)

        attributes.update(llm_client.attributes)
        if text_content or tool_calls:
            attributes.update(
                chain(
                    _output_value_and_mime_type(text_content, tool_calls),
                    _llm_output_messages(text_content, tool_calls),
                )
            )

        # Now write the span to the database
        trace_id = _generate_trace_id()
        span_id = _generate_span_id()
        async with info.context.db() as session:
            # Get or create the project ID
            if (
                project_id := await session.scalar(
                    select(models.Project.id).where(models.Project.name == project_name)
                )
            ) is None:
                project_id = await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=project_name,
                        description=project_description,
                    )
                )
            trace = models.Trace(
                project_rowid=project_id,
                trace_id=trace_id,
                start_time=start_time,
                end_time=end_time,
            )
            span = models.Span(
                trace_rowid=trace.id,
                span_id=span_id,
                parent_id=None,
                name="ChatCompletion",
                span_kind=LLM,
                start_time=start_time,
                end_time=end_time,
                attributes=unflatten(attributes.items()),
                events=[_serialize_event(event) for event in events],
                status_code=status_code.name,
                status_message=status_message,
                cumulative_error_count=int(status_code is StatusCode.ERROR),
                cumulative_llm_token_count_prompt=attributes.get(LLM_TOKEN_COUNT_PROMPT, 0),
                cumulative_llm_token_count_completion=attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0),
                llm_token_count_prompt=attributes.get(LLM_TOKEN_COUNT_PROMPT, 0),
                llm_token_count_completion=attributes.get(LLM_TOKEN_COUNT_COMPLETION, 0),
                trace=trace,
            )
            session.add(trace)
            session.add(span)
            await session.flush()
            try:
                span_cost = info.context.span_cost_calculator.calculate_cost(
                    start_time=span.start_time,
                    attributes=span.attributes,
                )
            except Exception as e:
                logger.exception(f"Failed to calculate cost for span {span.id}: {e}")
                span_cost = None
            if span_cost:
                span_cost.span_rowid = span.id
                span_cost.trace_rowid = trace.id
                session.add(span_cost)
                await session.flush()

        gql_span = Span(id=span.id, db_record=span)

        info.context.event_queue.put(SpanInsertEvent(ids=(project_id,)))

        if status_code is StatusCode.ERROR:
            repetition = ChatCompletionRepetition(
                repetition_number=repetition_number,
                content=None,
                tool_calls=[],
                span=gql_span,
                error_message=status_message,
                evaluations=[],
            )
        else:
            repetition = ChatCompletionRepetition(
                repetition_number=repetition_number,
                content=text_content if text_content else None,
                tool_calls=list(tool_calls.values()),
                span=gql_span,
                error_message=None,
                evaluations=[],
            )
        return repetition, span


def _formatted_messages(
    messages: Iterable[ChatCompletionMessage],
    template_options: PromptTemplateOptions,
) -> Iterator[ChatCompletionMessage]:
    """
    Formats the messages using the given template options.
    """
    template_formatter = get_template_formatter(template_format=template_options.format)
    (
        roles,
        templates,
        tool_call_id,
        tool_calls,
    ) = zip(*messages)
    formatted_templates = map(
        lambda template: template_formatter.format(template, **template_options.variables),
        templates,
    )
    formatted_messages = zip(roles, formatted_templates, tool_call_id, tool_calls)
    return formatted_messages


def _output_value_and_mime_type(
    text: str, tool_calls: dict[str, ChatCompletionToolCall]
) -> Iterator[tuple[str, Any]]:
    if text and tool_calls:
        yield OUTPUT_MIME_TYPE, JSON
        yield (
            OUTPUT_VALUE,
            safe_json_dumps({"content": text, "tool_calls": jsonify(list(tool_calls.values()))}),
        )
    elif tool_calls:
        yield OUTPUT_MIME_TYPE, JSON
        yield OUTPUT_VALUE, safe_json_dumps(jsonify(list(tool_calls.values())))
    elif text:
        yield OUTPUT_MIME_TYPE, TEXT
        yield OUTPUT_VALUE, text


def _llm_output_messages(
    text_content: str, tool_calls: dict[str, ChatCompletionToolCall]
) -> Iterator[tuple[str, Any]]:
    yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_ROLE}", "assistant"
    if text_content:
        yield f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_CONTENT}", text_content
    for tool_call_index, tool_call in enumerate(tool_calls.values()):
        if tool_call_id := tool_call.id:
            yield (
                f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_ID}",
                tool_call_id,
            )
        yield (
            f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_NAME}",
            tool_call.function.name,
        )
        if arguments := tool_call.function.arguments:
            yield (
                f"{LLM_OUTPUT_MESSAGES}.0.{MESSAGE_TOOL_CALLS}.{tool_call_index}.{TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                arguments,
            )


def _generate_trace_id() -> str:
    return _hex(DefaultOTelIDGenerator().generate_trace_id())


def _generate_span_id() -> str:
    return _hex(DefaultOTelIDGenerator().generate_span_id())


def _hex(number: int) -> str:
    return hex(number)[2:]


def _serialize_event(event: SpanException) -> dict[str, Any]:
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in asdict(event).items()}


_AnyT = TypeVar("_AnyT")


def _get_batches(
    iterable: Iterable[_AnyT],
    batch_size: int,
) -> Iterator[list[_AnyT]]:
    """Splits an iterable into batches not exceeding a specified size."""
    iterator = iter(iterable)
    while batch := list(islice(iterator, batch_size)):
        yield batch


def _is_builtin_evaluator(evaluator_id: int) -> bool:
    return evaluator_id < 0


def _convert_model_provider_to_generative_provider_key(
    model_provider: ModelProvider,
) -> GenerativeProviderKey:
    """Convert a model provider to a generative provider key."""
    if model_provider is ModelProvider.OPENAI:
        return GenerativeProviderKey.OPENAI
    elif model_provider is ModelProvider.AZURE_OPENAI:
        return GenerativeProviderKey.AZURE_OPENAI
    elif model_provider is ModelProvider.ANTHROPIC:
        return GenerativeProviderKey.ANTHROPIC
    elif model_provider is ModelProvider.GOOGLE:
        return GenerativeProviderKey.GOOGLE
    elif model_provider is ModelProvider.DEEPSEEK:
        return GenerativeProviderKey.DEEPSEEK
    elif model_provider is ModelProvider.XAI:
        return GenerativeProviderKey.XAI
    elif model_provider is ModelProvider.OLLAMA:
        return GenerativeProviderKey.OLLAMA
    elif model_provider is ModelProvider.AWS:
        return GenerativeProviderKey.AWS
    assert_never(model_provider)


JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value
LLM = OpenInferenceSpanKindValues.LLM.value

OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_INVOCATION_PARAMETERS = SpanAttributes.LLM_INVOCATION_PARAMETERS
LLM_TOOLS = SpanAttributes.LLM_TOOLS
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION

MESSAGE_CONTENT = MessageAttributes.MESSAGE_CONTENT
MESSAGE_ROLE = MessageAttributes.MESSAGE_ROLE
MESSAGE_TOOL_CALLS = MessageAttributes.MESSAGE_TOOL_CALLS

TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID
TOOL_CALL_FUNCTION_NAME = ToolCallAttributes.TOOL_CALL_FUNCTION_NAME
TOOL_CALL_FUNCTION_ARGUMENTS_JSON = ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON

TOOL_JSON_SCHEMA = ToolAttributes.TOOL_JSON_SCHEMA
PROMPT_TEMPLATE_VARIABLES = SpanAttributes.LLM_PROMPT_TEMPLATE_VARIABLES

LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
