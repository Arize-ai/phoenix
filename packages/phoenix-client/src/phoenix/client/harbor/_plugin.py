from __future__ import annotations

import asyncio
import contextlib
import logging
import sys
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Literal

import httpx

from phoenix.client.__generated__ import v1
from phoenix.client.client import (
    _DEFAULT_CLIENT_TIMEOUT,  # pyright: ignore[reportPrivateUsage]
    AsyncClient,
    _update_headers,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.harbor._adapter import build_job_plan, existing_trial_results
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import JobPlan
from phoenix.client.harbor._recorder import (
    DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    DatasetSnapshot,
    ExperimentHandle,
    PhoenixRecorder,
    RunKey,
)
from phoenix.client.utils.config import get_base_url, get_env_phoenix_api_key, get_env_project_name

# Harbor is an optional dependency that requires Python >=3.12.
if TYPE_CHECKING and sys.version_info >= (3, 12):
    from harbor.job import Job
    from harbor.models.job.result import JobResult
    from harbor.trial.hooks import TrialHookEvent
else:
    Job = Any
    JobResult = Any
    TrialHookEvent = Any

logger = logging.getLogger(__name__)

TraceMode = Literal["atif", "otlp", "none"]

_TRACE_MODES: tuple[str, ...] = ("atif", "otlp", "none")


class PhoenixJobPlugin:
    """Record a Harbor job as a Phoenix dataset and experiments."""

    def __init__(
        self,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        project: str | None = None,
        trace_mode: TraceMode = "atif",
        experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    ) -> None:
        if trace_mode not in _TRACE_MODES:
            raise ValueError(f"unsupported trace_mode: {trace_mode!r}")

        self.dataset = dataset
        self.endpoint = endpoint or str(get_base_url())
        self._api_key = api_key or get_env_phoenix_api_key()
        self.project = project or get_env_project_name()
        # TODO: Implement trace export for the selected mode.
        self.trace_mode: TraceMode = trace_mode
        self.experiment_name_template = experiment_name_template

        self.plan: JobPlan | None = None
        self.snapshot: DatasetSnapshot | None = None
        self.experiments: dict[str, ExperimentHandle] = {}
        self._runs: dict[RunKey, v1.ExperimentRun] = {}
        self._attempts: dict[str, int] = {}
        self._retry_config: Any = None
        self._record_lock = asyncio.Lock()
        self._terminal_failure: Exception | None = None

    async def on_job_start(self, job: Job) -> None:
        plan = build_job_plan(job, dataset_override=self.dataset)
        resumed_trials = existing_trial_results(job)
        async with self._open_client() as client:
            recorder = PhoenixRecorder(
                client,
                experiment_name_template=self.experiment_name_template,
            )
            snapshot = await recorder.sync_dataset(plan)
            experiments = await recorder.resolve_experiments(plan, snapshot)
            runs = await recorder.existing_runs(experiments)

            self.plan = plan
            self.snapshot = snapshot
            self.experiments = experiments
            self._runs = runs
            for trial_result in resumed_trials:
                await self._record_trial(trial_result, recorder=recorder)

        self._retry_config = job.config.retry
        try:
            job.on_trial_started(self._on_trial_started)
            job.on_trial_ended(self._on_trial_ended)
        except AttributeError as error:
            raise HarborPluginError(
                "Harbor does not expose trial lifecycle hooks. Install a supported Harbor version."
            ) from error
        self._report_started(plan, experiments)

    async def on_job_end(self, job_result: JobResult) -> None:
        del job_result
        if self.plan is None:
            return
        logger.info(
            "Harbor job %s recorded in Phoenix dataset %r (%d experiment(s)).",
            self.plan.job_id,
            self.plan.dataset.name,
            len(self.experiments),
        )

    async def _on_trial_started(self, event: TrialHookEvent) -> None:
        trial_name = str(event.trial_name)
        self._attempts[trial_name] = self._attempts.get(trial_name, 0) + 1

    async def _on_trial_ended(self, event: TrialHookEvent) -> None:
        if self._terminal_failure is not None:
            return
        if self._will_retry(event):
            return
        async with self._record_lock:
            if self._terminal_failure is not None:
                return
            try:
                await self._record_trial(event.result)
            except Exception as error:
                self._terminal_failure = error
                raise

    def _will_retry(self, event: TrialHookEvent) -> bool:
        error = getattr(event.result, "exception_info", None)
        if error is None or error.exception_type == "CancelledError":
            return False
        retry = self._retry_config
        if retry is None:
            return False
        excluded = getattr(retry, "exclude_exceptions", ()) or ()
        if error.exception_type in excluded:
            return False
        included = getattr(retry, "include_exceptions", ()) or ()
        if included and error.exception_type not in included:
            return False
        attempts = self._attempts.get(str(event.trial_name), 1)
        return attempts <= int(getattr(retry, "max_retries", 0) or 0)

    async def _record_trial(
        self,
        trial_result: Any,
        *,
        recorder: PhoenixRecorder | None = None,
    ) -> None:
        if self.plan is None or self.snapshot is None:
            raise HarborPluginError("Phoenix trial recording started before job setup completed.")
        try:
            slot = self.plan.trial_for(str(trial_result.trial_name))
        except KeyError as error:
            raise HarborPluginError(
                f"Harbor returned unplanned trial {trial_result.trial_name!r}."
            ) from error
        key = (
            slot.identity_digest,
            self.snapshot.example_ids[slot.task_id],
            slot.repetition,
        )
        existing = self._runs.get(key)
        if existing is not None and PhoenixRecorder.can_reuse_run(
            existing, trial_result=trial_result
        ):
            return

        if recorder is not None:
            run = await recorder.record_trial(
                plan=self.plan,
                snapshot=self.snapshot,
                experiments=self.experiments,
                trial_result=trial_result,
            )
        else:
            async with self._open_client() as client:
                live_recorder = PhoenixRecorder(
                    client,
                    experiment_name_template=self.experiment_name_template,
                )
                run = await live_recorder.record_trial(
                    plan=self.plan,
                    snapshot=self.snapshot,
                    experiments=self.experiments,
                    trial_result=trial_result,
                )
        self._runs[key] = run

    @contextlib.asynccontextmanager
    async def _open_client(self) -> AsyncIterator[AsyncClient]:
        """Open a Phoenix client and close its HTTP connection pool on exit."""
        async with httpx.AsyncClient(
            base_url=self.endpoint,
            headers=_update_headers(None, self._api_key),
            timeout=_DEFAULT_CLIENT_TIMEOUT,
        ) as http_client:
            yield AsyncClient(http_client=http_client)

    def _report_started(
        self,
        plan: JobPlan,
        experiments: dict[str, ExperimentHandle],
    ) -> None:
        for experiment_slice in plan.slices:
            handle = experiments[experiment_slice.identity_digest]
            logger.info(
                "%s Phoenix experiment %r (%s) for agent %r on model %r.",
                "Created" if handle.created else "Recovered",
                handle.name,
                handle.experiment_id,
                experiment_slice.agent_name,
                experiment_slice.model_name or "default",
            )
        missing = ["scores"]
        if self.trace_mode != "none":
            missing.append(f"{self.trace_mode} traces")
        logger.warning("Not recorded yet: %s.", ", ".join(missing))
