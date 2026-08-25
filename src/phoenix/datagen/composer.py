"""Compose recorded fragments into virtual replay sessions."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite, log
from typing import Mapping, Sequence, cast

import numpy as np
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.datagen.loader import Corpus
from phoenix.datagen.schema import ARCHETYPES, Archetype, Fragment


@dataclass(frozen=True)
class ComposerConfig:
    """Distribution settings for virtual sessions."""

    session_fragments_median: float = 2.0
    session_fragments_sigma: float = 1.0
    session_fragments_max: int = 24
    archetype_mix: Mapping[Archetype, float] | None = None
    fragment_gap_median_seconds: float = 180.0
    fragment_gap_sigma: float = 0.9
    fragment_gap_max_seconds: float = 3600.0

    def __post_init__(self) -> None:
        if not isfinite(self.session_fragments_median) or self.session_fragments_median <= 0:
            raise ValueError("session_fragments_median must be greater than zero")
        if not isfinite(self.session_fragments_sigma) or self.session_fragments_sigma < 0:
            raise ValueError("session_fragments_sigma must not be negative")
        if self.session_fragments_max < 1:
            raise ValueError("session_fragments_max must be at least one")
        if not isfinite(self.fragment_gap_median_seconds) or self.fragment_gap_median_seconds < 0:
            raise ValueError("fragment_gap_median_seconds must not be negative")
        if not isfinite(self.fragment_gap_sigma) or self.fragment_gap_sigma < 0:
            raise ValueError("fragment_gap_sigma must not be negative")
        if not isfinite(self.fragment_gap_max_seconds) or self.fragment_gap_max_seconds < 0:
            raise ValueError("fragment_gap_max_seconds must not be negative")
        for archetype, weight in (self.archetype_mix or {}).items():
            if archetype not in ARCHETYPES:
                raise ValueError(f"unsupported archetype in mix: {archetype}")
            if not isfinite(weight) or weight <= 0:
                raise ValueError(f"archetype weight for {archetype} must be greater than zero")


@dataclass(frozen=True)
class ComposedTrace:
    """One whole recorded trace placed on a virtual timeline."""

    request: ExportTraceServiceRequest
    fragment_id: str
    virtual_start_ns: int


@dataclass(frozen=True)
class ComposedSession:
    """A same-archetype sequence of whole recorded fragments."""

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
        config: ComposerConfig,
        random: np.random.Generator,
    ) -> None:
        if not corpus.fragments:
            raise ValueError("corpus contains no fragments")
        self._config = config
        self._random = random
        self._requests_by_trace_id = corpus.requests_by_trace_id
        fragments_by_application: dict[Archetype, dict[str, list[Fragment]]] = {}
        for fragment in corpus.fragments:
            fragments_by_application.setdefault(fragment.archetype, {}).setdefault(
                fragment.domain, []
            ).append(fragment)
        self._fragments_by_application = {
            archetype: {
                domain: tuple(fragments) for domain, fragments in sorted(applications.items())
            }
            for archetype, applications in fragments_by_application.items()
        }
        configured_mix = config.archetype_mix or {
            archetype: 1.0 for archetype in self._fragments_by_application
        }
        unavailable = set(configured_mix).difference(self._fragments_by_application)
        if unavailable:
            raise ValueError(
                f"archetype mix references unavailable archetypes: {sorted(unavailable)!r}"
            )
        if not configured_mix:
            raise ValueError("archetype mix contains no available archetypes")
        self._archetypes = tuple(configured_mix)
        weights = np.asarray(tuple(configured_mix.values()), dtype=float)
        self._archetype_probabilities = weights / weights.sum()

    def compose(self, *, now_ns: int) -> ComposedSession:
        """Materialize one backdated session ending at ``now_ns``."""
        archetype = cast(
            Archetype,
            self._random.choice(self._archetypes, p=self._archetype_probabilities),
        )
        applications = tuple(self._fragments_by_application[archetype])
        domain = str(self._random.choice(applications))
        fragments = self._sample_fragments(archetype, domain, self._draw_fragment_count())
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

    def _draw_fragment_count(self) -> int:
        count = int(
            round(
                self._random.lognormal(
                    mean=log(self._config.session_fragments_median),
                    sigma=self._config.session_fragments_sigma,
                )
            )
        )
        return min(self._config.session_fragments_max, max(1, count))

    def _draw_fragment_gap_ns(self) -> int:
        if self._config.fragment_gap_median_seconds == 0:
            return 0
        seconds = self._random.lognormal(
            mean=log(self._config.fragment_gap_median_seconds),
            sigma=self._config.fragment_gap_sigma,
        )
        seconds = min(self._config.fragment_gap_max_seconds, max(0.0, float(seconds)))
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
