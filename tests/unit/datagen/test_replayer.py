import dataclasses
import hashlib
from pathlib import Path
from typing import Iterator
from unittest.mock import patch

import pytest
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span, Status

from phoenix.datagen import ComposerConfig, Replayer, Scenario, load_scenario

_PROMPT_TOKENS = "llm.token_count.prompt"
_COMPLETION_TOKENS = "llm.token_count.completion"
_TOTAL_TOKENS = "llm.token_count.total"


def test_replayer_groups_trace_spans_across_jsonl_lines() -> None:
    scenario_path = Path(__file__).parent / "fixtures" / "split_trace"
    scenario = _without_fragments(load_scenario(scenario_path))

    assert len(scenario.requests) == scenario.manifest["trace_count"] == 1
    request = scenario.requests[0]
    associations = {
        (
            next(
                attribute.value.string_value
                for attribute in resource_spans.resource.attributes
                if attribute.key == "service.name"
            ),
            scope_spans.scope.name,
        )
        for resource_spans in request.resource_spans
        for scope_spans in resource_spans.scope_spans
    }
    assert associations == {
        ("root-service", "root-scope"),
        ("child-service", "child-scope"),
    }

    recorded_trace_id = next(_iter_spans(request)).trace_id
    emitted = Replayer(scenario, epsilon=0, seed=7).emit(now_ns=10_000_000_000)
    spans = tuple(_iter_spans(emitted.request))
    emitted_trace_ids = {span.trace_id for span in spans}

    assert len(spans) == scenario.manifest["span_count"] == 2
    assert len(emitted_trace_ids) == 1
    assert recorded_trace_id not in emitted_trace_ids
    root = next(span for span in spans if span.name == "root")
    child = next(span for span in spans if span.name == "child")
    assert child.parent_span_id == root.span_id


def test_replayer_rewrites_identity_and_time_while_preserving_structure() -> None:
    scenario = _fixture_scenario()
    one_trace_scenario = Scenario(
        manifest=scenario.manifest,
        requests=scenario.requests[:1],
        source=scenario.source,
    )
    original_spans = tuple(_iter_spans(scenario.requests[0]))
    replayer = Replayer(one_trace_scenario, epsilon=0, seed=7)

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

    session_replayer = Replayer(scenario, epsilon=0, seed=7)
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


@pytest.mark.parametrize("seed", range(10))
def test_replayer_preserves_temporal_and_token_contracts_across_seeds(seed: int) -> None:
    scenario = _fixture_scenario()
    replayer = Replayer(scenario, epsilon=0, seed=seed)

    for _ in range(scenario.manifest["trace_count"]):
        spans = tuple(_iter_spans(replayer.emit(now_ns=10_000_000_000).request))
        spans_by_id = {span.span_id: span for span in spans}
        for span in spans:
            if parent := spans_by_id.get(span.parent_span_id):
                assert parent.end_time_unix_nano > span.end_time_unix_nano
            _assert_token_contract(span)


def test_replayer_rebases_events_and_preserves_dangling_parent() -> None:
    scenario = _fixture_scenario()
    request = ExportTraceServiceRequest()
    request.CopyFrom(scenario.requests[0])
    recorded_spans = tuple(_iter_spans(request))
    recorded_first_start = min(span.start_time_unix_nano for span in recorded_spans)
    recorded_root = next(span for span in recorded_spans if span.name == "turn-1")
    recorded_child = next(span for span in recorded_spans if span.name == "chat")
    recorded_parent_id = b"\xff" * 8
    recorded_root.parent_span_id = recorded_parent_id
    early_event_time = recorded_child.start_time_unix_nano + 1
    late_event_time = recorded_child.end_time_unix_nano
    recorded_child.events.add(name="early", time_unix_nano=early_event_time)
    recorded_child.events.add(name="late", time_unix_nano=late_event_time)
    one_trace_scenario = Scenario(
        manifest=scenario.manifest,
        requests=(request,),
        source=scenario.source,
    )

    now_ns = 10_000_000_000
    spans = tuple(
        _iter_spans(Replayer(one_trace_scenario, epsilon=0, seed=7).emit(now_ns=now_ns).request)
    )
    emitted_root = next(span for span in spans if span.name == "turn-1")
    emitted_child = next(span for span in spans if span.name == "chat")
    emitted_span_ids = {span.span_id for span in spans}
    event_times = [event.time_unix_nano for event in emitted_child.events]
    time_offset = now_ns - recorded_first_start

    assert emitted_root.parent_span_id
    assert emitted_root.parent_span_id != recorded_parent_id
    assert emitted_root.parent_span_id not in emitted_span_ids
    assert event_times == [
        early_event_time + time_offset,
        min(late_event_time + time_offset, emitted_child.end_time_unix_nano),
    ]
    assert all(
        emitted_child.start_time_unix_nano <= event_time <= emitted_child.end_time_unix_nano
        for event_time in event_times
    )


