import asyncio
import logging
from dataclasses import field
from datetime import datetime, timezone
from itertools import islice
from typing import Any, Iterable, Iterator, Optional, TypeVar, Union

import strawberry
from openinference.semconv.trace import SpanAttributes
from pydantic import ValidationError
from sqlalchemy import select
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import TypeAlias, assert_never

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import (
    SupportedSQLDialect,
    get_dataset_example_revisions,
    insert_experiment_with_examples_snapshot,
)
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.annotation_configs import CategoricalOutputConfig
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.evaluators import (
    EvaluationResult as EvaluationResultDict,
)
from phoenix.server.api.evaluators import (
    create_llm_evaluator_from_inline,
    evaluation_result_to_model,
    evaluation_result_to_span_annotation,
    get_builtin_evaluator_by_key,
    get_evaluator_project_ids,
    get_evaluators,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.dataset_helpers import get_experiment_example_output
from phoenix.server.api.helpers.evaluators import (
    get_evaluator_output_configs,
    validate_evaluator_prompt_and_configs,
)
from phoenix.server.api.helpers.message_helpers import (
    PlaygroundMessage,
    build_template_variables,
    create_playground_message,
    extract_and_convert_example_messages,
    prompt_chat_template_to_playground_messages,
)
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    get_playground_client,
    initialize_playground_clients,
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
from phoenix.server.api.input_types.ModelClientOptionsInput import (
    BuiltinClientOptionsInput,
    ModelClientOptionsInput,
    OpenAIApiType,
)
from phoenix.server.api.input_types.PromptTemplateOptions import PromptTemplateOptions
from phoenix.server.api.mutations.evaluator_mutations import (
    _convert_output_config_inputs_to_pydantic,
)
from phoenix.server.api.subscriptions import (
    _default_playground_experiment_name,
)
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import BuiltInEvaluator, DatasetEvaluator
from phoenix.server.api.types.ExperimentRunAnnotation import ExperimentRunAnnotation
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.server.experiments.utils import generate_experiment_project_name
from phoenix.trace.attributes import get_attribute_value
from phoenix.tracers import Tracer

logger = logging.getLogger(__name__)

initialize_playground_clients()

ExampleRowID: TypeAlias = int
RepetitionNumber: TypeAlias = int


@strawberry.type
class ChatCompletionFunctionCall:
    name: str
    arguments: str


@strawberry.type
class ChatCompletionToolCall:
    id: str
    function: ChatCompletionFunctionCall


@strawberry.type
class EvaluationResult:
    evaluator_name: str
    annotation: Optional[ExperimentRunAnnotation] = None
    trace: Optional[Trace] = None
    error: Optional[str] = None


@strawberry.type
class ChatCompletionRepetition:
    repetition_number: int
    content: Optional[str]
    tool_calls: list[ChatCompletionToolCall]
    span: Optional[Span]
    error_message: Optional[str]
    evaluations: list[EvaluationResult] = field(default_factory=list)


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
    async def chat_completion_over_dataset(
        cls,
        info: Info[Context, None],
        input: ChatCompletionOverDatasetInput,
    ) -> ChatCompletionOverDatasetMutationPayload:
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
            llm_client = await get_playground_client(
                model_provider=input.prompt_version.model_provider.to_model_provider(),
                model_name=input.prompt_version.model_name,
                custom_provider_id=input.prompt_version.resolved_custom_provider_id(),
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
                client_options=input.client_options,
            )
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
                repetitions=input.repetitions,
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

        # Pre-extract appended messages for each revision if path is specified
        appended_messages_by_revision: dict[int, list[PlaygroundMessage]] = {}
        if input.appended_messages_path:
            for revision in revisions:
                try:
                    appended_messages_by_revision[revision.id] = (
                        extract_and_convert_example_messages(
                            revision.input, input.appended_messages_path
                        )
                    )
                except (KeyError, TypeError, ValueError):
                    # If extraction fails, store empty list; error will surface when processing
                    appended_messages_by_revision[revision.id] = []

        # Pre-compute template variables for each revision based on template_variables_path
        template_variables_by_revision: dict[int, dict[str, Any]] = {}
        for revision in revisions:
            try:
                template_variables_by_revision[revision.id] = build_template_variables(
                    input_data=revision.input,
                    output_data=revision.output,
                    metadata=revision.metadata_,
                    template_variables_path=input.template_variables_path,
                )
            except (KeyError, TypeError, ValueError):
                # If extraction fails, store empty dict; error will surface when formatting
                template_variables_by_revision[revision.id] = {}

        for batch in _get_batches(unbatched_items, batch_size):
            batch_results = await asyncio.gather(
                *(
                    cls._chat_completion(
                        info,
                        llm_client,
                        ChatCompletionInput(
                            client_options=input.client_options,
                            prompt_version=input.prompt_version,
                            credentials=input.credentials,
                            template=PromptTemplateOptions(
                                format=input.prompt_version.template_format,
                                variables=template_variables_by_revision[revision.id],
                            ),
                            prompt_name=input.prompt_name,
                            repetitions=repetition_number,
                            evaluators=input.evaluators,
                        ),
                        repetition_number=repetition_number,
                        project_name=project_name,
                        appended_messages=appended_messages_by_revision.get(revision.id),
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
                        task_output=get_experiment_example_output(db_span),
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

        evaluations: dict[tuple[ExampleRowID, RepetitionNumber], list[EvaluationResult]] = {}
        if input.evaluators:
            dataset_evaluator_ids = [
                from_global_id_with_expected_type(evaluator.id, DatasetEvaluator.__name__)
                for evaluator in input.evaluators
            ]
            async with info.context.db() as session:
                evaluators = await get_evaluators(
                    dataset_evaluator_ids=dataset_evaluator_ids,
                    session=session,
                    decrypt=info.context.decrypt,
                    credentials=input.credentials,
                )
                project_ids = await get_evaluator_project_ids(
                    dataset_evaluator_ids=dataset_evaluator_ids,
                    session=session,
                )
            for (revision, repetition_number), experiment_run in zip(
                unbatched_items, experiment_runs
            ):
                if experiment_run.error:
                    continue  # skip runs that errored out
                evaluation_key = (revision.dataset_example_id, repetition_number)
                evaluations[evaluation_key] = []

                context_dict: dict[str, Any] = {
                    "input": revision.input,
                    "reference": revision.output,
                    "output": experiment_run.output.get("task_output", experiment_run.output),
                    "metadata": revision.metadata_,
                }

                for evaluator, evaluator_input, project_id in zip(
                    evaluators, input.evaluators, project_ids
                ):
                    name = str(evaluator_input.name)
                    configs = get_evaluator_output_configs(evaluator_input, evaluator)
                    tracer: Tracer | None = None
                    if input.tracing_enabled:
                        tracer = Tracer(span_cost_calculator=info.context.span_cost_calculator)

                    eval_results: list[EvaluationResultDict] = await evaluator.evaluate(
                        context=context_dict,
                        input_mapping=evaluator_input.input_mapping.to_orm(),
                        name=name,
                        output_configs=configs,
                        tracer=tracer,
                    )

                    trace: Trace | None = None
                    if tracer is not None:
                        async with info.context.db() as session:
                            db_traces = tracer.get_db_traces(project_id=project_id)
                            session.add_all(db_traces)
                            await session.flush()
                        if db_traces:
                            db_trace = db_traces[0]
                            trace = Trace(id=db_trace.id, db_record=db_trace)
                            for eval_result in eval_results:
                                eval_result["trace_id"] = db_trace.trace_id

                    for eval_result in eval_results:
                        if eval_result["error"] is None:
                            annotation_model = evaluation_result_to_model(
                                eval_result,
                                experiment_run_id=experiment_run.id,
                            )
                            async with info.context.db() as session:
                                session.add(annotation_model)
                        evaluations[evaluation_key].append(
                            _to_evaluation_result(eval_result, name, trace=trace)
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
        async with info.context.db() as session:
            llm_client = await get_playground_client(
                model_provider=input.prompt_version.model_provider.to_model_provider(),
                model_name=input.prompt_version.model_name,
                custom_provider_id=input.prompt_version.resolved_custom_provider_id(),
                session=session,
                decrypt=info.context.decrypt,
                credentials=input.credentials,
                client_options=input.client_options,
            )
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
        evaluations_by_repetition: dict[int, list[EvaluationResult]] = {}
        if input.evaluators:
            async with info.context.db() as session:
                evaluators = await get_evaluators(
                    dataset_evaluator_ids=[
                        from_global_id_with_expected_type(evaluator.id, DatasetEvaluator.__name__)
                        for evaluator in input.evaluators
                    ],
                    session=session,
                    decrypt=info.context.decrypt,
                    credentials=input.credentials,
                )
            for repetition_number, result in enumerate(results, start=1):
                if isinstance(result, BaseException):
                    continue  # skip failed completions
                repetition, db_span = result
                if repetition.error_message:
                    continue  # skip repetitions in which the task errored out
                evaluations_by_repetition[repetition_number] = []

                context_dict: dict[str, Any] = {
                    "input": get_attribute_value(db_span.attributes, LLM_INPUT_MESSAGES),
                    "output": get_attribute_value(db_span.attributes, LLM_OUTPUT_MESSAGES),
                }

                for evaluator, evaluator_input in zip(evaluators, input.evaluators):
                    name = str(evaluator_input.name)
                    configs = get_evaluator_output_configs(evaluator_input, evaluator)
                    eval_results: list[EvaluationResultDict] = await evaluator.evaluate(
                        context=context_dict,
                        input_mapping=evaluator_input.input_mapping.to_orm(),
                        name=name,
                        output_configs=configs,
                    )

                    for eval_result in eval_results:
                        if eval_result["error"] is None:
                            annotation_model = evaluation_result_to_span_annotation(
                                eval_result,
                                span_rowid=db_span.id,
                            )
                            async with info.context.db() as session:
                                session.add(annotation_model)
                        evaluations_by_repetition[repetition_number].append(
                            _to_evaluation_result(eval_result, name)
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

    @classmethod
    async def _chat_completion(
        cls,
        info: Info[Context, None],
        llm_client: "PlaygroundStreamingClient[Any]",
        input: ChatCompletionInput,
        repetition_number: int,
        project_name: str = PLAYGROUND_PROJECT_NAME,
        project_description: str = "Traces from prompt playground",
        appended_messages: Optional[list[PlaygroundMessage]] = None,
    ) -> tuple[ChatCompletionRepetition, models.Span]:
        messages = prompt_chat_template_to_playground_messages(input.prompt_version.template)
        if template_options := input.template:
            messages = list(_formatted_messages(messages, template_options))

        # Append messages from dataset example if provided
        if appended_messages:
            messages.extend(appended_messages)

        invocation_parameters = dict(input.prompt_version.invocation_parameters)

        tools = input.prompt_version.tools.to_orm() if input.prompt_version.tools else None
        response_format = (
            input.prompt_version.response_format.to_orm()
            if input.prompt_version.response_format
            else None
        )

        text_content = ""
        tool_calls: dict[str, ChatCompletionToolCall] = {}
        error_message: Optional[str] = None
        tracer = Tracer(span_cost_calculator=info.context.span_cost_calculator)
        try:
            async for chunk in llm_client.chat_completion_create(
                messages=messages,
                tools=tools,
                response_format=response_format,
                invocation_parameters=invocation_parameters,
                tracer=tracer,
            ):
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
            error_message = str(e)
        stmt = select(models.Project.id).where(models.Project.name == project_name)
        async with info.context.db() as session:
            project_id = await session.scalar(stmt)
            if project_id is None:
                dialect = SupportedSQLDialect(session.bind.dialect.name)
                project_id = await session.scalar(
                    insert_on_conflict(
                        {"name": project_name, "description": project_description},
                        table=models.Project,
                        dialect=dialect,
                        unique_by=["name"],
                        on_conflict=OnConflict.DO_NOTHING,
                    ).returning(models.Project.id)
                )
            if project_id is None:
                project_id = await session.scalar(stmt)
            db_traces = tracer.get_db_traces(project_id=project_id)
            session.add_all(db_traces)

        db_trace = db_traces[0]
        db_span = db_trace.spans[0]
        gql_span = Span(id=db_span.id, db_record=db_span)
        info.context.event_queue.put(SpanInsertEvent(ids=(project_id,)))

        if error_message is not None:
            repetition = ChatCompletionRepetition(
                repetition_number=repetition_number,
                content=None,
                tool_calls=[],
                span=gql_span,
                error_message=error_message,
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
        return repetition, db_span


def _formatted_messages(
    messages: Iterable[PlaygroundMessage],
    template_options: PromptTemplateOptions,
) -> Iterator[PlaygroundMessage]:
    """
    Formats the messages using the given template options.
    """
    messages_list = list(messages)
    if not messages_list:
        return iter([])
    template_formatter = get_template_formatter(template_format=template_options.format)
    result: list[PlaygroundMessage] = []
    for msg in messages_list:
        formatted_content = template_formatter.format(msg["content"], **template_options.variables)
        result.append(
            create_playground_message(
                msg["role"],
                formatted_content,
                msg.get("tool_call_id"),
                msg.get("tool_calls"),
            )
        )
    return iter(result)


_AnyT = TypeVar("_AnyT")


def _get_batches(
    iterable: Iterable[_AnyT],
    batch_size: int,
) -> Iterator[list[_AnyT]]:
    """Splits an iterable into batches not exceeding a specified size."""
    iterator = iter(iterable)
    while batch := list(islice(iterator, batch_size)):
        yield batch


LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES
