"""Experiment naming for the Phoenix Harbor plugin."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from string import Formatter
from types import MappingProxyType

from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import ExperimentSlice, JobPlan

__all__ = [
    "DEFAULT_EXPERIMENT_NAME_TEMPLATE",
    "EXPERIMENT_NAME_TEMPLATE_FIELDS",
]

DEFAULT_EXPERIMENT_NAME_TEMPLATE = "{job.name} · {agent.name} · {agent.model}"

EXPERIMENT_NAME_TEMPLATE_FIELDS: Mapping[str, str] = MappingProxyType(
    {
        "job.name": "Harbor job name, falling back to the job ID.",
        "job.id": "Unique Harbor job ID.",
        "dataset.name": "Phoenix dataset name.",
        "agent.name": "Harbor agent name.",
        "agent.model": "Configured model name, or 'default'.",
        "agent.short_digest": "First twelve characters of the agent configuration digest.",
    }
)

_FORMATTER = Formatter()


@dataclass(frozen=True)
class _JobFields:
    name: str
    id: str


@dataclass(frozen=True)
class _DatasetFields:
    name: str


@dataclass(frozen=True)
class _AgentFields:
    name: str
    model: str
    short_digest: str


def validate_experiment_naming(
    *,
    experiment_name: str | None,
    experiment_name_template: str | None,
) -> tuple[str | None, str | None]:
    """Normalize mutually exclusive exact-name and template options."""
    if experiment_name is not None and experiment_name_template is not None:
        raise ValueError("experiment_name and experiment_name_template are mutually exclusive.")
    if experiment_name is not None:
        name = experiment_name.strip()
        if not name:
            raise ValueError("experiment_name must not be empty.")
        return name, None

    template = (
        DEFAULT_EXPERIMENT_NAME_TEMPLATE
        if experiment_name_template is None
        else experiment_name_template
    )
    _validate_template(template)
    return None, template


def experiment_names(
    plan: JobPlan,
    *,
    experiment_name: str | None,
    experiment_name_template: str | None,
) -> dict[str, str]:
    """Render one name per experiment slice and disambiguate collisions."""
    validate_experiment_name_for_plan(plan, experiment_name=experiment_name)
    if experiment_name is not None:
        return {plan.slices[0].identity_digest: experiment_name}

    if experiment_name_template is None:  # pragma: no cover - normalized by the constructor
        raise AssertionError("experiment_name_template was not initialized")
    rendered = {
        experiment_slice.identity_digest: _render_template(
            experiment_name_template, plan, experiment_slice
        )
        for experiment_slice in plan.slices
    }
    counts: dict[str, int] = {}
    for name in rendered.values():
        counts[name] = counts.get(name, 0) + 1
    return {
        digest: (f"{name} · {plan.slice_for(digest).short_identity}" if counts[name] > 1 else name)
        for digest, name in rendered.items()
    }


def validate_experiment_name_for_plan(
    plan: JobPlan,
    *,
    experiment_name: str | None,
) -> None:
    """Reject an exact name when one Harbor job expands to several experiments."""
    if experiment_name is not None and len(plan.slices) != 1:
        raise HarborPluginError(
            "experiment_name can only be used when Harbor resolves one experiment slice; "
            "use experiment_name_template for jobs with multiple agent configurations."
        )


def _validate_template(template: str) -> None:
    if not template.strip():
        raise ValueError("experiment_name_template must not be empty.")
    try:
        parsed = tuple(_FORMATTER.parse(template))
    except ValueError as error:
        raise ValueError(f"Invalid experiment_name_template {template!r}: {error}.") from error

    unknown: list[str] = []
    for _, field_name, format_spec, _ in parsed:
        if field_name is None:
            continue
        if field_name not in EXPERIMENT_NAME_TEMPLATE_FIELDS:
            unknown.append(field_name or "<positional field>")
        if format_spec:
            _validate_template_fields(format_spec, unknown)
    if unknown:
        available = ", ".join(EXPERIMENT_NAME_TEMPLATE_FIELDS)
        names = ", ".join(repr(name) for name in dict.fromkeys(unknown))
        raise ValueError(
            f"Unknown experiment_name_template field(s): {names}. Available fields: {available}."
        )


def _validate_template_fields(template: str, unknown: list[str]) -> None:
    """Validate replacement fields nested inside a format specification."""
    try:
        parsed = _FORMATTER.parse(template)
        for _, field_name, format_spec, _ in parsed:
            if field_name is None:
                continue
            if field_name not in EXPERIMENT_NAME_TEMPLATE_FIELDS:
                unknown.append(field_name or "<positional field>")
            if format_spec:
                _validate_template_fields(format_spec, unknown)
    except ValueError as error:
        raise ValueError(f"Invalid experiment_name_template format specifier: {error}.") from error


def _render_template(
    template: str,
    plan: JobPlan,
    experiment_slice: ExperimentSlice,
) -> str:
    fields = {
        "job": _JobFields(name=plan.job_name or plan.job_id, id=plan.job_id),
        "dataset": _DatasetFields(name=plan.dataset.name),
        "agent": _AgentFields(
            name=experiment_slice.agent_name,
            model=experiment_slice.model_name or "default",
            short_digest=experiment_slice.short_identity,
        ),
    }
    try:
        name = template.format(**fields)
    except (AttributeError, IndexError, KeyError, ValueError) as error:
        raise HarborPluginError(
            f"Could not render experiment_name_template {template!r}: {error}."
        ) from error
    name = name.strip()
    if not name:
        raise HarborPluginError(
            f"experiment_name_template {template!r} rendered an empty experiment name."
        )
    return name
