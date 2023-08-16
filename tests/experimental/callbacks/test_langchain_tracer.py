from json import loads
from uuid import UUID

import numpy as np
from langchain.chains import RetrievalQA
from langchain.chains.retrieval_qa.prompt import PROMPT as RETRIEVAL_QA_PROMPT
from langchain.embeddings.fake import FakeEmbeddings
from langchain.llms.fake import FakeListLLM
from langchain.retrievers import KNNRetriever
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer
from phoenix.trace.schemas import SpanKind, SpanStatusCode
from phoenix.trace.semantic_conventions import (
    INPUT_MIME_TYPE,
    INPUT_VALUE,
    LLM_PROMPT_TEMPLATE,
    LLM_PROMPT_TEMPLATE_VARIABLES,
    LLM_PROMPT_TEMPLATE_VERSION,
    OUTPUT_MIME_TYPE,
    OUTPUT_VALUE,
    MimeType,
)
from phoenix.trace.span_json_decoder import json_string_to_span
from phoenix.trace.span_json_encoder import span_to_json


def test_tracer_llm() -> None:
    question = "What are the colors in a rainbow?"
    answer = "ROYGBIV"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=["rainbow colors"],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer()
    RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[answer]),
        retriever=retriever,
    ).run(question, callbacks=[tracer])

    spans = {span.name: span for span in tracer.span_buffer}

    trace_ids = set(span.context.trace_id for span in spans.values())
    assert len(trace_ids) == 1
    assert UUID(str(next(iter(trace_ids))))

    assert spans["RetrievalQA"].parent_id is None
    assert spans["Retriever"].parent_id is spans["RetrievalQA"].context.span_id
    assert spans["StuffDocumentsChain"].parent_id is spans["RetrievalQA"].context.span_id
    assert spans["LLMChain"].parent_id is spans["StuffDocumentsChain"].context.span_id
    assert spans["FakeListLLM"].parent_id is spans["LLMChain"].context.span_id

    assert spans["RetrievalQA"].span_kind is SpanKind.CHAIN
    assert spans["Retriever"].span_kind is SpanKind.RETRIEVER
    assert spans["StuffDocumentsChain"].span_kind is SpanKind.CHAIN
    assert spans["LLMChain"].span_kind is SpanKind.CHAIN
    assert spans["FakeListLLM"].span_kind is SpanKind.LLM

    assert spans["RetrievalQA"].status_code is SpanStatusCode.OK
    assert spans["Retriever"].status_code is SpanStatusCode.OK
    assert spans["StuffDocumentsChain"].status_code is SpanStatusCode.OK
    assert spans["LLMChain"].status_code is SpanStatusCode.OK
    assert spans["FakeListLLM"].status_code is SpanStatusCode.OK

    attributes = spans["RetrievalQA"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(INPUT_VALUE) is question
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["Retriever"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(INPUT_VALUE) is question
    assert loads(attributes.get(OUTPUT_VALUE))

    attributes = spans["StuffDocumentsChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["LLMChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT) is MimeType.TEXT
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer
    assert attributes.get(LLM_PROMPT_TEMPLATE) == RETRIEVAL_QA_PROMPT.template
    assert attributes.get(LLM_PROMPT_TEMPLATE_VARIABLES) == RETRIEVAL_QA_PROMPT.input_variables
    assert attributes.get(LLM_PROMPT_TEMPLATE_VERSION) == "unknown"

    attributes = spans["FakeListLLM"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON
    assert loads(attributes.get(INPUT_VALUE))
    assert loads(attributes.get(OUTPUT_VALUE))

    for span in spans.values():
        assert json_string_to_span(span_to_json(span)) == span
