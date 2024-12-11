import asyncio
from dataclasses import asdict, field
from datetime import datetime, timezone
from itertools import chain, islice
from traceback import format_exc
from typing import Any, Iterable, Iterator, List, Optional, TypeVar, Union

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
from sqlalchemy import insert, select
from strawberry.relay import GlobalID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.datetime_utils import local_now, normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import get_dataset_example_revisions
from phoenix.server.api.auth import IsLocked, IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, CustomGraphQLError, NotFound
from phoenix.server.api.helpers.dataset_helpers import get_dataset_example_output
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    initialize_playground_clients,
)
from phoenix.server.api.helpers.playground_registry import PLAYGROUND_CLIENT_REGISTRY
from phoenix.server.api.helpers.playground_spans import (
    input_value_and_mime_type,
    llm_input_messages,
    llm_invocation_parameters,
    llm_model_name,
    llm_span_kind,
    llm_tools,
)
from phoenix.server.api.input_types.ChatCompletionInput import (
    ChatCompletionInput,
    ChatCompletionOverDatasetInput,
)
from phoenix.server.api.input_types.TemplateOptions import TemplateOptions
from phoenix.server.api.subscriptions import (
    _default_playground_experiment_description,
    _default_playground_experiment_metadata,
    _default_playground_experiment_name,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    TextChunk,
    ToolCallChunk,
)
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Span import Span, to_gql_span
from phoenix.server.api.types.TemplateLanguage import TemplateLanguage
from phoenix.server.dml_event import SpanInsertEvent
from phoenix.trace.attributes import unflatten
from phoenix.trace.schemas import SpanException
from phoenix.utilities.json import jsonify
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    NoOpFormatter,
    TemplateFormatter,
)

initialize_playground_clients()

ChatCompletionMessage = tuple[ChatCompletionMessageRole, str, Optional[str], Optional[List[Any]]]


@strawberry.type
class ChatCompletionFunctionCall:
    name: str
    arguments: str


@strawberry.type
class ChatCompletionToolCall:
    id: str
    function: ChatCompletionFunctionCall


@strawberry.type
class ChatCompletionMutationPayload:
    content: Optional[str]
    tool_calls: List[ChatCompletionToolCall]
    span: Span
    error_message: Optional[str]


@strawberry.type
class ChatCompletionMutationError:
    message: str


@strawberry.type
class ChatCompletionOverDatasetMutationExamplePayload:
    dataset_example_id: GlobalID
    experiment_run_id: GlobalID
    result: Union[ChatCompletionMutationPayload, ChatCompletionMutationError]


@strawberry.type
class ChatCompletionOverDatasetMutationPayload:
    dataset_id: GlobalID
    dataset_version_id: GlobalID
    experiment_id: GlobalID
    examples: list[ChatCompletionOverDatasetMutationExamplePayload] = field(default_factory=list)


