import json
import os
import warnings
from typing import Any, Dict, Iterator, List, Tuple
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from httpx import AsyncClient, ConnectError
from openinference.semconv.trace import (
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
)

from chat.types import FeedbackRequest, Message, MessagesPayload, MessagesResponse

COLLECTOR_HOST = os.getenv("COLLECTOR_HOST", "localhost")
endpoint = f"http://{COLLECTOR_HOST}:6006/v1"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(
    SimpleSpanProcessor(OTLPSpanExporter(f"{endpoint}/traces"))
)
trace_api.set_tracer_provider(tracer_provider)
tracer = trace_api.get_tracer(__name__)


def getenv_or_raise(key: str) -> str:
    if not (value := os.getenv(key)):
        raise ValueError(f"Please set the {key} environment variable.")
    return value


OPENAI_API_KEY = getenv_or_raise("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL = "gpt-4"

http_client = AsyncClient()
app = FastAPI()


class OpenAIException(HTTPException):
    pass


@app.post("/messages/")
async def messages(messages_payload: MessagesPayload) -> MessagesResponse:
    messages = messages_payload.messages
    invocation_parameters = {"temperature": 0.1}
    openai_payload = {
        "model": OPENAI_MODEL,
        **invocation_parameters,
        "messages": [message.model_dump() for message in messages],
    }
    with tracer.start_as_current_span("OpenAI Async Chat Completion") as span:
        for attribute_key, attribute_value in (
            *_llm_span_kind_attributes(),
            *_llm_model_name_attributes(OPENAI_MODEL),
            *_llm_invocation_parameters_attributes(invocation_parameters),
            *_input_attributes(openai_payload),
            *_llm_input_messages_attributes(messages),
        ):
            span.set_attribute(attribute_key, attribute_value)
        response = await http_client.post(
            OPENAI_API_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            json=openai_payload,
        )
        if not (200 <= response.status_code < 300):
            raise OpenAIException(
                status_code=500, detail=response.content.decode("utf-8")
            )
        span.set_status(trace_api.StatusCode.OK)
        response_data = response.json()
        assistant_message_content = response_data["choices"][0]["message"]["content"]
        message_uuid = str(uuid4())
        assistant_message = Message(
            role="assistant",
            content=assistant_message_content,
            uuid=message_uuid,
        )
        for (
            attribute_key,
            attribute_value,
        ) in (
            *_output_attributes(response_data),
            *_llm_output_message_attributes(assistant_message),
            *_llm_token_usage_attributes(response_data),
        ):
            span.set_attribute(attribute_key, attribute_value)
        span_id = span.get_span_context().span_id.to_bytes(8, "big").hex()
        assistant_message.span_id = span_id

    return MessagesResponse(message=assistant_message)


@app.post("/feedback/")
async def post_feedback(feedback_request: FeedbackRequest) -> None:
    if feedback_request.feedback == 1:
        label = "👍"
    elif feedback_request.feedback == 0:
        label = "👎"

    request_body = {
        "data": [
            {
                "span_id": feedback_request.span_id,
                "name": "user_feedback",
                "annotator_kind": "HUMAN",
                "result": {"label": label, "score": feedback_request.feedback},
                "metadata": {},
            }
        ]
    }

    try:
        await http_client.post(
            f"{endpoint}/span_annotations",
            json=request_body,
        )
    except ConnectError:
        warnings.warn("Could not connect to Phoenix server.")


def _llm_span_kind_attributes() -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference span kind attribute for LLMs.
    """
    yield SpanAttributes.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKindValues.LLM.value


def _llm_model_name_attributes(model_name: str) -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference model name attribute.
    """
    yield SpanAttributes.LLM_MODEL_NAME, model_name


def _llm_invocation_parameters_attributes(
    invocation_parameters: Dict[str, Any],
) -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference invocation parameters attribute as a JSON string.
    """
    yield SpanAttributes.LLM_INVOCATION_PARAMETERS, json.dumps(invocation_parameters)


def _input_attributes(payload: Any) -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference input value attribute as a JSON string if the
    payload can be serialized as JSON, otherwise as a string.
    """
    try:
        yield SpanAttributes.INPUT_VALUE, json.dumps(payload)
        yield SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
    except json.JSONDecodeError:
        yield SpanAttributes.INPUT_VALUE, str(payload)
        yield SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value


def _llm_input_messages_attributes(
    messages: List[Message],
) -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference input messages attributes for each message in the list.
    """
    for messages_index, message in enumerate(messages):
        yield (
            f"{SpanAttributes.LLM_INPUT_MESSAGES}.{messages_index}.{MessageAttributes.MESSAGE_ROLE}",
            message.role,
        )
        yield (
            f"{SpanAttributes.LLM_INPUT_MESSAGES}.{messages_index}.{MessageAttributes.MESSAGE_CONTENT}",
            message.content,
        )


def _output_attributes(payload: Any) -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference output value attribute as a JSON string if the
    payload can be serialized as JSON, otherwise as a string.
    """
    try:
        yield SpanAttributes.OUTPUT_VALUE, json.dumps(payload)
        yield SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
    except json.JSONDecodeError:
        yield SpanAttributes.OUTPUT_VALUE, str(payload)
        yield SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value


def _llm_output_message_attributes(message: Message) -> Iterator[Tuple[str, str]]:
    """
    Yields the OpenInference output message attributes.
    """
    yield (
        f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_ROLE}",
        message.role,
    )
    yield (
        f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0.{MessageAttributes.MESSAGE_CONTENT}",
        message.content,
    )


def _llm_token_usage_attributes(
    response_data: Dict[str, Any],
) -> Iterator[Tuple[str, int]]:
    """
    Parses and yields token usage attributes from the response data.
    """
    if not isinstance((usage := response_data.get("usage")), dict):
        return
    if prompt_tokens := usage.get("prompt_tokens"):
        yield SpanAttributes.LLM_TOKEN_COUNT_PROMPT, prompt_tokens
    if completion_tokens := usage.get("completion_tokens"):
        yield SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, completion_tokens
    if total_tokens := usage.get("total_tokens"):
        yield SpanAttributes.LLM_TOKEN_COUNT_TOTAL, total_tokens