def test_same_seed_emits_equal_numeric_draws_with_disjoint_trace_ids() -> None:
    scenario = _fixture_scenario()
    first = Replayer(scenario, epsilon=0.25, seed=7)
    second = Replayer(scenario, epsilon=0.25, seed=7)

    first_requests = tuple(
        first.emit(now_ns=10_000_000_000).request for _ in range(scenario.manifest["trace_count"])
    )
    second_requests = tuple(
        second.emit(now_ns=10_000_000_000).request for _ in range(scenario.manifest["trace_count"])
    )

    first_trace_ids = {span.trace_id for request in first_requests for span in _iter_spans(request)}
    second_trace_ids = {
        span.trace_id for request in second_requests for span in _iter_spans(request)
    }
    assert first_trace_ids.isdisjoint(second_trace_ids)
    assert [_numeric_draws(request) for request in first_requests] == [
        _numeric_draws(request) for request in second_requests
    ]


def test_flat_schedule_preserves_serialized_request_digest() -> None:
    scenario = _fixture_scenario()
    with patch(
        "phoenix.datagen.replayer.secrets.token_hex",
        return_value="00112233445566778899aabbccddeeff",
    ):
        replayer = Replayer(scenario, epsilon=0.25, seed=7, error_rate=0)

    digest = hashlib.sha256()
    for index in range(6):
        emitted = replayer.emit(now_ns=10_000_000_000 + index * 1_000_000_000)
        digest.update(emitted.request.SerializeToString(deterministic=True))
        replayer.interarrival_seconds(rate=12.5, burstiness=0.7)

    assert digest.hexdigest() == "091fb569b16228818b88e0d8d4315a1f4013df135e9a885359a0fb376c30d3e2"


def test_replayer_sets_project_resource_attribute() -> None:
    scenario = _fixture_scenario()
    for request in scenario.requests:
        for resource_spans in request.resource_spans:
            attribute = resource_spans.resource.attributes.add(key=ResourceAttributes.PROJECT_NAME)
            attribute.value.string_value = "recorded-project"

    emitted = Replayer(scenario, epsilon=0, seed=7, project_name="configured-project").emit(
        now_ns=10_000_000_000
    )

    assert {
        attribute.value.string_value
        for resource_spans in emitted.request.resource_spans
        for attribute in resource_spans.resource.attributes
        if attribute.key == ResourceAttributes.PROJECT_NAME
    } == {"configured-project"}

    default_emitted = Replayer(_fixture_scenario(), epsilon=0, seed=7).emit(now_ns=10_000_000_000)
    assert {
        attribute.value.string_value
        for resource_spans in default_emitted.request.resource_spans
        for attribute in resource_spans.resource.attributes
        if attribute.key == ResourceAttributes.PROJECT_NAME
    } == {"phoenix-datagen"}


