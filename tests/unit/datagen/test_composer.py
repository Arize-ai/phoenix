from dataclasses import replace
from pathlib import Path

import numpy as np
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.datagen import ComposerConfig, Scenario, SessionComposer, load_scenario


def test_composer_samples_whole_same_archetype_fragments_without_replacement() -> None:
    scenario = _scenario_with_two_plain_chat_fragments()
    recorded = {
        trace_id: request.SerializeToString()
        for trace_id, request in scenario.requests_by_trace_id.items()
    }
    composer = SessionComposer(
        scenario,
        config=ComposerConfig(
            session_fragments_median=2,
            session_fragments_sigma=0,
            session_fragments_max=2,
            archetype_mix={"plain_chat": 1},
            fragment_gap_median_seconds=5,
            fragment_gap_sigma=0,
            fragment_gap_max_seconds=5,
        ),
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
    assert second_start_ns - first_end_ns == 5_000_000_000
    assert recorded == {
        trace_id: request.SerializeToString()
        for trace_id, request in scenario.requests_by_trace_id.items()
    }


def test_composer_uses_equal_available_archetypes_when_mix_is_absent() -> None:
    scenario = load_scenario(Path(__file__).parent / "fixtures" / "fragment_bank")
    composer = SessionComposer(
        scenario,
        config=ComposerConfig(
            session_fragments_median=1,
            session_fragments_sigma=0,
            session_fragments_max=1,
            archetype_mix=None,
            fragment_gap_median_seconds=0,
            fragment_gap_sigma=0,
            fragment_gap_max_seconds=0,
        ),
        random=np.random.default_rng(17),
    )

    archetypes = [composer.compose(now_ns=100_000_000_000).archetype for _ in range(200)]

    assert 70 < archetypes.count("plain_chat") < 130
    assert 70 < archetypes.count("rag") < 130


def _scenario_with_two_plain_chat_fragments() -> Scenario:
    scenario = load_scenario(Path(__file__).parent / "fixtures" / "fragment_bank")
    return Scenario(
        manifest=scenario.manifest,
        requests=scenario.requests,
        source=scenario.source,
        fragments=(scenario.fragments[0], replace(scenario.fragments[1], archetype="plain_chat")),
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
