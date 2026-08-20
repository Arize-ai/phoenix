# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false
"""Convert Harbor's private job plan into records used by the Phoenix plugin.

Contract tests pin the private attributes read here to supported Harbor versions.
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

# Agent settings that distinguish Phoenix experiments.
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
    """Resolve a Harbor job into the records the plugin writes to Phoenix."""
    harbor_version = _require_supported_harbor()
    config = _require_attr(job, "config")

    _validate_job_shape(config)

    task_configs: Sequence[Any] = _require_attr(job, "_task_configs")
    downloads: Mapping[Any, Any] = _require_attr(job, "_task_download_results")
    trial_configs: Sequence[Any] = _require_attr(job, "_trial_configs")
    if not task_configs:
        raise HarborPluginError("Harbor resolved no tasks for this job.")

    tasks = _build_task_records(task_configs, downloads)
    dataset_configs: Sequence[Any] = getattr(config, "datasets", ()) or ()
    if dataset_configs:
        dataset = _resolve_dataset_identity(dataset_configs[0], tasks, dataset_override)
    else:
        dataset = _resolve_adhoc_dataset_identity(tasks, dataset_override)
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
    try:
        return getattr(obj, name)
    except AttributeError as error:
        raise HarborPluginError(
            f"Harbor does not expose `{name}`. Install a supported Harbor version, "
            "or omit `--plugin phoenix`."
        ) from error


def _validate_job_shape(config: Any) -> None:
    """Require one task source that can map to one Phoenix dataset."""
    if getattr(config, "source_jobs", None):
        raise HarborPluginError(
            "Regrade and source-job runs are unsupported. Omit `--plugin phoenix`."
        )
    tasks: Sequence[Any] = getattr(config, "tasks", ()) or ()
    datasets: Sequence[Any] = getattr(config, "datasets", ()) or ()
    if tasks and datasets:
        raise HarborPluginError(
            "A Harbor job cannot combine ad-hoc tasks and datasets when recording to Phoenix."
        )
    if len(datasets) > 1:
        raise HarborPluginError(
            f"Expected at most one Harbor dataset; found {len(datasets)}. Use one job per dataset."
        )
    if not tasks and not datasets:
        raise HarborPluginError("Harbor resolved neither a dataset nor ad-hoc tasks.")
    if not getattr(config, "agents", None):
        raise HarborPluginError("Harbor resolved no agents for this job.")


def _build_task_records(
    task_configs: Sequence[Any],
    downloads: Mapping[Any, Any],
) -> tuple[TaskRecord, ...]:
    records: list[TaskRecord] = []
    seen: set[str] = set()
    for task_config in task_configs:
        download = _lookup_download(task_config, downloads)
        task_lock = _build_task_lock(task_config, download)
        task_id = str(task_lock.name)
        if task_id in seen:
            raise HarborPluginError(f"Duplicate Harbor task name {task_id!r}. Rename one task.")
        seen.add(task_id)
        content = _read_task_content(download.path)
        records.append(
            TaskRecord(
                task_id=task_id,
                name=content.name,
                source=getattr(task_config, "source", None),
                task_type=str(task_lock.type),
                # Harbor added ``TaskLock.version`` in 0.21. Keep the field
                # optional for the plugin's supported 0.18-0.20 releases.
                version=getattr(task_lock, "version", None),
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
    # Fall back to matching downloads by task name.
    name = task_id.get_name()
    for key, value in downloads.items():
        if key.get_name() == name:
            return value
    raise HarborPluginError(f"No download for task {name!r}; cannot compute its digest.")


def _build_task_lock(task_config: Any, download: Any) -> Any:
    """Build a task lock once per task, not once per trial."""
    try:
        from harbor.models.job.lock import _build_lock_trial_task
    except ImportError as error:
        raise HarborPluginError(
            "Harbor does not expose the task-lock builder needed for digests."
        ) from error
    try:
        return _build_lock_trial_task(task_config, download)
    except Exception as error:
        raise HarborPluginError(f"Harbor could not resolve the task digest: {error}") from error


@dataclass(frozen=True)
class _TaskContent:
    name: str
    instruction: str
    steps: tuple[StepRecord, ...]
    config: dict[str, Any]


def _read_task_content(task_dir: Path) -> _TaskContent:
    """Read a downloaded task, including its declared name.

    A local task's directory name is its ID, which may differ from the name in
    ``task.toml``.
    """
    try:
        from harbor.models.task.task import Task
    except ImportError as error:  # pragma: no cover - exercised only without Harbor
        raise HarborPluginError("This Harbor version does not expose `Task`.") from error
    try:
        # Harbor validated the task while resolving the plan.
        task = Task(task_dir, disable_verification=True)
    except Exception as error:
        raise HarborPluginError(f"Could not load Harbor task at {task_dir}: {error}") from error

    steps: list[StepRecord] = []
    for step in getattr(task.config, "steps", None) or []:
        instruction = task.step_instruction(step.name)
        steps.append(StepRecord(name=str(step.name), instruction=str(instruction)))

    task_toml = task.config.model_dump(mode="json", exclude_defaults=True)
    return _TaskContent(
        name=str(getattr(task, "name", "") or task_dir.name),
        instruction=str(task.instruction),
        steps=tuple(steps),
        config=_redact_env(task_toml),
    )


def _redact_env(value: Any) -> Any:
    """Remove possible secrets from ``env`` while preserving its key names."""
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
    """Resolve the Phoenix dataset name from the tasks' shared Harbor source."""
    kind = _dataset_kind(dataset_config)
    sources = {task.source for task in tasks}
    inferred: str | None = None
    if len(sources) == 1:
        only = next(iter(sources))
        inferred = str(only) if only else None
    elif len(sources) > 1:
        listed = ", ".join(sorted(repr(source) for source in sources))
        raise HarborPluginError(
            f"Tasks came from multiple dataset sources ({listed}). Use one dataset per job."
        )

    name = override or inferred
    if not name:
        raise HarborPluginError(
            "Harbor did not report a dataset name for this job. Set one explicitly with "
            "`--plugin-kwarg dataset=<name>`."
        )
    return DatasetIdentity(name=name, kind=kind, inferred_name=inferred)


