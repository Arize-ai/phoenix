# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false
"""Harbor compatibility adapter.

This is the only module that reads Harbor's private job-plan attributes. It
converts a live ``Job`` into the frozen records in
:mod:`phoenix.client.harbor._model` and validates every assumption before the
plugin writes anything to Phoenix.

Harbor exposes no public API for the resolved task and trial plan, so the
private attributes read here are pinned by contract tests
(``tests/client/harbor/test_harbor_contract.py``) against the supported Harbor
versions.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import (
    DatasetIdentity,
    ExperimentSlice,
    JobPlan,
    StepRecord,
    TaskRecord,
    TrialSlot,
    canonical_digest,
)

__all__ = ["MINIMUM_HARBOR_VERSION", "build_job_plan"]

MINIMUM_HARBOR_VERSION = (0, 18, 0)

# Fields of Harbor's ``AgentConfig`` that change how an agent behaves, and so
# separate one Phoenix experiment from another. Anything not listed here is
# excluded on purpose; see ``_agent_identity_digest``.
_AGENT_IDENTITY_FIELDS = (
    "name",
    "import_path",
    "model_name",
    "skills",
    "kwargs",
    "override_timeout_sec",
    "override_setup_timeout_sec",
    "max_timeout_sec",
    "resume_trajectory",
    "load_trajectory",
    "extra_allowed_hosts",
)


def build_job_plan(job: Any, *, dataset_override: str | None = None) -> JobPlan:
    """Resolve a Harbor job into the plan the plugin records in Phoenix.

    Raises:
        HarborPluginError: if the job shape is unsupported or Harbor's plan is
            missing something the plugin requires. Harbor propagates this out
            of ``on_job_start``, stopping the job before any trial compute.
    """
    harbor_version = _require_supported_harbor()
    config = _require_attr(job, "config")

    _reject_unsupported_job_shape(config)

    task_configs: Sequence[Any] = _require_attr(job, "_task_configs")
    downloads: Mapping[Any, Any] = _require_attr(job, "_task_download_results")
    trial_configs: Sequence[Any] = _require_attr(job, "_trial_configs")
    if not task_configs:
        raise HarborPluginError("Harbor resolved no tasks for this job.")

    tasks = _build_task_records(task_configs, downloads)
    dataset = _resolve_dataset_identity(config.datasets[0], tasks, dataset_override)
    slices = _build_slices(config.agents)
    trials = _build_trial_slots(trial_configs, slices)

    return JobPlan(
        job_id=str(_require_attr(job, "id")),
        job_name=str(getattr(config, "job_name", "") or ""),
        harbor_version=harbor_version,
        dataset=dataset,
        tasks=tasks,
        slices=slices,
        trials=trials,
        repetitions=max(1, int(getattr(config, "n_attempts", 1) or 1)),
    )


def _require_supported_harbor() -> str | None:
    try:
        import harbor
    except ImportError as error:  # pragma: no cover - exercised only without Harbor
        raise HarborPluginError(
            "The Phoenix Harbor plugin requires the `harbor` package (Python >=3.12)."
        ) from error
    version = getattr(harbor, "__version__", None)
    if version is None:
        return None
    if _parse_version(str(version)) < MINIMUM_HARBOR_VERSION:
        minimum = ".".join(str(part) for part in MINIMUM_HARBOR_VERSION)
        raise HarborPluginError(
            f"The Phoenix Harbor plugin requires harbor>={minimum}; found {version}."
        )
    return str(version)


def _parse_version(version: str) -> tuple[int, ...]:
    parts: list[int] = []
    for chunk in version.split(".")[:3]:
        digits = "".join(c for c in chunk if c.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def _require_attr(obj: Any, name: str) -> Any:
    """Read a Harbor attribute, failing with the reason rather than AttributeError."""
    try:
        return getattr(obj, name)
    except AttributeError as error:
        raise HarborPluginError(
            f"This Harbor version does not expose `{name}`, which the Phoenix plugin "
            "needs to record the job. Upgrade or downgrade `harbor`, or run without "
            "`--plugin phoenix`."
        ) from error


def _reject_unsupported_job_shape(config: Any) -> None:
    """Stop job shapes whose provenance the plugin cannot reconstruct.

    Harbor flattens datasets and ad-hoc tasks into one task list and drops the
    source information, so a job mixing them cannot be mapped onto a single
    Phoenix dataset without guessing.
    """
    if getattr(config, "source_jobs", None):
        raise HarborPluginError(
            "Regrade and source-job runs are not supported by the Phoenix plugin yet. "
            "Run without `--plugin phoenix`."
        )
    if getattr(config, "tasks", None):
        raise HarborPluginError(
            "The Phoenix plugin requires a Harbor dataset and cannot record ad-hoc "
            "`--path` tasks passed alongside one. Move the task into a dataset, or run "
            "without `--plugin phoenix`."
        )
    datasets: Sequence[Any] = getattr(config, "datasets", ()) or ()
    if len(datasets) != 1:
        raise HarborPluginError(
            "The Phoenix plugin records exactly one Harbor dataset per job; this job "
            f"configures {len(datasets)}. Split it into one job per dataset."
        )
    if not getattr(config, "agents", None):
        raise HarborPluginError("Harbor resolved no agents for this job.")


def _build_task_records(
    task_configs: Sequence[Any],
    downloads: Mapping[Any, Any],
) -> tuple[TaskRecord, ...]:
    records: list[TaskRecord] = []
    seen: dict[str, int] = {}
    for task_config in task_configs:
        download = _lookup_download(task_config, downloads)
        task_lock = _build_task_lock(task_config, download)
        task_id = str(task_lock.name)
        if task_id in seen:
            raise HarborPluginError(
                f"Harbor resolved two tasks named {task_id!r}. Phoenix uses the task "
                "name as the dataset example identity, so duplicates would merge "
                "separate tasks. Rename one of them."
            )
        seen[task_id] = 1
        content = _read_task_content(download.path)
        records.append(
            TaskRecord(
                task_id=task_id,
                name=content.name,
                source=getattr(task_config, "source", None),
                task_type=str(task_lock.type),
                version=task_lock.version,
                digest=str(task_lock.digest),
                instruction=content.instruction,
                steps=content.steps,
                config=content.config,
            )
        )
    return tuple(records)


def _lookup_download(task_config: Any, downloads: Mapping[Any, Any]) -> Any:
    task_id = task_config.get_task_id()
    try:
        return downloads[task_id]
    except (KeyError, TypeError):
        pass
    # Harbor keys downloads by a model instance; fall back to matching on the
    # resolved name so an unhashable or re-created key does not abort the job.
    name = task_id.get_name()
    for key, value in downloads.items():
        if key.get_name() == name:
            return value
    raise HarborPluginError(
        f"Harbor did not report a download for task {name!r}, so the plugin cannot "
        "compute its digest."
    )


def _build_task_lock(task_config: Any, download: Any) -> Any:
    """Return Harbor's own ``TaskLock`` for a task.

    Harbor's ``build_job_lock`` builds one lock per *trial*, which re-hashes
    every task once per attempt and agent. This calls the per-task builder
    underneath it instead, so a job with N agents and K attempts hashes each
    task once rather than N*K times, while still using Harbor's canonical
    digest logic rather than reimplementing it.
    """
    try:
        from harbor.models.job.lock import _build_lock_trial_task
    except ImportError as error:
        raise HarborPluginError(
            "This Harbor version does not expose the task-lock builder the Phoenix "
            "plugin uses to compute task digests."
        ) from error
    try:
        return _build_lock_trial_task(task_config, download)
    except Exception as error:
        raise HarborPluginError(f"Harbor could not resolve the task digest: {error}") from error


@dataclass(frozen=True)
class _TaskContent:
    """What the plugin reads out of a downloaded task directory."""

    name: str
    instruction: str
    steps: tuple[StepRecord, ...]
    config: dict[str, Any]


def _read_task_content(task_dir: Path) -> _TaskContent:
    """Load the task's name, instructions, and JSON-safe configuration from disk.

    The task's declared name (``[task].name`` in ``task.toml``) is not the same
    as its Harbor task ID: a local task is identified by its directory name
    while declaring, say, ``arize/phoenix-regression-triage``. Both are
    recorded, because the ID is the example's identity and the name is what a
    reader recognizes.
    """
    try:
        from harbor.models.task.task import Task
    except ImportError as error:  # pragma: no cover - exercised only without Harbor
        raise HarborPluginError("This Harbor version does not expose `Task`.") from error
    try:
        # Harbor already validated the task while resolving the plan; re-running
        # verification here would fail the job for reasons Harbor accepted.
        task = Task(task_dir, disable_verification=True)
    except Exception as error:
        raise HarborPluginError(f"Could not load Harbor task at {task_dir}: {error}") from error

    steps: list[StepRecord] = []
    for step in getattr(task.config, "steps", None) or []:
        try:
            instruction = task.step_instruction(step.name)
        except Exception:
            instruction = ""
        steps.append(StepRecord(name=str(step.name), instruction=str(instruction)))

    try:
        task_toml = task.config.model_dump(mode="json", exclude_defaults=True)
    except Exception:
        task_toml = {}
    return _TaskContent(
        name=str(getattr(task, "name", "") or task_dir.name),
        instruction=str(task.instruction),
        steps=tuple(steps),
        config=_redact_env(task_toml),
    )


def _redact_env(value: Any) -> Any:
    """Replace every ``env`` mapping with its sorted key names.

    Harbor task and agent configurations carry credentials in ``env``. The
    dataset example is stored in Phoenix and visible to anyone with access to
    the dataset, so the values never leave the machine; the key names are kept
    because they describe what the task needs.
    """
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():  # pyright: ignore[reportUnknownVariableType]
            if key == "env" and isinstance(item, dict):
                redacted[key] = sorted(str(name) for name in item)  # pyright: ignore[reportUnknownArgumentType]
            else:
                redacted[key] = _redact_env(item)
        return redacted
    if isinstance(value, list):
        return [_redact_env(item) for item in value]  # pyright: ignore[reportUnknownVariableType]
    return value


def _resolve_dataset_identity(
    dataset_config: Any,
    tasks: Sequence[TaskRecord],
    override: str | None,
) -> DatasetIdentity:
    """Infer the Phoenix dataset name from Harbor's resolved dataset.

    Harbor stamps every resolved task with the dataset name it came from
    (``TaskConfig.source``) using exactly the rules the specification lists for
    each dataset kind: the directory basename for a local path, the bare name
    for a registry dataset, ``org/name`` for a package, and the resolved
    registry metadata name for a repository. Reading that one field therefore
    covers all four kinds, and the source agreement check the specification
    requires falls out of it rather than being a second, separate rule.
    """
    kind = _dataset_kind(dataset_config)
    sources = {task.source for task in tasks}
    inferred: str | None = None
    if len(sources) == 1:
        only = next(iter(sources))
        inferred = str(only) if only else None
    elif len(sources) > 1:
        listed = ", ".join(sorted(repr(source) for source in sources))
        raise HarborPluginError(
            f"Harbor resolved tasks from more than one dataset source ({listed}). The "
            "Phoenix plugin records one dataset per job."
        )

    name = override or inferred
    if not name:
        raise HarborPluginError(
            "Harbor did not report a dataset name for this job. Set one explicitly with "
            "`--plugin-kwarg dataset=<name>`."
        )
    return DatasetIdentity(name=name, kind=kind, inferred_name=inferred)


def _dataset_kind(dataset_config: Any) -> str:
    for kind in ("repo", "local", "package", "registry"):
        classifier = getattr(dataset_config, f"is_{kind}", None)
        if callable(classifier) and classifier():
            return kind
    return "unknown"


def _build_slices(agent_configs: Sequence[Any]) -> tuple[ExperimentSlice, ...]:
    slices: list[ExperimentSlice] = []
    seen: set[str] = set()
    for agent_config in agent_configs:
        experiment_slice = _build_slice(agent_config)
        if experiment_slice.identity_digest in seen:
            raise HarborPluginError(
                f"Two agent configurations for {experiment_slice.agent_name!r} are "
                "identical, so they cannot be told apart as separate Phoenix "
                "experiments. Remove the duplicate."
            )
        seen.add(experiment_slice.identity_digest)
        slices.append(experiment_slice)
    return tuple(slices)


def _build_slice(agent_config: Any) -> ExperimentSlice:
    mcp_servers = tuple(
        str(getattr(server, "name", server)) for server in getattr(agent_config, "mcp_servers", ())
    )
    return ExperimentSlice(
        identity_digest=_agent_identity_digest(agent_config),
        agent_name=str(getattr(agent_config, "name", None) or "agent"),
        model_name=_optional_str(getattr(agent_config, "model_name", None)),
        import_path=_optional_str(getattr(agent_config, "import_path", None)),
        skills=tuple(str(skill) for skill in getattr(agent_config, "skills", ()) or ()),
        mcp_servers=mcp_servers,
    )


def _agent_identity_digest(agent_config: Any) -> str:
    """Digest every behavior-affecting field of an agent configuration.

    Two agent configurations that differ in any of these fields must become two
    Phoenix experiments even when they display the same agent and model name.

    Deliberate exclusions:

    * ``env`` **values**. Harbor treats ``AgentConfig.env`` as the credential
      channel and redacts it on serialization. Folding the values in would fork
      the experiment on every routine key rotation, which is wrong on its own
      terms; the sorted key names are included so an agent that gains or loses
      a variable still separates.
    * ``n_concurrent``, ``concurrency_group``, ``include_logs`` and
      ``exclude_logs``. These schedule and log the run; they do not change what
      the agent does.

    The digest is one-way and is the only place non-readable configuration is
    recorded; ``ExperimentSlice.describe`` stores just the readable fields.
    """
    payload: dict[str, Any] = {}
    for field_name in _AGENT_IDENTITY_FIELDS:
        payload[field_name] = _jsonable(getattr(agent_config, field_name, None))
    payload["mcp_servers"] = [
        _jsonable(_dump(server)) for server in getattr(agent_config, "mcp_servers", ()) or ()
    ]
    env: Mapping[str, Any] = getattr(agent_config, "env", None) or {}
    payload["env_keys"] = sorted(str(key) for key in env)
    return canonical_digest(payload)


def _dump(model: Any) -> Any:
    dump = getattr(model, "model_dump", None)
    if callable(dump):
        try:
            return dump(mode="json")
        except Exception:
            return str(model)
    return model


def _jsonable(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}  # pyright: ignore[reportUnknownVariableType]
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]  # pyright: ignore[reportUnknownVariableType]
    return _jsonable(_dump(value)) if hasattr(value, "model_dump") else str(value)


def _optional_str(value: Any) -> str | None:
    return None if value is None else str(value)


def _build_trial_slots(
    trial_configs: Sequence[Any],
    slices: Sequence[ExperimentSlice],
) -> tuple[TrialSlot, ...]:
    """Assign each planned trial its repetition number.

    Harbor has no attempt index anywhere in its plan, so the number has to come
    from the plan's order: Harbor expands trials as attempt, then task, then
    agent. Walking ``_trial_configs`` in that order and counting per
    (agent identity, task) gives every trial a repetition that is stable across
    a resume, because Harbor reconciles the plan with existing trials before
    plugins are attached. Completion order must never be used -- it varies with
    concurrency and retries.
    """
    known = {experiment_slice.identity_digest for experiment_slice in slices}
    counters: dict[tuple[str, str], int] = {}
    slots: list[TrialSlot] = []
    for trial_config in trial_configs:
        identity = _agent_identity_digest(trial_config.agent)
        if identity not in known:
            raise HarborPluginError(
                "Harbor planned a trial for an agent configuration that is not in the "
                "job configuration, so the plugin cannot assign it to an experiment."
            )
        task_id = str(trial_config.task.get_task_id().get_name())
        key = (identity, task_id)
        # Phoenix rejects repetition 0, so repetitions are 1-based.
        counters[key] = counters.get(key, 0) + 1
        slots.append(
            TrialSlot(
                trial_name=str(getattr(trial_config, "trial_name", "") or ""),
                identity_digest=identity,
                task_id=task_id,
                repetition=counters[key],
            )
        )
    return tuple(slots)
