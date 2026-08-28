import tarfile
from dataclasses import replace
from pathlib import Path
from typing import Iterator

import numpy as np
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span

from phoenix.experimental.datagen import Corpus, load_corpus
from phoenix.experimental.datagen.composer import SessionComposer


def test_composer_samples_whole_fragments_from_one_application(tmp_path: Path) -> None:
    corpus = _load_fixture_corpus(tmp_path, "fragment_bank")
    support = corpus.fragments[0]
    support_followup = replace(
        corpus.fragments[1],
        fragment_id="support-followup",
        archetype="plain_chat",
        domain="support",
    )
    analytics = replace(
        corpus.fragments[1],
        fragment_id="analytics",
        archetype="plain_chat",
        domain="analytics",
    )
    corpus = Corpus(
        requests=corpus.requests,
        source=corpus.source,
        fragments=(support, support_followup, analytics),
    )
    recorded = {
        trace_id: request.SerializeToString()
        for trace_id, request in corpus.requests_by_trace_id.items()
    }
    composer = SessionComposer(corpus, random=np.random.default_rng(23))

    sessions = [composer.compose(now_ns=100_000_000_000) for _ in range(20)]

    assert {session.fragments[0].domain for session in sessions} == {"support", "analytics"}
    for session in sessions:
        assert all(
            fragment.archetype == session.archetype
            and fragment.domain == session.fragments[0].domain
            for fragment in session.fragments
        )
        assert session.end_time_ns == 100_000_000_000
        assert session.start_time_ns <= min(trace.virtual_start_ns for trace in session.traces)
        for trace in session.traces:
            fragment = next(
                fragment
                for fragment in session.fragments
                if fragment.fragment_id == trace.fragment_id
            )
            assert next(_iter_spans(trace.request)).trace_id.hex() in fragment.trace_ids
    assert recorded == {
        trace_id: request.SerializeToString()
        for trace_id, request in corpus.requests_by_trace_id.items()
    }


def _load_fixture_corpus(tmp_path: Path, name: str) -> Corpus:
    source = Path(__file__).parent / "fixtures" / name
    archive = tmp_path / f"{name}.tar.gz"
    with tarfile.open(archive, "w:gz") as contents:
        contents.add(source / "fragments.jsonl", arcname="fragments.jsonl")
        contents.add(source / "traces.jsonl", arcname="traces.jsonl")
    return load_corpus(archive)


def _iter_spans(request: ExportTraceServiceRequest) -> Iterator[Span]:
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans
