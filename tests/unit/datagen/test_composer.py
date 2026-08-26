from dataclasses import replace
from pathlib import Path

import numpy as np
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.datagen import Corpus, load_corpus
from phoenix.datagen.composer import SessionComposer


def test_composer_samples_whole_same_archetype_fragments_without_replacement() -> None:
    corpus = _corpus_with_two_plain_chat_fragments()
    recorded = {
        trace_id: request.SerializeToString()
        for trace_id, request in corpus.requests_by_trace_id.items()
    }
    composer = SessionComposer(
        corpus,
        random=np.random.default_rng(7),
    )

    session = composer.compose(now_ns=100_000_000_000)

    assert session.archetype == "plain_chat"
    assert len({fragment.fragment_id for fragment in session.fragments}) == 2
    assert all(fragment.archetype == session.archetype for fragment in session.fragments)
    assert session.end_time_ns == 100_000_000_000
    assert (
        max(trace.virtual_start_ns + _duration_ns(trace.request) for trace in session.traces)
        == session.end_time_ns
    )

    traces_by_fragment = {
        fragment.fragment_id: [
            trace for trace in session.traces if trace.fragment_id == fragment.fragment_id
        ]
        for fragment in session.fragments
    }
    for fragment in session.fragments:
        assert [
            next(_iter_spans(trace.request)).trace_id.hex()
            for trace in traces_by_fragment[fragment.fragment_id]
        ] == list(fragment.trace_ids)
    first, second = session.fragments
    first_end_ns = max(
        trace.virtual_start_ns + _duration_ns(trace.request)
        for trace in traces_by_fragment[first.fragment_id]
    )
    second_start_ns = min(
        trace.virtual_start_ns for trace in traces_by_fragment[second.fragment_id]
    )
    assert 0 <= second_start_ns - first_end_ns <= 3_600_000_000_000
    assert recorded == {
        trace_id: request.SerializeToString()
        for trace_id, request in corpus.requests_by_trace_id.items()
    }


def test_composer_keeps_same_archetype_sessions_within_one_application() -> None:
    corpus = load_corpus(Path(__file__).parent / "fixtures" / "fragment_bank")
    corpus = Corpus(
        manifest=corpus.manifest,
        requests=corpus.requests,
        source=corpus.source,
        fragments=(
            corpus.fragments[0],
            replace(corpus.fragments[1], archetype="plain_chat", domain="analytics"),
        ),
    )
    composer = SessionComposer(
        corpus,
        random=np.random.default_rng(23),
    )

    sessions = [composer.compose(now_ns=100_000_000_000) for _ in range(20)]

    assert all(
        len({fragment.domain for fragment in session.fragments}) == 1 for session in sessions
    )
    assert {session.fragments[0].domain for session in sessions} == {"support", "analytics"}


def _corpus_with_two_plain_chat_fragments() -> Corpus:
    corpus = load_corpus(Path(__file__).parent / "fixtures" / "fragment_bank")
    return Corpus(
        manifest=corpus.manifest,
        requests=corpus.requests,
        source=corpus.source,
        fragments=(corpus.fragments[0], replace(corpus.fragments[1], archetype="plain_chat")),
    )


def _duration_ns(request: ExportTraceServiceRequest) -> int:
    spans = tuple(_iter_spans(request))
    return int(
        max(span.end_time_unix_nano for span in spans)
        - min(span.start_time_unix_nano for span in spans)
    )


def _iter_spans(request: ExportTraceServiceRequest):  # type: ignore[no-untyped-def]
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans
