#!/usr/bin/env python3
import json
from concurrent.futures import ThreadPoolExecutor
from itertools import cycle, islice
from random import choice, randint, random
from time import sleep
from typing import Iterator, List, Tuple
from urllib.parse import urljoin

import numpy as np
from faker import Faker
from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import (
    DocumentAttributes,
    EmbeddingAttributes,
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    RerankerAttributes,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as GrpcOTLPSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as HttpOTLPSpanExporter,
)
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.util import types
from typing_extensions import TypeAlias

url = "http://127.0.0.1:6006"
grpc_endpoint = "http://127.0.0.1:4317"
traces_endpoint = urljoin(url, "/v1/traces")

NUM_TRACES = 1000

MAX_NUM_EMBEDDINGS = 20
MAX_NUM_RETRIEVAL_DOCS = 20
MAX_NUM_RERANKER_INPUT_DOCS = 20
MAX_NUM_RERANKER_OUTPUT_DOCS = 20
MAX_NUM_INPUT_MESSAGES = 20
MAX_NUM_OUTPUT_MESSAGES = 20

MAX_NUM_SENTENCES = 100

fake = Faker()

SpanKind: TypeAlias = str


def _get_tracers(project_names: List[str]) -> Iterator[trace_api.Tracer]:
    for project_name in cycle(project_names):
        tracer_provider = trace_sdk.TracerProvider(
            resource=Resource({ResourceAttributes.PROJECT_NAME: project_name}),
            span_limits=trace_sdk.SpanLimits(max_attributes=100_000),
        )
        exporter = (
            GrpcOTLPSpanExporter(grpc_endpoint)
            if random() < 0.5
            else HttpOTLPSpanExporter(traces_endpoint)
        )
        processor = (
            SimpleSpanProcessor(exporter) if random() < 0.5 else BatchSpanProcessor(exporter)
        )
        tracer_provider.add_span_processor(processor)
        yield tracer_provider.get_tracer(__name__)


def _gen_spans(
    tracer: trace_api.Tracer,
    recurse_depth: int,
    recurse_width: int,
) -> None:
    status_code = trace_api.StatusCode.OK
    if random() < 0.1:
        status_code = choice([trace_api.StatusCode.UNSET, trace_api.StatusCode.ERROR])
    if status_code is trace_api.StatusCode.ERROR:
        status = trace_api.Status(status_code, fake.sentence())
    else:
        status = trace_api.Status(status_code)
    name = fake.city()
    with tracer.start_as_current_span(name) as span:
        span_kind = (
            choice(list(OpenInferenceSpanKindValues)).value
            if random() < 0.99
            else "".join(fake.emoji() for _ in range(5))
        )
        num_docs = 0
        if span_kind == OpenInferenceSpanKindValues.RETRIEVER.value:
            num_docs = randint(1, MAX_NUM_RETRIEVAL_DOCS + 1)
        elif span_kind == OpenInferenceSpanKindValues.RERANKER.value:
            num_docs = randint(1, MAX_NUM_RERANKER_OUTPUT_DOCS + 1)
        span.set_attributes(dict(_gen_attributes(span_kind, num_docs)))
        span.set_status(status)
        if status_code is trace_api.StatusCode.ERROR:
            exc = Exception(fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)))
            span.record_exception(exc)
        sleep(random())
        if not recurse_depth:
            return
        for _ in range(recurse_width):
            _gen_spans(
                tracer=tracer,
                recurse_depth=randint(0, recurse_depth),
                recurse_width=randint(0, recurse_width),
            )


def _gen_attributes(
    span_kind: str,
    num_docs: int = 0,
) -> Iterator[Tuple[str, types.AttributeValue]]:
    yield SpanAttributes.OPENINFERENCE_SPAN_KIND, span_kind
    yield SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value
    yield SpanAttributes.INPUT_VALUE, fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1))
    yield SpanAttributes.OUTPUT_MIME_TYPE, OpenInferenceMimeTypeValues.JSON.value
    yield (
        SpanAttributes.OUTPUT_VALUE,
        json.dumps(fake.pydict(randint(0, 100), allowed_types=(float, int, str))),
    )
    yield (
        SpanAttributes.METADATA,
        json.dumps(fake.pydict(randint(0, 10), allowed_types=(float, int, str))),
    )
    if span_kind == OpenInferenceSpanKindValues.LLM.value:
        yield from _gen_llm(
            randint(1, MAX_NUM_INPUT_MESSAGES + 1),
            randint(1, MAX_NUM_OUTPUT_MESSAGES + 1),
        )
    elif span_kind == OpenInferenceSpanKindValues.EMBEDDING.value:
        yield SpanAttributes.EMBEDDING_MODEL_NAME, fake.color_name()
        yield from _gen_embeddings(randint(1, MAX_NUM_EMBEDDINGS + 1))
    elif span_kind == OpenInferenceSpanKindValues.RETRIEVER.value:
        yield from _gen_documents(
            num_docs,
            SpanAttributes.RETRIEVAL_DOCUMENTS,
        )
    elif span_kind == OpenInferenceSpanKindValues.RERANKER.value:
        yield RerankerAttributes.RERANKER_QUERY, fake.sentence(randint(1, 10))
        yield RerankerAttributes.RERANKER_MODEL_NAME, fake.color_name()
        yield from _gen_documents(
            randint(1, MAX_NUM_RERANKER_INPUT_DOCS + 1),
            RerankerAttributes.RERANKER_INPUT_DOCUMENTS,
        )
        yield from _gen_documents(
            num_docs,
            RerankerAttributes.RERANKER_OUTPUT_DOCUMENTS,
        )
    elif span_kind == OpenInferenceSpanKindValues.TOOL.value:
        ...
    elif span_kind == OpenInferenceSpanKindValues.AGENT.value:
        ...


