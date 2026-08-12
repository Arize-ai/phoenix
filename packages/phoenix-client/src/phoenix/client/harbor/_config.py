from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from string import Formatter
from typing import Literal, get_args

# A Literal rather than an Enum: values arrive as strings from Harbor's --plugin-kwarg, so
# there is nothing to gain from a nominal type at the boundary.
#
# `otlp` is accepted here to match the design spec (§5, §8), which scopes OTLP project
# routing (§5.1) and adapter-assisted trace-to-run linkage (§5.2) into the prototype. None of
# it is implemented yet; on_job_start currently refuses every mode alike. When lifecycle
# orchestration lands, the otlp path must be handled explicitly rather than falling through.
TraceMode = Literal["atif", "otlp", "none"]
TRACE_MODES: tuple[TraceMode, ...] = get_args(TraceMode)

DEFAULT_TRACE_MODE: TraceMode = "atif"
DEFAULT_EXPERIMENT_NAME_TEMPLATE = "{job_name} · {agent} · {model}"

# Sample values used to validate a template renders; keys define the supported field set.
_EXPERIMENT_NAME_FIELDS: Mapping[str, str] = {
    "job_name": "job",
    "job_id": "job-id",
    "agent": "agent",
    "model": "model",
}


@dataclass(frozen=True, slots=True)
class PhoenixConfig:
    """Validated settings for the Phoenix Harbor plugin.

    Mirrors the configuration table in the design spec (§8). Values are validated eagerly so
    a bad setting stops the job before Harbor spends trial compute.
    """

    dataset: str | None = None
    endpoint: str | None = None
    api_key: str | None = field(default=None, repr=False)
    trace_mode: TraceMode = DEFAULT_TRACE_MODE
    experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE
    project: str | None = None

    @classmethod
    def from_sources(
        cls,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        trace_mode: str = DEFAULT_TRACE_MODE,
        experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE,
        project: str | None = None,
    ) -> PhoenixConfig:
        """Build a config from explicit values, falling back to environment variables.

        Every value arrives as a string from Harbor's ``--plugin-kwarg``, so each field is
        validated here rather than trusted.
        """
        return cls(
            dataset=_optional_nonempty("dataset", dataset),
            endpoint=_optional_nonempty("endpoint", endpoint)
            or _optional_nonempty(
                "PHOENIX_COLLECTOR_ENDPOINT", os.getenv("PHOENIX_COLLECTOR_ENDPOINT")
            ),
            api_key=_optional_nonempty("api_key", api_key)
            or _optional_nonempty("PHOENIX_API_KEY", os.getenv("PHOENIX_API_KEY")),
            trace_mode=_validate_trace_mode(trace_mode),
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


def _validate_trace_mode(value: object) -> TraceMode:
    if not isinstance(value, str):
        raise TypeError(f"trace_mode must be a string; got {type(value).__name__}")
    candidate = value.strip()
    for mode in TRACE_MODES:
        if candidate == mode:
            return mode
    choices = ", ".join(TRACE_MODES)
    raise ValueError(f"trace_mode must be one of {choices}; got {value!r}")


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
