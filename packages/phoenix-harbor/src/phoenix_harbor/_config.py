from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import Enum
from string import Formatter

DEFAULT_EXPERIMENT_NAME_TEMPLATE = "{job_name} · {agent} · {model}"
_EXPERIMENT_NAME_FIELDS: Mapping[str, str] = {
    "job_name": "job",
    "job_id": "job-id",
    "agent": "agent",
    "model": "model",
}


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
        if not isinstance(trace_mode, (str, TraceMode)):
            raise TypeError(f"trace_mode must be a string; got {type(trace_mode).__name__}")
        try:
            parsed_trace_mode = TraceMode(trace_mode)
        except ValueError as exc:
            choices = ", ".join(mode.value for mode in TraceMode)
            raise ValueError(f"trace_mode must be one of {choices}; got {trace_mode!r}") from exc
        return cls(
            dataset=_optional_nonempty("dataset", dataset),
            endpoint=_optional_nonempty("endpoint", endpoint)
            or _optional_nonempty(
                "PHOENIX_COLLECTOR_ENDPOINT", os.getenv("PHOENIX_COLLECTOR_ENDPOINT")
            ),
            api_key=_optional_nonempty("api_key", api_key)
            or _optional_nonempty("PHOENIX_API_KEY", os.getenv("PHOENIX_API_KEY")),
            trace_mode=parsed_trace_mode,
            experiment_name_template=_validate_experiment_name_template(experiment_name_template),
            project=_optional_nonempty("project", project),
        )


def _optional_nonempty(name: str, value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise TypeError(f"{name} must be a string or None; got {type(value).__name__}")
    stripped = value.strip()
    return stripped or None


def _validate_experiment_name_template(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError(f"experiment_name_template must be a string; got {type(value).__name__}")
    template = value.strip()
    if not template:
        raise ValueError("experiment_name_template must not be empty")

    try:
        fields = [field_name for _, field_name, _, _ in Formatter().parse(template)]
    except ValueError as exc:
        raise ValueError(f"invalid experiment_name_template: {exc}") from exc

    unsupported_fields = sorted(
        {
            field_name
            for field_name in fields
            if field_name is not None and field_name not in _EXPERIMENT_NAME_FIELDS
        }
    )
    if unsupported_fields:
        supported = ", ".join(_EXPERIMENT_NAME_FIELDS)
        unsupported = ", ".join(repr(field_name) for field_name in unsupported_fields)
        raise ValueError(
            f"unsupported experiment_name_template fields: {unsupported}; "
            f"supported fields are {supported}"
        )

    try:
        template.format_map(_EXPERIMENT_NAME_FIELDS)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"invalid experiment_name_template: {exc}") from exc
    return template
