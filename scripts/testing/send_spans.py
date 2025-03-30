import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from queue import SimpleQueue
from random import choice, randint, random
from threading import Thread
from time import sleep
from typing import Any, Dict, Iterator, Set, Tuple, Type

import numpy as np
from faker import Faker
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
from opentelemetry import trace  # Use the default tracer provider
from opentelemetry.trace import SpanContext, Status, StatusCode, Tracer
from opentelemetry.util import types
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.otel import register
from phoenix.trace import Evaluations

logging.basicConfig(level=logging.INFO)

NUM_TRACES = 1000
GENERATE_EVALS = False

MAX_NUM_EMBEDDINGS = 2
MAX_NUM_RETRIEVAL_DOCS = 2
MAX_NUM_RERANKER_INPUT_DOCS = 2
MAX_NUM_RERANKER_OUTPUT_DOCS = 2
MAX_NUM_INPUT_MESSAGES = 2
MAX_NUM_OUTPUT_MESSAGES = 2

MAX_NUM_SENTENCES = 10

fake = Faker()

SpanKind: TypeAlias = str
EvalName: TypeAlias = str
NumDocs: TypeAlias = int

END_OF_QUEUE = None


def _get_tracer() -> Tracer:
    tracer_provider = trace.get_tracer_provider()
    return trace.get_tracer(__name__, tracer_provider=tracer_provider)


def _gen_spans(
    eval_queue: "SimpleQueue[Tuple[SpanContext, SpanKind]]",
    tracer: Tracer,
    recurse_depth: int,
    recurse_width: int,
) -> None:
    status_code = StatusCode.OK
    if random() < 0.1:
        status_code = choice([StatusCode.UNSET, StatusCode.ERROR])
    if status_code is StatusCode.ERROR:
        status = Status(status_code, fake.sentence())
    else:
        status = Status(status_code)
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
        if status_code is StatusCode.ERROR:
            exc = Exception(fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)))
            span.record_exception(exc)
        if not recurse_depth:
            return
        for _ in range(recurse_width):
            _gen_spans(
                eval_queue=eval_queue,
                tracer=tracer,
                recurse_depth=randint(0, recurse_depth),
                recurse_width=randint(0, recurse_width),
            )
    if GENERATE_EVALS:
        Thread(
            target=lambda: (
                sleep(random()),
                eval_queue.put((span.get_span_context(), num_docs)),
            ),
            daemon=True,
        ).start()


def _gen_attributes(
    span_kind: str,
    num_docs: int = 0,
) -> Iterator[Tuple[str, types.AttributeValue]]:
    yield SpanAttributes.OPENINFERENCE_SPAN_KIND, span_kind
    yield SpanAttributes.INPUT_MIME_TYPE, OpenInferenceMimeTypeValues.TEXT.value
    yield (
        SpanAttributes.INPUT_VALUE,
        fake.paragraph(nb_sentences=randint(1, MAX_NUM_SENTENCES + 1)),
    )
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
            randint(1, num_docs),
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
            randint(1, num_docs),
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
        role = choice(["user", "system", "assistant"])
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
                fake.ssn(),
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


def _gen_evals(
    queue: "SimpleQueue[Tuple[SpanContext, NumDocs]]",
    span_eval_name_and_labels: Dict[str, Set[str]],
    doc_eval_name_and_labels: Dict[str, Set[str]],
) -> None:
    # Implementation remains the same
    ...


def _send_eval_pyarrow(
    queue: "SimpleQueue[Tuple[EvalName, Dict[str, Any]]]",
    endpoint: str,
    cls: Type[Evaluations],
) -> None:
    # Implementation remains the same
    ...


def _send_eval_protos(
    queue: "SimpleQueue[pb.Evaluation]",
    endpoint: str,
) -> None:
    # Implementation remains the same
    ...


def run_test(request_rate: int = 10, test_duration: int = 60):
    """
    Run the OpenTelemetry trace generation test.

    Parameters:
    - request_rate: Number of requests per second.
    - test_duration: Duration of the test in seconds.
    """
    register()
    tracer = _get_tracer()
    eval_queue = SimpleQueue()
    end_time = time.time() + test_duration
    counter = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        while time.time() < end_time:
            start_time = time.time()
            try:
                executor.submit(
                    _gen_spans,
                    eval_queue=eval_queue,
                    tracer=tracer,
                    recurse_depth=randint(0, 3),
                    recurse_width=randint(0, 3),
                )
                counter += 1
            except Exception as e:
                logging.error(f"Error generating spans: {e}")
                raise e
            submission_time = time.time() - start_time
            sleep_time = max(1 / request_rate - submission_time, 0)
            time.sleep(sleep_time)
    logging.info(f"Generated {counter} spans")
    eval_queue.put(END_OF_QUEUE)


def main():
    run_test()


if __name__ == "__main__":
    main()
