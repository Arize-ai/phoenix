import tarfile
from dataclasses import replace
from pathlib import Path
from typing import Iterator

import numpy as np
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span

from phoenix.experimental.datagen import Corpus, Replayer, load_corpus

_PROMPT_TOKENS = "llm.token_count.prompt"
_COMPLETION_TOKENS = "llm.token_count.completion"
_TOTAL_TOKENS = "llm.token_count.total"
_NOW_NS = 1_000_000_000_000_000


def test_replayer_emits_varied_coherent_sessions(tmp_path: Path) -> None:
    corpus = _load_fixture_corpus(tmp_path, "replay")
    request = corpus.requests[0]
    fragment = replace(corpus.fragments[0], trace_ids=(corpus.fragments[0].trace_ids[0],))
    corpus = Corpus(requests=(request,), source=corpus.source, fragments=(fragment,))
    recorded = request.SerializeToString()
    recorded_spans = tuple(_iter_spans(request))
    recorded_trace_id = recorded_spans[0].trace_id
    recorded_durations = {
        span.name: span.end_time_unix_nano - span.start_time_unix_nano for span in recorded_spans
    }
    replayer = Replayer(
        corpus,
        project_name="configured-project",
        _random=np.random.default_rng(7),
    )

    emissions = [replayer.emit(now_ns=_NOW_NS + index * 1_000_000_000) for index in range(30)]
    spans_by_emission = [tuple(_iter_spans(emission)) for emission in emissions]
    session_ids = [str(_attribute(spans[0], "session.id")) for spans in spans_by_emission]

    assert len(set(session_ids)) >= 2
    assert all(
        {_attribute(span, "session.id") for span in spans} == {session_id}
        for spans, session_id in zip(spans_by_emission, session_ids)
    )
    trace_ids = [next(iter({span.trace_id for span in spans})) for spans in spans_by_emission]
    assert len(set(trace_ids)) == len(trace_ids)
    assert recorded_trace_id not in trace_ids
    assert (
        len({min(span.start_time_unix_nano for span in spans) for spans in spans_by_emission}) > 1
    )
    for index, (emission, spans) in enumerate(zip(emissions, spans_by_emission)):
        root = next(span for span in spans if span.name == "turn-1")
        child = next(span for span in spans if span.name == "chat")
        assert max(span.end_time_unix_nano for span in spans) <= (_NOW_NS + index * 1_000_000_000)
        assert child.parent_span_id == root.span_id
        assert root.end_time_unix_nano > child.end_time_unix_nano
        assert child.start_time_unix_nano - root.start_time_unix_nano == 100_000_000
        assert all(
            _resource_attribute(resource_spans, ResourceAttributes.PROJECT_NAME)
            == "configured-project"
            for resource_spans in emission.resource_spans
        )
        for span in spans:
            assert (
                span.end_time_unix_nano - span.start_time_unix_nano != recorded_durations[span.name]
            )
            _assert_token_contract(span)
    first_emitted = spans_by_emission[0][0]
    first_recorded = recorded_spans[0]
    assert _attribute(first_emitted, _PROMPT_TOKENS) != _attribute(first_recorded, _PROMPT_TOKENS)
    assert _attribute(first_emitted, _COMPLETION_TOKENS) != _attribute(
        first_recorded, _COMPLETION_TOKENS
    )
    assert request.SerializeToString() == recorded
    assert replayer.interarrival_seconds(rate=12, burstiness=0) == 5
    assert replayer.interarrival_seconds(rate=12, burstiness=0.5) > 0


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


def _attribute(span: Span, key: str):  # type: ignore[no-untyped-def]
    attribute = next(attribute for attribute in span.attributes if attribute.key == key)
    value_type = attribute.value.WhichOneof("value")
    assert value_type is not None
    return getattr(attribute.value, value_type)


def _resource_attribute(resource_spans, key: str):  # type: ignore[no-untyped-def]
    attribute = next(
        attribute for attribute in resource_spans.resource.attributes if attribute.key == key
    )
    return attribute.value.string_value


def _assert_token_contract(span: Span) -> None:
    attributes = {attribute.key: attribute.value for attribute in span.attributes}
    token_keys = (_PROMPT_TOKENS, _COMPLETION_TOKENS, _TOTAL_TOKENS)
    if not any(key in attributes for key in token_keys):
        return
    assert all(attributes[key].WhichOneof("value") == "int_value" for key in token_keys)
    assert (
        attributes[_PROMPT_TOKENS].int_value + attributes[_COMPLETION_TOKENS].int_value
        == attributes[_TOTAL_TOKENS].int_value
    )
