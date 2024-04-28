#!/usr/bin/env python3
import gzip
import json
from binascii import hexlify
from random import choice, choices, randint, random
from typing import Dict, List
from urllib.parse import urljoin

import numpy as np
import phoenix.trace.v1 as pb
import requests
from faker import Faker
from google.protobuf.wrappers_pb2 import DoubleValue, StringValue
from openinference.semconv.trace import (
    DocumentAttributes,
    EmbeddingAttributes,
    MessageAttributes,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.util import types

url = "http://127.0.0.1:6004"
traces_endpoint = urljoin(url, "/v1/traces")
evals_endpoint = urljoin(url, "/v1/evaluations")

tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(traces_endpoint)))

fake = Faker()


def _gen_spans(
    tracer: trace_api.Tracer,
    recurse_depth: int = 2,
    recurse_width: int = 2,
) -> List[trace_api.SpanContext]:
    contexts = []
    status_code = choice(
        [
            trace_api.StatusCode.OK,
            trace_api.StatusCode.UNSET,
            trace_api.StatusCode.ERROR,
        ]
    )
    with tracer.start_as_current_span(fake.city()) as span:
        contexts.append(span.get_span_context())
        span.set_attributes(_gen_attributes())
        span.set_status(status_code)
        if recurse_depth:
            for _ in range(recurse_width):
                contexts.extend(
                    _gen_spans(
                        tracer,
                        randint(0, recurse_depth),
                        randint(0, recurse_width),
                    )
                )
    return contexts


def _gen_attributes() -> Dict[str, types.AttributeValue]:
    attributes = {}

    span_kind = choice(list(OpenInferenceSpanKindValues))
    attributes[SpanAttributes.OPENINFERENCE_SPAN_KIND] = span_kind.value

    attributes[SpanAttributes.INPUT_MIME_TYPE] = OpenInferenceMimeTypeValues.TEXT.value
    attributes[SpanAttributes.INPUT_VALUE] = fake.paragraph(nb_sentences=15)

    attributes[SpanAttributes.OUTPUT_MIME_TYPE] = OpenInferenceMimeTypeValues.JSON.value
    attributes[SpanAttributes.OUTPUT_VALUE] = json.dumps(
        fake.pydict(randint(0, 100), allowed_types=(float, int, str))
    )

    attributes[SpanAttributes.METADATA] = json.dumps(
        fake.pydict(randint(0, 100), allowed_types=(float, int, str)),
    )

    if span_kind is OpenInferenceSpanKindValues.LLM:
        attributes[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION] = randint(0, 1000)
        attributes[SpanAttributes.LLM_TOKEN_COUNT_PROMPT] = randint(0, 1000)
        attributes[SpanAttributes.LLM_TOKEN_COUNT_TOTAL] = (
            attributes[SpanAttributes.LLM_TOKEN_COUNT_COMPLETION]
            + attributes[SpanAttributes.LLM_TOKEN_COUNT_PROMPT]
        )
        for i in range(10):
            attributes[
                f"{SpanAttributes.LLM_INPUT_MESSAGES}.{i}.{MessageAttributes.MESSAGE_CONTENT}"
            ] = fake.paragraph(nb_sentences=15)
            attributes[
                f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.{i}.{MessageAttributes.MESSAGE_CONTENT}"
            ] = fake.paragraph(nb_sentences=15)
    elif span_kind is OpenInferenceSpanKindValues.EMBEDDING:
        for i in range(10):
            attributes[
                f"{SpanAttributes.EMBEDDING_EMBEDDINGS}.{i}.{EmbeddingAttributes.EMBEDDING_VECTOR}"
            ] = np.random.rand(2000).tolist()
    elif span_kind is OpenInferenceSpanKindValues.RETRIEVER:
        for i in range(10):
            attributes[
                f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.{i}.{DocumentAttributes.DOCUMENT_CONTENT}"
            ] = fake.paragraph(nb_sentences=50)
            attributes[
                f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.{i}.{DocumentAttributes.DOCUMENT_SCORE}"
            ] = random() * 100
            attributes[
                f"{SpanAttributes.RETRIEVAL_DOCUMENTS}.{i}.{DocumentAttributes.DOCUMENT_METADATA}"
            ] = json.dumps(
                fake.pydict(randint(0, 20), allowed_types=(float, int, str)),
            )
    return attributes


def _gen_evals(
    names: List[str],
    contexts: List[trace_api.SpanContext],
) -> None:
    for context in contexts:
        span_id = hexlify(context.span_id.to_bytes(8, "big")).decode()
        for name in choices(names, k=randint(1, len(names))):
            pb_evaluation = pb.Evaluation(
                name=name,
                subject_id=pb.Evaluation.SubjectId(span_id=span_id),
                result=pb.Evaluation.Result(
                    score=DoubleValue(value=random()),
                    explanation=StringValue(value=fake.paragraph(nb_sentences=15)),
                ),
            )
            requests.post(
                evals_endpoint,
                gzip.compress(pb_evaluation.SerializeToString()),
                headers={
                    "Content-Type": "application/x-protobuf",
                    "Content-Encoding": "gzip",
                },
            )


if __name__ == "__main__":
    tracer = tracer_provider.get_tracer(__name__)
    eval_names = [fake.country() for _ in range(10)]
    contexts = []
    for _ in range(10):
        contexts.extend(
            _gen_spans(
                tracer,
                recurse_depth=randint(2, 5),
                recurse_width=randint(2, 5),
            )
        )
    _gen_evals(eval_names, contexts)
