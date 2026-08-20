import json
from pathlib import Path

from opentelemetry.proto.trace.v1.trace_pb2 import Span

from phoenix.datagen import AnomalyManifest, Corpus, Replayer, load_corpus


def test_replayer_rewrites_identity_and_time_while_preserving_structure() -> None:
    corpus = _fixture_corpus()
    one_trace_corpus = Corpus(
        manifest=corpus.manifest,
        requests=corpus.requests[:1],
        source=corpus.source,
    )
    original_spans = tuple(_iter_spans(corpus.requests[0]))
    replayer = Replayer(one_trace_corpus, epsilon=0, seed=7)

    emitted = replayer.emit(now_ns=10_000_000_000)
    spans = tuple(_iter_spans(emitted.request))

    assert {span.trace_id for span in spans} != {span.trace_id for span in original_spans}
    assert len({span.trace_id for span in spans}) == 1
    assert len({span.span_id for span in spans}) == len(spans)
    assert min(span.start_time_unix_nano for span in spans) == 10_000_000_000
    assert {span.name: span.start_time_unix_nano for span in spans} == {
        "turn-1": 10_000_000_000,
        "chat": 10_100_000_000,
    }
    root = next(span for span in spans if span.name == "turn-1")
    child = next(span for span in spans if span.name == "chat")
    assert child.parent_span_id == root.span_id
    session_ids = {_attribute(span, "session.id") for span in spans}
    assert len(session_ids) == 1
    assert session_ids != {"session-a"}

    session_replayer = Replayer(corpus, epsilon=0, seed=7)
    scheduled = [session_replayer.emit(now_ns=10_000_000_000) for _ in range(3)]
    emitted_names = [next(_iter_spans(emission.request)).name for emission in scheduled]
    assert emitted_names.index("turn-1") < emitted_names.index("turn-2")
    assert emitted_names.index("other-session") < emitted_names.index("turn-2")
    emitted_session_ids = {
        span.name: _attribute(span, "session.id")
        for emission in scheduled
        for span in _iter_spans(emission.request)
    }
    assert emitted_session_ids["turn-1"] == emitted_session_ids["turn-2"]
    assert emitted_session_ids["turn-1"] != emitted_session_ids["other-session"]


def test_contamination_labels_match_anomaly_manifest(tmp_path: Path) -> None:
    replayer = Replayer(_fixture_corpus(), epsilon=1, seed=11)
    emitted = replayer.emit(now_ns=10_000_000_000)
    manifest_path = tmp_path / "anomalies.jsonl"

    AnomalyManifest(manifest_path).write(emitted.anomalies)

    spans = tuple(_iter_spans(emitted.request))
    labeled_ids = {
        (span.trace_id.hex(), span.span_id.hex())
        for span in spans
        if _attribute(span, "datagen.anomaly") is True
    }
    manifest_rows = [json.loads(line) for line in manifest_path.read_text().splitlines()]
    manifest_ids = {(row["trace_id"], row["span_id"]) for row in manifest_rows}
    assert labeled_ids == manifest_ids
    assert len(labeled_ids) == len(spans)
    assert all("latency_ms" in row["inflated_fields"] for row in manifest_rows)
    assert all(
        not any(attribute.key.startswith("llm.cost.") for attribute in span.attributes)
        for span in spans
    )


def _fixture_corpus() -> Corpus:
    return load_corpus(Path(__file__).parent / "fixtures" / "corpus")


def _iter_spans(request):  # type: ignore[no-untyped-def]
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans


def _attribute(span: Span, key: str):  # type: ignore[no-untyped-def]
    attribute = next(attribute for attribute in span.attributes if attribute.key == key)
    value_type = attribute.value.WhichOneof("value")
    return getattr(attribute.value, value_type)
