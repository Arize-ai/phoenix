"""Compose recorded fragments into virtual replay sessions."""

from __future__ import annotations

from dataclasses import dataclass
from math import log
from typing import Mapping, NamedTuple, Sequence

import numpy as np
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.experimental.datagen.loader import Corpus
from phoenix.experimental.datagen.schema import Archetype, Fragment


class _SessionLengthProfile(NamedTuple):
    """Lognormal draw parameters for fragments per composed session."""

    median: float
    sigma: float
    maximum: int


# Session lengths differ by application shape. Episodic applications (agent
# work sessions, batch extraction) naturally string together several
# independent fragments; conversational applications record whole
# conversations as single fragments, so their sessions compose few of them.
# Medians are fragments per session; each fragment carries its recorded
# traces.
_SESSION_LENGTH_PROFILES: Mapping[Archetype, _SessionLengthProfile] = {
    "tool_agent": _SessionLengthProfile(median=6.0, sigma=0.8, maximum=30),
    "plain_chat": _SessionLengthProfile(median=2.0, sigma=0.7, maximum=4),
    "rag": _SessionLengthProfile(median=2.0, sigma=0.8, maximum=6),
    "structured_extraction": _SessionLengthProfile(median=4.0, sigma=1.0, maximum=16),
    "graph_multi_agent": _SessionLengthProfile(median=2.0, sigma=0.8, maximum=6),
    "guardrailed": _SessionLengthProfile(median=3.0, sigma=0.8, maximum=8),
}
_DEFAULT_SESSION_LENGTH = _SessionLengthProfile(median=2.0, sigma=1.0, maximum=24)
_FRAGMENT_GAP_MEDIAN_SECONDS = 180.0
_FRAGMENT_GAP_SIGMA = 0.9
_FRAGMENT_GAP_MAX_SECONDS = 3600.0


@dataclass(frozen=True)
class ComposedTrace:
    """One whole recorded trace placed on a virtual timeline."""

    request: ExportTraceServiceRequest
    fragment_id: str
    virtual_start_ns: int


@dataclass(frozen=True)
class ComposedSession:
    """A same-domain, same-archetype sequence of whole recorded fragments."""

    archetype: Archetype
    fragments: Sequence[Fragment]
    traces: Sequence[ComposedTrace]
    start_time_ns: int
    end_time_ns: int


class SessionComposer:
    """Sample fragments and place their recorded traces on a virtual timeline."""

    def __init__(
        self,
        corpus: Corpus,
        *,
        random: np.random.Generator,
    ) -> None:
        if not corpus.fragments:
            raise ValueError("corpus contains no fragments")
        self._random = random
        self._requests_by_trace_id = corpus.requests_by_trace_id
        fragments_by_application: dict[Archetype, dict[str, list[Fragment]]] = {}
        for fragment in corpus.fragments:
            fragments_by_application.setdefault(fragment.archetype, {}).setdefault(
                fragment.domain, []
            ).append(fragment)
        self._fragments_by_application: dict[Archetype, dict[str, tuple[Fragment, ...]]] = {
            archetype: {
                domain: tuple(fragments) for domain, fragments in sorted(applications.items())
            }
            for archetype, applications in fragments_by_application.items()
        }
        cells: list[tuple[Archetype, str]] = [
            (archetype, domain)
            for archetype, domains in self._fragments_by_application.items()
            for domain in domains
        ]
        cells.sort()
        counts = np.array(
            [len(self._fragments_by_application[archetype][domain]) for archetype, domain in cells],
            dtype=np.float64,
        )
        self._cells = tuple(cells)
        self._cell_probabilities = counts / counts.sum()

    def compose(self, *, now_ns: int) -> ComposedSession:
        """Materialize one backdated session ending at ``now_ns``."""
        cell_index = int(self._random.choice(len(self._cells), p=self._cell_probabilities))
        archetype, domain = self._cells[cell_index]
        fragments = self._sample_fragments(archetype, domain, self._draw_fragment_count(archetype))
        traces: list[ComposedTrace] = []
        cursor_ns = 0
        for fragment_index, fragment in enumerate(fragments):
            requests = tuple(
                self._requests_by_trace_id[trace_id] for trace_id in fragment.trace_ids
            )
            starts_and_ends = tuple(_request_bounds(request) for request in requests)
            fragment_start_ns = min(start for start, _ in starts_and_ends)
            fragment_end_ns = max(end for _, end in starts_and_ends)
            for request, (trace_start_ns, _) in zip(requests, starts_and_ends):
                traces.append(
                    ComposedTrace(
                        request=request,
                        fragment_id=fragment.fragment_id,
                        virtual_start_ns=cursor_ns + trace_start_ns - fragment_start_ns,
                    )
                )
            cursor_ns += fragment_end_ns - fragment_start_ns
            if fragment_index < len(fragments) - 1:
                cursor_ns += self._draw_fragment_gap_ns()

        session_start_ns = now_ns - cursor_ns
        shifted_traces = tuple(
            ComposedTrace(
                request=trace.request,
                fragment_id=trace.fragment_id,
                virtual_start_ns=session_start_ns + trace.virtual_start_ns,
            )
            for trace in traces
        )
        return ComposedSession(
            archetype=archetype,
            fragments=fragments,
            traces=shifted_traces,
            start_time_ns=session_start_ns,
            end_time_ns=now_ns,
        )

    def _draw_fragment_count(self, archetype: Archetype) -> int:
        profile = _SESSION_LENGTH_PROFILES.get(archetype, _DEFAULT_SESSION_LENGTH)
        count = int(
            round(
                self._random.lognormal(
                    mean=log(profile.median),
                    sigma=profile.sigma,
                )
            )
        )
        return min(profile.maximum, max(1, count))

    def _draw_fragment_gap_ns(self) -> int:
        seconds = self._random.lognormal(
            mean=log(_FRAGMENT_GAP_MEDIAN_SECONDS),
            sigma=_FRAGMENT_GAP_SIGMA,
        )
        seconds = min(_FRAGMENT_GAP_MAX_SECONDS, max(0.0, float(seconds)))
        return round(seconds * 1_000_000_000)

    def _sample_fragments(
        self, archetype: Archetype, domain: str, count: int
    ) -> tuple[Fragment, ...]:
        available = self._fragments_by_application[archetype][domain]
        selected: list[Fragment] = []
        while len(selected) < count:
            batch_size = min(len(available), count - len(selected))
            indices = self._random.choice(len(available), size=batch_size, replace=False)
            selected.extend(available[int(index)] for index in np.atleast_1d(indices))
        return tuple(selected)


def _request_bounds(request: ExportTraceServiceRequest) -> tuple[int, int]:
    spans = tuple(
        span
        for resource_spans in request.resource_spans
        for scope_spans in resource_spans.scope_spans
        for span in scope_spans.spans
    )
    return (
        min(span.start_time_unix_nano for span in spans),
        max(span.end_time_unix_nano for span in spans),
    )
