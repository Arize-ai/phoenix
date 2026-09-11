# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# Harbor cannot be installed on the client's Python 3.10 and 3.11 CI jobs.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportAttributeAccessIssue=false
"""Convert Harbor's private job plan into records used by the Phoenix plugin.

Contract tests pin the private attributes read here to supported Harbor versions.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

import harbor
from harbor.job import Job
from harbor.models.job.config import DatasetConfig, JobConfig
from harbor.models.job.lock import (
    TaskDownloadResolution,
    TrialLock,
    build_job_lock,
)
from harbor.models.task.task import Task
from harbor.models.trial.config import AgentConfig, TaskConfig, TrialConfig
from harbor.models.trial.result import TrialResult
from harbor.tasks.client import TaskIdType

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

__all__ = ["MINIMUM_HARBOR_VERSION", "build_job_plan", "existing_trial_results"]

MINIMUM_HARBOR_VERSION = (0, 21, 0)


def build_job_plan(job: object, *, dataset_override: str | None = None) -> JobPlan:
    """Resolve a Harbor job into the records the plugin writes to Phoenix."""
    if not isinstance(job, Job):
        raise HarborPluginError(
            f"The Phoenix Harbor plugin expected `harbor.job.Job`; found {type(job).__name__}."
        )
    harbor_version = _require_supported_harbor()
    config = job.config

    _validate_job_shape(config)

    task_configs = job._task_configs  # pyright: ignore[reportPrivateUsage]
    downloads = job._task_download_results  # pyright: ignore[reportPrivateUsage]
    trial_configs = job._trial_configs  # pyright: ignore[reportPrivateUsage]
    if not task_configs:
        raise HarborPluginError("Harbor resolved no tasks for this job.")

    job_lock = build_job_lock(
        config=config,
        trial_configs=trial_configs,
        task_download_results=downloads,
    )
    tasks = _build_task_records(task_configs, downloads, job_lock.trials)
    dataset_configs = config.datasets
    if dataset_configs:
        dataset = _resolve_dataset_identity(dataset_configs[0], tasks, dataset_override)
    else:
        dataset = _resolve_adhoc_dataset_identity(tasks, dataset_override)
    slices = _build_slices(config.agents)
    trials = _build_trial_slots(trial_configs, slices)

    return JobPlan(
        job_id=str(job.id),
        harbor_version=harbor_version,
        config=config,
        dataset=dataset,
        tasks=tasks,
        slices=slices,
        trials=trials,
    )


def _require_supported_harbor() -> str:
    version = harbor.__version__
    minimum = ".".join(str(part) for part in MINIMUM_HARBOR_VERSION)
    release, is_prerelease = _parse_version(str(version))
    if release < MINIMUM_HARBOR_VERSION or (release == MINIMUM_HARBOR_VERSION and is_prerelease):
        raise HarborPluginError(
            f"The Phoenix Harbor plugin requires harbor>={minimum}; found {version}."
        )
    return str(version)


def _parse_version(version: str) -> tuple[tuple[int, int, int], bool]:
    match = re.fullmatch(r"\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)", version)
    if match is None:
        raise HarborPluginError(f"Could not parse the installed Harbor version {version!r}.")
    release = (
        int(match.group(1)),
        int(match.group(2) or 0),
        int(match.group(3) or 0),
    )
    suffix = match.group(4).strip().lower()
    is_prerelease = bool(suffix) and not suffix.startswith(("+", ".post"))
    return release, is_prerelease


def existing_trial_results(job: Job) -> tuple[TrialResult, ...]:
    """Return terminal trials loaded by Harbor when resuming a job."""
    return tuple(job._existing_trial_results)  # pyright: ignore[reportPrivateUsage]


def _validate_job_shape(config: JobConfig) -> None:
    """Require one task source that can map to one Phoenix dataset."""
    if config.source_jobs:
        raise HarborPluginError(
            "Regrade and source-job runs are unsupported. Omit `--plugin arize-phoenix`."
        )
    tasks = config.tasks
    datasets = config.datasets
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
    if not config.agents:
        raise HarborPluginError("Harbor resolved no agents for this job.")


def _build_task_records(
    task_configs: Sequence[TaskConfig],
    downloads: Mapping[TaskIdType, TaskDownloadResolution],
    trial_locks: Sequence[TrialLock],
) -> tuple[TaskRecord, ...]:
    records: list[TaskRecord] = []
    seen: set[str] = set()
    task_locks = {trial_lock.task.name: trial_lock.task for trial_lock in trial_locks}
    for task_config in task_configs:
        download = _lookup_download(task_config, downloads)
        task_id = task_config.get_task_id().get_name()
        if task_id in seen:
            raise HarborPluginError(f"Duplicate Harbor task name {task_id!r}. Rename one task.")
        seen.add(task_id)
        try:
            task_lock = task_locks[task_id]
        except KeyError:
            raise HarborPluginError(f"Harbor produced no task lock for {task_id!r}.") from None
        content = _read_task_content(download.path)
        records.append(
            TaskRecord(
                lock=task_lock,
                name=content.name,
                instruction=content.instruction,
                steps=content.steps,
                multi_step_reward_strategy=content.multi_step_reward_strategy,
                config=content.config,
            )
        )
    return tuple(records)


def _lookup_download(
    task_config: TaskConfig,
    downloads: Mapping[TaskIdType, TaskDownloadResolution],
) -> TaskDownloadResolution:
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


@dataclass(frozen=True)
class _TaskContent:
    name: str
    instruction: str
    steps: tuple[StepRecord, ...]
    multi_step_reward_strategy: Literal["mean", "final"] | None
    config: dict[str, Any]


def _read_task_content(task_dir: Path) -> _TaskContent:
    """Read a downloaded task, including its declared name.

    A local task's directory name is its ID, which may differ from the name in
    ``task.toml``.
    """
    try:
        # Harbor validated the task while resolving the plan.
        task = Task(task_dir, disable_verification=True)
    except Exception as error:
        raise HarborPluginError(f"Could not load Harbor task at {task_dir}: {error}") from error

    steps: list[StepRecord] = []
    for step in task.config.steps or []:
        instruction = task.step_instruction(step.name)
        steps.append(StepRecord(name=str(step.name), instruction=str(instruction)))

    configured_strategy = task.config.multi_step_reward_strategy
    multi_step_reward_strategy: Literal["mean", "final"] | None
    if configured_strategy is not None:
        multi_step_reward_strategy = configured_strategy.value
    elif steps:
        multi_step_reward_strategy = "mean"
    else:
        multi_step_reward_strategy = None

    task_toml = task.config.model_dump(mode="json", exclude_defaults=True)
    return _TaskContent(
        name=task.name or task_dir.name,
        instruction=str(task.instruction),
        steps=tuple(steps),
        multi_step_reward_strategy=multi_step_reward_strategy,
        config=_redact_env(task_toml),
    )


def _redact_env(value: Any) -> Any:
    """Remove possible secrets from ``env`` while preserving its key names."""
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in cast(dict[object, object], value).items():
            key_name = str(key)
            if key_name == "env" and isinstance(item, dict):
                redacted[key_name] = sorted(str(name) for name in cast(dict[object, object], item))
            else:
                redacted[key_name] = _redact_env(item)
        return redacted
    if isinstance(value, list):
        return [_redact_env(item) for item in cast(list[object], value)]
    return value


def _resolve_dataset_identity(
    dataset_config: DatasetConfig,
    tasks: Sequence[TaskRecord],
    override: str | None,
) -> DatasetIdentity:
    """Resolve the Phoenix dataset name from Harbor's configured source."""
    kind = _dataset_kind(dataset_config)
    sources = {task.source for task in tasks}
    if len(sources) > 1:
        listed = ", ".join(sorted(repr(source) for source in sources))
        raise HarborPluginError(
            f"Tasks came from multiple dataset sources ({listed}). Use one dataset per job."
        )

    task_source = next(iter(sources), None)
    inferred = _dataset_name(dataset_config, task_source)
    name = override or inferred
    if not name:
        raise HarborPluginError(
            "Harbor did not report a dataset name for this job. Set one explicitly with "
            "`--plugin-kwarg dataset=<name>`."
        )
    return DatasetIdentity(name=name, kind=kind)


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
    return DatasetIdentity(name=name, kind="adhoc")