def _gen_llm(
    n_input_messages: int,
    n_output_messages: int,
) -> Iterator[Tuple[str, types.AttributeValue]]:
    tcc, tcp = randint(0, 1000), randint(0, 1000)
    yield SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, tcc
    yield SpanAttributes.LLM_TOKEN_COUNT_PROMPT, tcp
    yield SpanAttributes.LLM_TOKEN_COUNT_TOTAL, tcc + tcp
    yield (
        SpanAttributes.LLM_INVOCATION_PARAMETERS,
        json.dumps(fake.pydict(randint(0, 10), allowed_types=(float, int, str))),
    )
    yield from _gen_messages(n_input_messages, SpanAttributes.LLM_INPUT_MESSAGES)
    yield from _gen_messages(n_output_messages, SpanAttributes.LLM_OUTPUT_MESSAGES)


def _gen_messages(
    n: int,
    prefix: str,
) -> Iterator[Tuple[str, types.AttributeValue]]:
    for i in range(n):
        role = choice(["user", "system", "assistant", "tool"])
        yield f"{prefix}.{i}.{MessageAttributes.MESSAGE_ROLE}", role
        if role == "assistant" and random() < 0.25:
            for j in range(randint(1, 10)):
                tool_call_prefix = f"{prefix}.{i}.{MessageAttributes.MESSAGE_TOOL_CALLS}"
                yield (
                    f"{tool_call_prefix}.{j}.{ToolCallAttributes.TOOL_CALL_FUNCTION_NAME}",
                    fake.job(),
                )
                yield (
                    f"{tool_call_prefix}.{j}.{ToolCallAttributes.TOOL_CALL_FUNCTION_ARGUMENTS_JSON}",
                    json.dumps(fake.pydict(randint(0, 10), allowed_types=(float, int, str))),
                )
            continue
        # Generate tool role messages with dict/list content to test rendering
        if role == "tool":
            # Randomly choose between different tool return types to test rendering
            if random() < 0.5:
                # Generate list-style tool return as space-joined string
                yield (
                    f"{prefix}.{i}.{MessageAttributes.MESSAGE_CONTENT}",
                    " ".join(fake.word() for _ in range(randint(1, 10))),
                )
            else:
                # Regular string content
                yield (
                    f"{prefix}.{i}.{MessageAttributes.MESSAGE_CONTENT}",
                    fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)),
                )
        else:
            yield (
                f"{prefix}.{i}.{MessageAttributes.MESSAGE_CONTENT}",
                fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)),
            )


def _gen_embeddings(n: int = 10) -> Iterator[Tuple[str, types.AttributeValue]]:
    prefix = SpanAttributes.EMBEDDING_EMBEDDINGS
    for i in range(n):
        yield (
            f"{prefix}.{i}.{EmbeddingAttributes.EMBEDDING_VECTOR}",
            np.random.rand(2000).tolist(),
        )
        yield (
            f"{prefix}.{i}.{EmbeddingAttributes.EMBEDDING_TEXT}",
            fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)),
        )


def _gen_documents(
    n: int = 10,
    prefix: str = SpanAttributes.RETRIEVAL_DOCUMENTS,
) -> Iterator[Tuple[str, types.AttributeValue]]:
    for i in range(n):
        yield (
            f"{prefix}.{i}.{DocumentAttributes.DOCUMENT_CONTENT}",
            fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)),
        )
        if random() < 0.8:
            yield (
                f"{prefix}.{i}.{DocumentAttributes.DOCUMENT_ID}",
                fake.sbn9(),
            )
        if random() < 0.6:
            yield (
                f"{prefix}.{i}.{DocumentAttributes.DOCUMENT_SCORE}",
                (random() - 0.5) * 100,
            )
        if random() < 0.4:
            yield (
                f"{prefix}.{i}.{DocumentAttributes.DOCUMENT_METADATA}",
                json.dumps(fake.pydict(randint(0, 10), allowed_types=(float, int, str))),
            )


if __name__ == "__main__":
    project_names = [fake.company() for _ in range(2)]
    tracers = list(islice(_get_tracers(project_names), len(project_names) * 10))
    with ThreadPoolExecutor() as executor:
        for _ in range(NUM_TRACES):
            executor.submit(
                _gen_spans,
                tracer=choice(tracers),
                recurse_depth=randint(2, 5),
                recurse_width=randint(2, 5),
            )