@strawberry.type
class ChatCompletionMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    @classmethod
    async def chat_completion_over_dataset(
        cls,
        info: Info[Context, None],
        input: ChatCompletionOverDatasetInput,
    ) -> ChatCompletionOverDatasetMutationPayload:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"Unknown LLM provider: '{provider_key.value}'")
        try:
            llm_client = llm_client_class(
                model=input.model,
                api_key=input.api_key,
            )
        except CustomGraphQLError:
            raise
        except Exception as error:
            raise BadRequest(
                f"Failed to connect to LLM API for {provider_key.value} {input.model.name}: "
                f"{str(error)}"
            )
        dataset_id = from_global_id_with_expected_type(input.dataset_id, Dataset.__name__)
        dataset_version_id = (
            from_global_id_with_expected_type(
                global_id=input.dataset_version_id, expected_type_name=DatasetVersion.__name__
            )
            if input.dataset_version_id
            else None
        )
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
            revisions = [
                revision
                async for revision in await session.stream_scalars(
                    get_dataset_example_revisions(resolved_version_id).order_by(
                        models.DatasetExampleRevision.id
                    )
                )
            ]
            if not revisions:
                raise NotFound("No examples found for the given dataset and version")
            experiment = models.Experiment(
                dataset_id=from_global_id_with_expected_type(input.dataset_id, Dataset.__name__),
                dataset_version_id=resolved_version_id,
                name=input.experiment_name or _default_playground_experiment_name(),
                description=input.experiment_description
                or _default_playground_experiment_description(dataset_name=dataset.name),
                repetitions=1,
                metadata_=input.experiment_metadata
                or _default_playground_experiment_metadata(
                    dataset_name=dataset.name,
                    dataset_id=input.dataset_id,
                    version_id=GlobalID(DatasetVersion.__name__, str(resolved_version_id)),
                ),
                project_name=PLAYGROUND_PROJECT_NAME,
            )
            session.add(experiment)
            await session.flush()

        results = []
        batch_size = 3
        start_time = datetime.now(timezone.utc)
        for batch in _get_batches(revisions, batch_size):
            batch_results = await asyncio.gather(
                *(
                    cls._chat_completion(
                        info,
                        llm_client,
                        ChatCompletionInput(
                            model=input.model,
                            api_key=input.api_key,
                            messages=input.messages,
                            tools=input.tools,
                            invocation_parameters=input.invocation_parameters,
                            template=TemplateOptions(
                                language=input.template_language,
                                variables=revision.input,
                            ),
                        ),
                    )
                    for revision in batch
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
        for revision, result in zip(revisions, results):
            if isinstance(result, BaseException):
                experiment_run = models.ExperimentRun(
                    experiment_id=experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    output={},
                    repetition_number=1,
                    start_time=start_time,
                    end_time=start_time,
                    error=str(result),
                )
            else:
                db_span = result.span.db_span
                experiment_run = models.ExperimentRun(
                    experiment_id=experiment.id,
                    dataset_example_id=revision.dataset_example_id,
                    trace_id=str(result.span.context.trace_id),
                    output=models.ExperimentRunOutput(
                        task_output=get_dataset_example_output(db_span),
                    ),
                    prompt_token_count=db_span.cumulative_llm_token_count_prompt,
                    completion_token_count=db_span.cumulative_llm_token_count_completion,
                    repetition_number=1,
                    start_time=result.span.start_time,
                    end_time=result.span.end_time,
                    error=str(result.error_message) if result.error_message else None,
                )
            experiment_runs.append(experiment_run)

        async with info.context.db() as session:
            session.add_all(experiment_runs)
            await session.flush()

        for revision, experiment_run, result in zip(revisions, experiment_runs, results):
            dataset_example_id = GlobalID(
                models.DatasetExample.__name__, str(revision.dataset_example_id)
            )
            experiment_run_id = GlobalID(models.ExperimentRun.__name__, str(experiment_run.id))
            example_payload = ChatCompletionOverDatasetMutationExamplePayload(
                dataset_example_id=dataset_example_id,
                experiment_run_id=experiment_run_id,
                result=result
                if isinstance(result, ChatCompletionMutationPayload)
                else ChatCompletionMutationError(message=str(result)),
            )
            payload.examples.append(example_payload)
        return payload

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsLocked])  # type: ignore
    @classmethod
    async def chat_completion(
        cls, info: Info[Context, None], input: ChatCompletionInput
    ) -> ChatCompletionMutationPayload:
        provider_key = input.model.provider_key
        llm_client_class = PLAYGROUND_CLIENT_REGISTRY.get_client(provider_key, input.model.name)
        if llm_client_class is None:
            raise BadRequest(f"Unknown LLM provider: '{provider_key.value}'")
        try:
            llm_client = llm_client_class(
                model=input.model,
                api_key=input.api_key,
            )
        except CustomGraphQLError:
            raise
        except Exception as error:
            raise BadRequest(
                f"Failed to connect to LLM API for {provider_key.value} {input.model.name}: "
                f"{str(error)}"
            )
        return await cls._chat_completion(info, llm_client, input)

    @classmethod
    async def _chat_completion(
        cls,
        info: Info[Context, None],
        llm_client: PlaygroundStreamingClient,
        input: ChatCompletionInput,
    ) -> ChatCompletionMutationPayload:
        attributes: dict[str, Any] = {}

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
        attributes.update(
            chain(
                llm_span_kind(),
                llm_model_name(input.model.name),
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
                    select(models.Project.id).where(models.Project.name == PLAYGROUND_PROJECT_NAME)
                )
            ) is None:
                project_id = await session.scalar(
                    insert(models.Project)
                    .returning(models.Project.id)
                    .values(
                        name=PLAYGROUND_PROJECT_NAME,
                        description="Traces from prompt playground",
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

        gql_span = to_gql_span(span)

        info.context.event_queue.put(SpanInsertEvent(ids=(project_id,)))

        if status_code is StatusCode.ERROR:
            return ChatCompletionMutationPayload(
                content=None,
                tool_calls=[],
                span=gql_span,
                error_message=status_message,
            )
        else:
            return ChatCompletionMutationPayload(
                content=text_content if text_content else None,
                tool_calls=list(tool_calls.values()),
                span=gql_span,
                error_message=None,
            )


def _formatted_messages(
    messages: Iterable[ChatCompletionMessage],
    template_options: TemplateOptions,
) -> Iterator[ChatCompletionMessage]:
    """
    Formats the messages using the given template options.
    """
    template_formatter = _template_formatter(template_language=template_options.language)
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


def _template_formatter(template_language: TemplateLanguage) -> TemplateFormatter:
    """
    Instantiates the appropriate template formatter for the template language.
    """
    if template_language is TemplateLanguage.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_language is TemplateLanguage.F_STRING:
        return FStringTemplateFormatter()
    if template_language is TemplateLanguage.NONE:
        return NoOpFormatter()
    assert_never(template_language)


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


PLAYGROUND_PROJECT_NAME = "playground"
