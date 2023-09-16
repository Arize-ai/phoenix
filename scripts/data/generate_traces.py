#!/usr/bin/env python3

import itertools
import json
import random
from datetime import timedelta
from typing import Dict, List, Optional
from uuid import uuid4

import numpy as np
from faker import Faker
from phoenix.trace.schemas import (
    AttributeValue,
    Span,
    SpanContext,
    SpanConversationAttributes,
    SpanEvent,
    SpanException,
    SpanKind,
    SpanStatusCode,
)
from phoenix.trace.semantic_conventions import (
    DOCUMENT_CONTENT,
    DOCUMENT_ID,
    DOCUMENT_METADATA,
    DOCUMENT_SCORE,
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_TEXT,
    EMBEDDING_VECTOR,
    INPUT_VALUE,
    LLM_INVOCATION_PARAMETERS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_TOTAL,
    OUTPUT_VALUE,
    RETRIEVAL_DOCUMENTS,
    TOOL_DESCRIPTION,
    TOOL_NAME,
    TOOL_PARAMETERS,
)
from phoenix.trace.span_json_encoder import spans_to_jsonl

fake = Faker()


def generate_trace(num_spans: int) -> List[Span]:
    """
    Generate a trace of n Spans with random data, where each span is the parent of the next one.

    Parameters
    ----------
    num_spans : int
        The number of spans to generate.

    Returns
    -------
    list of Span
        A list of n Spans with random data.
    """
    if num_spans <= 0:
        return []

    trace_id = uuid4()
    conversation_id = uuid4()

    spans: List[Span] = []
    for i in range(num_spans):
        parent_id = spans[-1].context.span_id if spans else None
        start_time = (spans[-1].end_time if spans else fake.date_time_this_year()) + timedelta(
            seconds=random.randint(1, 10)
        )
        end_time = start_time + timedelta(seconds=random.randint(1, 600))
        span_id = uuid4()
        span_kind = random.choice(list(SpanKind) + [None])
        attributes: Dict[str, AttributeValue] = {}
        if random.random() < 0.7:
            attributes.update(fake.pydict(allowed_types=(float, int, str)))
        if span_kind is SpanKind.LLM:
            if random.random() < 0.7:
                attributes[LLM_INVOCATION_PARAMETERS] = json.dumps(
                    fake.pydict(allowed_types=(float, int, str))
                )
            if random.random() < 0.7:
                token_count_total = random.randint(100, 10_000)
                token_count_prompt = int(token_count_total * random.random())
                token_count_completion = token_count_total - token_count_prompt
                attributes.update(
                    {
                        LLM_TOKEN_COUNT_TOTAL: token_count_total,
                        LLM_TOKEN_COUNT_PROMPT: token_count_prompt,
                        LLM_TOKEN_COUNT_COMPLETION: token_count_completion,
                    }
                )
        if span_kind is SpanKind.RETRIEVER:
            documents = []
            for _ in range(random.randint(0, 10)):
                document = {DOCUMENT_ID: fake.pystr()}
                if random.random() < 0.7:
                    document[DOCUMENT_CONTENT] = fake.paragraph(nb_sentences=20)
                if random.random() < 0.7:
                    document[DOCUMENT_SCORE] = fake.pyfloat()
                if random.random() < 0.7:
                    document[DOCUMENT_METADATA] = fake.pydict(allowed_types=(float, int, str))
                documents.append(document)
            if documents:
                attributes[RETRIEVAL_DOCUMENTS] = documents

        if span_kind is SpanKind.EMBEDDING:
            embeddings = []
            for _ in range(random.randint(0, 10)):
                embedding = {}
                if random.random() < 0.7:
                    embedding[EMBEDDING_MODEL_NAME] = fake.sentence()
                if random.random() < 0.7:
                    embedding[EMBEDDING_TEXT] = fake.paragraph()
                if random.random() < 0.7:
                    embedding[EMBEDDING_VECTOR] = list(np.random.random(2000))
                embeddings.append(embedding)
            if embeddings:
                attributes[EMBEDDING_EMBEDDINGS] = embeddings
        if span_kind is SpanKind.TOOL:
            if random.random() < 0.7:
                attributes[TOOL_NAME] = "-".join(fake.words())
            if random.random() < 0.7:
                attributes[TOOL_DESCRIPTION] = fake.paragraph()
            if random.random() < 0.7:
                attributes[TOOL_PARAMETERS] = fake.pydict(allowed_types=(float, int, str))
        events = [
            SpanEvent(
                name=f"event_{j}",
                attributes={"message": f"message_{j}"},
                timestamp=start_time + timedelta(seconds=j),
            )
            for j in range(random.randint(1, 5))
        ]
        if random.random() < 0.2:
            status_code = SpanStatusCode.ERROR
            status_message = "Error occurred"
            events.append(
                SpanException(
                    message=fake.sentence(),
                    timestamp=end_time,
                )
            )
        else:
            status_code = random.choice([SpanStatusCode.UNSET, SpanStatusCode.OK, None])
            status_message = "OK" if status_code == SpanStatusCode.OK else ""
        span = Span(
            name=f"span_{span_id}",
            context=SpanContext(trace_id=trace_id, span_id=span_id),
            span_kind=span_kind,
            parent_id=parent_id,
            start_time=start_time,
            end_time=end_time,
            status_code=status_code,
            status_message=status_message,
            attributes=attributes,
            events=events,
            conversation=SpanConversationAttributes(conversation_id=conversation_id),
        )
        spans.append(span)

    for span in spans:
        if random.random() < 0.2:
            object.__setattr__(span, "end_time", None)
        if random.random() < 0.5:
            span.attributes[INPUT_VALUE] = fake.sentence()
        if random.random() < 0.5:
            span.attributes[OUTPUT_VALUE] = fake.sentence()

    return spans


def generate_traces(
    num_traces: int, min_trace_length: Optional[int] = None, max_trace_length: Optional[int] = None
) -> List[Span]:
    """
    Generate a flat list of Spans from i traces, where each trace contains a
    random number of Spans in the range.

    Parameters
    ----------
    i : int
        The number of traces to generate.

    Returns
    -------
    list of Span
        A flat list of Spans .
    """
    min_trace_length = min_trace_length if min_trace_length else 3
    max_trace_length = max_trace_length if max_trace_length else 8
    traces = [
        generate_trace(random.randint(min_trace_length, max_trace_length))
        for _ in range(num_traces)
    ]
    return list(itertools.chain.from_iterable(traces))
    return [
        span
        for _ in range(num_traces)
        for span in (generate_trace(random.randint(min_trace_length, max_trace_length)))
    ]


def main() -> None:
    # generate traces
    spans = generate_traces(num_traces=50, min_trace_length=3, max_trace_length=5)

    # serialize each span to ndjson
    jsonl_str = spans_to_jsonl(spans)

    # print the jsonl to stdout
    print(jsonl_str)


if __name__ == "__main__":
    main()
