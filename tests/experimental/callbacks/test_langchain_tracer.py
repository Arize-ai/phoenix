import numpy as np
from langchain.chains import RetrievalQA
from langchain.embeddings.fake import FakeEmbeddings
from langchain.llms.fake import FakeListLLM
from langchain.retrievers import KNNRetriever
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer
from phoenix.trace.schemas import SpanKind, SpanStatusCode


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

    spans = {span.name: span for span in tracer.spans}
    assert 1 == len(set(span.context.trace_id for span in spans.values()))

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