def _dataset_name(dataset_config: DatasetConfig, task_source: str | None) -> str | None:
    """Infer a dataset name from the public Harbor configuration."""
    if dataset_config.is_repo():
        # Harbor resolves implicit repository datasets through registry metadata.
        # The resolved metadata name is retained on each task as its source.
        return task_source
    if dataset_config.is_local():
        path = dataset_config.path
        return path.expanduser().resolve().name if path is not None else None
    if dataset_config.is_package() or dataset_config.is_registry():
        return dataset_config.name
    return None


def _dataset_kind(dataset_config: DatasetConfig) -> str:
    if dataset_config.is_repo():
        return "repo"
    if dataset_config.is_local():
        return "local"
    if dataset_config.is_package():
        return "package"
    if dataset_config.is_registry():
        return "registry"
    return "unknown"


def _build_slices(agent_configs: Sequence[AgentConfig]) -> tuple[ExperimentSlice, ...]:
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


def _build_slice(agent_config: AgentConfig) -> ExperimentSlice:
    return ExperimentSlice(
        identity_digest=_agent_identity_digest(agent_config),
        agent=agent_config,
    )


def _agent_identity_digest(agent_config: AgentConfig) -> str:
    """Digest behavior settings without storing secrets.

    Environment key names affect identity, but their values do not. Scheduler
    and logging settings are omitted because they do not change agent behavior.
    """
    payload = agent_config.model_dump(
        mode="json",
        exclude={"n_concurrent", "concurrency_group", "include_logs", "exclude_logs", "env"},
    )
    payload["env_keys"] = sorted(agent_config.env)
    return canonical_digest(payload)


def _build_trial_slots(
    trial_configs: Sequence[TrialConfig],
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
                config=trial_config,
                identity_digest=identity,
                repetition=counters[key],
            )
        )
    return tuple(slots)