def test_replayer_composes_backdated_fragment_sessions_with_fresh_identities() -> None:
    scenario = load_scenario(Path(__file__).parent / "fixtures" / "fragment_bank")
    for request in scenario.requests:
        for span in _iter_spans(request):
            attribute = span.attributes.add(key="input.value")
            attribute.value.string_value = f"recorded:{span.name}"
    recorded_trace_ids = {
        span.trace_id for request in scenario.requests for span in _iter_spans(request)
    }
    replayer = Replayer(
        scenario,
        epsilon=0,
        seed=7,
        composer_config=ComposerConfig(
            session_fragments_median=2,
            session_fragments_sigma=0,
            session_fragments_max=2,
            archetype_mix={"plain_chat": 1},
            fragment_gap_median_seconds=5,
            fragment_gap_sigma=0,
            fragment_gap_max_seconds=5,
        ),
    )
    wall_time_ns = 100_000_000_000

    emissions = tuple(
        replayer.emit(now_ns=wall_time_ns + index * 1_000_000_000) for index in range(4)
    )
    spans_by_emission = [tuple(_iter_spans(emission.request)) for emission in emissions]

    assert [spans[0].name for spans in spans_by_emission] == [
        "turn-1",
        "turn-2",
        "turn-1",
        "turn-2",
    ]
    session_ids = {_attribute(span, "session.id") for spans in spans_by_emission for span in spans}
    assert len(session_ids) == 1
    assert session_ids != {"session-a"}
    emitted_trace_ids = {span.trace_id for spans in spans_by_emission for span in spans}
    assert len(emitted_trace_ids) == 4
    assert emitted_trace_ids.isdisjoint(recorded_trace_ids)
    assert [_attribute(span, "input.value") for spans in spans_by_emission for span in spans] == [
        "recorded:turn-1",
        "recorded:chat",
        "recorded:turn-2",
        "recorded:turn-1",
        "recorded:chat",
        "recorded:turn-2",
    ]
    trace_starts = [min(span.start_time_unix_nano for span in spans) for spans in spans_by_emission]
    assert [start - trace_starts[0] for start in trace_starts] == [
        0,
        2_000_000_000,
        7_600_000_000,
        9_600_000_000,
    ]
    assert (
        max(span.end_time_unix_nano for spans in spans_by_emission for span in spans)
        <= wall_time_ns
    )
    for spans in (spans_by_emission[0], spans_by_emission[2]):
        root = next(span for span in spans if span.name == "turn-1")
        child = next(span for span in spans if span.name == "chat")
        assert child.parent_span_id == root.span_id

    next_session = replayer.emit(now_ns=wall_time_ns + 20_000_000_000)
    assert {
        _attribute(span, "session.id") for span in _iter_spans(next_session.request)
    } != session_ids


def test_contamination_labels_match_anomaly_ground_truth() -> None:
    replayer = Replayer(_fixture_scenario(), epsilon=1, seed=11)
    emitted = replayer.emit(now_ns=10_000_000_000)

    spans = tuple(_iter_spans(emitted.request))
    labeled_ids = {
        (span.trace_id.hex(), span.span_id.hex())
        for span in spans
        if _attribute(span, "datagen.anomaly") is True
    }
    assert {anomaly.run_nonce for anomaly in emitted.anomalies} == {replayer.run_nonce}
    assert {anomaly.kind for anomaly in emitted.anomalies} == {"token_inflation"}
    anomaly_ids = {(anomaly.trace_id, anomaly.span_id) for anomaly in emitted.anomalies}
    assert labeled_ids == anomaly_ids
    assert len(labeled_ids) == len(spans)
    spans_by_id = {(span.trace_id.hex(), span.span_id.hex()): span for span in spans}
    for anomaly in emitted.anomalies:
        span = spans_by_id[(anomaly.trace_id, anomaly.span_id)]
        inflated_fields = anomaly.inflated_fields
        assert inflated_fields[_PROMPT_TOKENS] == _attribute(span, _PROMPT_TOKENS)
        assert inflated_fields[_COMPLETION_TOKENS] == _attribute(span, _COMPLETION_TOKENS)
        assert inflated_fields[_TOTAL_TOKENS] == _attribute(span, _TOTAL_TOKENS)
        assert (
            inflated_fields["latency_ms"]
            == (span.end_time_unix_nano - span.start_time_unix_nano) / 1_000_000
        )
    assert all(
        not any(attribute.key.startswith("llm.cost.") for attribute in span.attributes)
        for span in spans
    )