def _resolve_adhoc_dataset_identity(
    tasks: Sequence[TaskRecord],
    override: str | None,
) -> DatasetIdentity:
    """Name a synthetic dataset for Harbor's direct task inputs."""
    inferred: str | None = None
    if len(tasks) == 1:
        task_name = tasks[0].name.strip() or tasks[0].task_id
        inferred = f"harbor-task/{task_name}"

    name = override or inferred
    if not name:
        raise HarborPluginError(
            "A job with multiple ad-hoc tasks has no collection identity. Set "
            "`--plugin-kwarg dataset=<name>` to record their exact task set as a "
            "synthetic Phoenix dataset."
        )
    return DatasetIdentity(name=name, kind="adhoc", inferred_name=inferred)


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
                f"Duplicate agent configuration for {experiment_slice.agent_name!r}. Remove one."
            )
        seen.add(experiment_slice.identity_digest)
        slices.append(experiment_slice)
    return tuple(slices)


def _build_slice(agent_config: Any) -> ExperimentSlice:
    model_name = getattr(agent_config, "model_name", None)
    import_path = getattr(agent_config, "import_path", None)
    mcp_servers = tuple(
        str(getattr(server, "name", server)) for server in getattr(agent_config, "mcp_servers", ())
    )
    return ExperimentSlice(
        identity_digest=_agent_identity_digest(agent_config),
        agent_name=str(getattr(agent_config, "name", None) or "agent"),
        model_name=None if model_name is None else str(model_name),
        import_path=None if import_path is None else str(import_path),
        skills=tuple(str(skill) for skill in getattr(agent_config, "skills", ()) or ()),
        mcp_servers=mcp_servers,
    )


def _agent_identity_digest(agent_config: Any) -> str:
    """Digest behavior settings without storing secrets.

    Environment key names affect identity, but their values do not. Scheduler
    and logging settings are omitted because they do not change agent behavior.
    """
    payload: dict[str, Any] = {}
    for field_name in _AGENT_IDENTITY_FIELDS:
        payload[field_name] = _jsonable(getattr(agent_config, field_name, None))
    payload["mcp_servers"] = [
        _jsonable(server) for server in getattr(agent_config, "mcp_servers", ()) or ()
    ]
    env: Mapping[str, Any] = getattr(agent_config, "env", None) or {}
    payload["env_keys"] = sorted(str(key) for key in env)
    return canonical_digest(payload)


def _jsonable(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}  # pyright: ignore[reportUnknownVariableType]
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]  # pyright: ignore[reportUnknownVariableType]
    dump = getattr(value, "model_dump", None)
    if callable(dump):
        return _jsonable(dump(mode="json"))
    return str(value)


def _build_trial_slots(
    trial_configs: Sequence[Any],
    slices: Sequence[ExperimentSlice],
) -> tuple[TrialSlot, ...]:
    """Assign repetitions from Harbor's ordered trial plan.

    Harbor expands trials by attempt, task, then agent. Counting each agent and
    task pair preserves that order without relying on concurrent completion.
    """
    known = {experiment_slice.identity_digest for experiment_slice in slices}
    counters: dict[tuple[str, str], int] = {}
    slots: list[TrialSlot] = []
    for trial_config in trial_configs:
        identity = _agent_identity_digest(trial_config.agent)
        if identity not in known:
            raise HarborPluginError("Trial agent is missing from the job configuration.")
        task_id = str(trial_config.task.get_task_id().get_name())
        key = (identity, task_id)
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
