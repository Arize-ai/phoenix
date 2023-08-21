from json import loads

import numpy as np
from langchain.chains import RetrievalQA
from langchain.chains.retrieval_qa.prompt import PROMPT as RETRIEVAL_QA_PROMPT
from langchain.embeddings.fake import FakeEmbeddings
from langchain.llms.fake import FakeListLLM
from langchain.retrievers import KNNRetriever
from opentelemetry.semconv.trace import SpanAttributes
from opentelemetry.trace import StatusCode
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer
from phoenix.trace.schemas import SpanKind
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

    spans = {span.name: span for span in tracer.get_spans()}

    trace_ids = set(span.context.trace_id for span in spans.values())
    assert len(trace_ids) == 1

    assert spans["RetrievalQA"].parent is None
    assert spans["Retriever"].parent.span_id is spans["RetrievalQA"].context.span_id
    assert spans["StuffDocumentsChain"].parent.span_id is spans["RetrievalQA"].context.span_id
    assert spans["LLMChain"].parent.span_id is spans["StuffDocumentsChain"].context.span_id
    assert spans["FakeListLLM"].parent.span_id is spans["LLMChain"].context.span_id

    assert spans["RetrievalQA"].attributes["span.kind"] is SpanKind.CHAIN.value
    assert spans["Retriever"].attributes["span.kind"] is SpanKind.RETRIEVER.value
    assert spans["StuffDocumentsChain"].attributes["span.kind"] is SpanKind.CHAIN.value
    assert spans["LLMChain"].attributes["span.kind"] is SpanKind.CHAIN.value
    assert spans["FakeListLLM"].attributes["span.kind"] is SpanKind.LLM.value

    assert spans["RetrievalQA"].status.status_code is StatusCode.OK
    assert spans["Retriever"].status.status_code is StatusCode.OK
    assert spans["StuffDocumentsChain"].status.status_code is StatusCode.OK
    assert spans["LLMChain"].status.status_code is StatusCode.OK
    assert spans["FakeListLLM"].status.status_code is StatusCode.OK

    attributes = spans["RetrievalQA"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT.value) is MimeType.TEXT.value
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT.value) is MimeType.TEXT.value
    assert attributes.get(INPUT_VALUE) is question
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["Retriever"].attributes
    assert attributes.get(INPUT_MIME_TYPE, MimeType.TEXT.value) is MimeType.TEXT.value
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON.value
    assert attributes.get(INPUT_VALUE) is question
    assert loads(attributes.get(OUTPUT_VALUE))

    attributes = spans["StuffDocumentsChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON.value
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT.value) is MimeType.TEXT.value
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer

    attributes = spans["LLMChain"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON.value
    assert attributes.get(OUTPUT_MIME_TYPE, MimeType.TEXT.value) is MimeType.TEXT.value
    assert loads(attributes.get(INPUT_VALUE))
    assert attributes.get(OUTPUT_VALUE) is answer
    assert attributes.get(LLM_PROMPT_TEMPLATE) == RETRIEVAL_QA_PROMPT.template
    assert attributes.get(LLM_PROMPT_TEMPLATE_VARIABLES) == tuple(
        RETRIEVAL_QA_PROMPT.input_variables
    )
    assert attributes.get(LLM_PROMPT_TEMPLATE_VERSION) == "unknown"

    attributes = spans["FakeListLLM"].attributes
    assert attributes.get(INPUT_MIME_TYPE) is MimeType.JSON.value
    assert attributes.get(OUTPUT_MIME_TYPE) is MimeType.JSON.value
    assert loads(attributes.get(INPUT_VALUE))
    assert loads(attributes.get(OUTPUT_VALUE))


def test_tracer_llm_with_exception() -> None:
    question = "What are the colors in a rainbow?"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=["rainbow colors"],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer()
    chain = RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[]),
        retriever=retriever,
    )
    try:
        chain.run(question, callbacks=[tracer])
    except Exception:
        pass

    spans = {span.name: span for span in tracer.get_spans()}

    assert spans["Retriever"].status.status_code is StatusCode.OK

    for name in (
        "RetrievalQA",
        "StuffDocumentsChain",
        "LLMChain",
        "FakeListLLM",
    ):
        assert spans[name].status.status_code is StatusCode.ERROR
        events = {event.name: event for event in spans[name].events}
        assert (
            events.get("exception")
            .attributes[SpanAttributes.EXCEPTION_MESSAGE]
            .startswith("IndexError")
        )


def test_tracer_retriever_with_exception() -> None:
    question = "What are the colors in a rainbow?"
    answer = "ROYGBIV"
    retriever = KNNRetriever(
        index=np.ones((1, 7)),
        texts=[],
        embeddings=FakeEmbeddings(size=7),
    )
    tracer = OpenInferenceTracer()
    chain = RetrievalQA.from_chain_type(
        llm=FakeListLLM(responses=[answer]),
        retriever=retriever,
    )
    try:
        chain.run(question, callbacks=[tracer])
    except Exception:
        pass

    spans = {span.name: span for span in tracer.get_spans()}

    for name in (
        "RetrievalQA",
        "Retriever",
    ):
        events = {event.name: event for event in spans[name].events}
        assert (
            events.get("exception")
            .attributes[SpanAttributes.EXCEPTION_MESSAGE]
            .startswith("IndexError")
        )
