from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum

DEFAULT_EXPERIMENT_NAME_TEMPLATE = "{job_name} · {agent} · {model}"


class TraceMode(str, Enum):
    ATIF = "atif"
    OTLP = "otlp"
    NONE = "none"


@dataclass(frozen=True, slots=True)
class PhoenixConfig:
    dataset: str | None = None
    endpoint: str | None = None
    api_key: str | None = field(default=None, repr=False)
    trace_mode: TraceMode = TraceMode.ATIF
    experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE
    project: str | None = None

    @classmethod
    def from_sources(
        cls,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        trace_mode: str | TraceMode = TraceMode.ATIF,
        experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE,
        project: str | None = None,
    ) -> PhoenixConfig:
        try:
            parsed_trace_mode = TraceMode(trace_mode)
        except ValueError as exc:
            choices = ", ".join(mode.value for mode in TraceMode)
            raise ValueError(f"trace_mode must be one of {choices}; got {trace_mode!r}") from exc
        return cls(
            dataset=_nonempty(dataset),
            endpoint=_nonempty(endpoint) or _nonempty(os.getenv("PHOENIX_COLLECTOR_ENDPOINT")),
            api_key=_nonempty(api_key) or _nonempty(os.getenv("PHOENIX_API_KEY")),
            trace_mode=parsed_trace_mode,
            experiment_name_template=experiment_name_template,
            project=_nonempty(project),
        )


def _nonempty(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None