def test_replayer_injects_seeded_errors_and_records_typed_ground_truth() -> None:
    scenario = _fixture_scenario()
    tool_span = next(_iter_spans(scenario.requests[1]))
    next(
        attribute
        for attribute in tool_span.attributes
        if attribute.key == "openinference.span.kind"
    ).value.string_value = "TOOL"
    tool_span.events.add(name="exception", time_unix_nano=tool_span.end_time_unix_nano)
    recorded_outputs = {}
    for request in scenario.requests:
        for span in _iter_spans(request):
            if _attribute(span, "openinference.span.kind") in {"LLM", "TOOL"}:
                output = f"recorded output for {span.name}"
                span.attributes.add(key="output.value").value.string_value = output
                recorded_outputs[span.name] = output

    replayer = Replayer(scenario, epsilon=1, seed=17, error_rate=1)
    emissions = [
        replayer.emit(now_ns=10_000_000_000 + index * 1_000_000_000)
        for index in range(scenario.manifest["trace_count"])
    ]

    spans = tuple(span for emission in emissions for span in _iter_spans(emission.request))
    spans_by_id = {(span.trace_id.hex(), span.span_id.hex()): span for span in spans}
    eligible_spans = {
        span_id: span
        for span_id, span in spans_by_id.items()
        if _attribute(span, "openinference.span.kind") in {"LLM", "TOOL"}
    }
    anomalies = [anomaly for emission in emissions for anomaly in emission.anomalies]
    error_records = [anomaly for anomaly in anomalies if anomaly.kind == "error_injection"]
    token_records = [anomaly for anomaly in anomalies if anomaly.kind == "token_inflation"]

    assert {(record.trace_id, record.span_id) for record in error_records} == set(eligible_spans)
    assert {(record.trace_id, record.span_id) for record in token_records} == set(spans_by_id)
    assert all(record.inflated_fields == {} for record in error_records)
    for span_id, span in eligible_spans.items():
        exception_events = [event for event in span.events if event.name == "exception"]
        assert len(exception_events) == 1
        assert {
            attribute.key: attribute.value.string_value
            for attribute in exception_events[0].attributes
        } == {
            "exception.type": "PhoenixDatagenReplayError",
            "exception.message": "Synthetic replay error",
            "exception.stacktrace": "PhoenixDatagenReplayError: Synthetic replay error",
        }
        assert span.status.code == Status.STATUS_CODE_ERROR
        assert _attribute(span, "output.value") == recorded_outputs[span.name]
        assert {
            record.kind
            for record in anomalies
            if (record.trace_id, record.span_id) == span_id
        } == {"token_inflation", "error_injection"}

    propagated_parent = next(span for span in spans if span.name == "turn-1")
    assert propagated_parent.status.code == Status.STATUS_CODE_ERROR
    assert not [event for event in propagated_parent.events if event.name == "exception"]
    assert not [
        record
        for record in error_records
        if (record.trace_id, record.span_id)
        == (propagated_parent.trace_id.hex(), propagated_parent.span_id.hex())
    ]

    first = Replayer(_fixture_scenario(), epsilon=0, seed=23, error_rate=0.2)
    second = Replayer(_fixture_scenario(), epsilon=0, seed=23, error_rate=0.2)
    first_hits = [bool(first.emit(now_ns=30_000_000_000).anomalies) for _ in range(1_000)]
    second_hits = [bool(second.emit(now_ns=30_000_000_000).anomalies) for _ in range(1_000)]
    assert first_hits == second_hits
    assert abs(sum(first_hits) / len(first_hits) - 0.2) < 0.04


@pytest.mark.parametrize("error_rate", [-0.01, 1.01])
def test_replayer_rejects_invalid_error_rate(error_rate: float) -> None:
    with pytest.raises(ValueError, match="error_rate must be between 0 and 1"):
        Replayer(_fixture_scenario(), error_rate=error_rate)


def _fixture_scenario() -> Scenario:
    return _without_fragments(load_scenario(Path(__file__).parent / "fixtures" / "scenario"))


def _without_fragments(scenario: Scenario) -> Scenario:
    """Drop fragments so Replayer skips session composition."""
    return dataclasses.replace(scenario, fragments=())


def _iter_spans(request: ExportTraceServiceRequest) -> Iterator[Span]:
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans


def _attribute(span: Span, key: str):  # type: ignore[no-untyped-def]
    attribute = next(attribute for attribute in span.attributes if attribute.key == key)
    value_type = attribute.value.WhichOneof("value")
    assert value_type is not None
    return getattr(attribute.value, value_type)


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


def _numeric_draws(
    request: ExportTraceServiceRequest,
) -> list[tuple[str, int, tuple[int | None, ...], bool]]:
    draws: list[tuple[str, int, tuple[int | None, ...], bool]] = []
    for span in _iter_spans(request):
        attributes = {attribute.key: attribute.value for attribute in span.attributes}
        draws.append(
            (
                span.name,
                span.end_time_unix_nano - span.start_time_unix_nano,
                tuple(
                    attributes[key].int_value if key in attributes else None
                    for key in (_PROMPT_TOKENS, _COMPLETION_TOKENS, _TOTAL_TOKENS)
                ),
                attributes["datagen.anomaly"].bool_value
                if "datagen.anomaly" in attributes
                else False,
            )
        )
    return draws
