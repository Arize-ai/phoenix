# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# Harbor cannot be installed on the client's Python 3.10 and 3.11 CI jobs.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
# pyright: reportUntypedBaseClass=false, reportGeneralTypeIssues=false
from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncGenerator
from typing import Literal

import httpx
from harbor.job import Job
from harbor.models.job.config import RetryConfig
from harbor.models.job.plugin import BaseJobPlugin
from harbor.models.job.result import JobResult
from harbor.models.trial.result import TrialResult
from harbor.trial.hooks import TrialHookEvent
from typing_extensions import override

from phoenix.client.__generated__ import v1
from phoenix.client.client import (
    _DEFAULT_CLIENT_TIMEOUT,  # pyright: ignore[reportPrivateUsage]
    AsyncClient,
    _update_headers,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.harbor._adapter import build_job_plan, existing_trial_results
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import JobPlan
from phoenix.client.harbor._naming import (
    validate_experiment_name_for_plan,
    validate_experiment_naming,
)
from phoenix.client.harbor._recorder import (
    DatasetSnapshot,
    ExperimentHandle,
    PhoenixRecorder,
    RunKey,
)
from phoenix.client.harbor._scores import extract_evaluations
from phoenix.client.utils.config import get_base_url, get_env_phoenix_api_key

logger = logging.getLogger(__name__)


class PhoenixJobPlugin(BaseJobPlugin):
    """Record a Harbor job as a Phoenix dataset and experiments."""

    def __init__(
        self,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        trace_mode: Literal["none"] = "none",
        experiment_name: str | None = None,
        experiment_name_template: str | None = None,
    ) -> None:
        """Configure Phoenix recording for a Harbor job.

        Args:
            dataset: Phoenix dataset name override. By default, the plugin derives the name from
                Harbor's dataset configuration or direct task.
            endpoint: Phoenix HTTP endpoint. Defaults to ``PHOENIX_COLLECTOR_ENDPOINT``.
            api_key: Phoenix API key. Defaults to ``PHOENIX_API_KEY``.
            trace_mode: Trace recording mode. This version supports only ``"none"``.
            experiment_name: Exact Phoenix experiment name. This is only valid when the Harbor
                job resolves one experiment slice.
            experiment_name_template: Format string used to name one Phoenix experiment per
                resolved agent configuration. Supported fields are published in
                ``EXPERIMENT_NAME_TEMPLATE_FIELDS``.
        """
        super().__init__()
        if trace_mode != "none":
            raise ValueError(
                f"Unsupported trace_mode {trace_mode!r}. Only trace_mode='none' is available."
            )

        self.dataset = dataset
        self.endpoint = endpoint or str(get_base_url())
        self._api_key = api_key or get_env_phoenix_api_key()
        self.experiment_name, self.experiment_name_template = validate_experiment_naming(
            experiment_name=experiment_name,
            experiment_name_template=experiment_name_template,
        )

        self.plan: JobPlan | None = None
        self.snapshot: DatasetSnapshot | None = None
        self.experiments: dict[str, ExperimentHandle] = {}
        self._runs: dict[RunKey, v1.ExperimentRun] = {}
        self._attempts: dict[str, int] = {}
        self._retry_config: RetryConfig | None = None
        self._record_lock = asyncio.Lock()
        self._terminal_failure: Exception | None = None

    @override
    async def on_job_start(self, job: Job) -> None:
        plan = build_job_plan(job, dataset_override=self.dataset)
        validate_experiment_name_for_plan(plan, experiment_name=self.experiment_name)
        _validate_step_names(plan)
        resumed_trials = existing_trial_results(job)
        async with self._open_client() as client:
            recorder = PhoenixRecorder(
                client,
                experiment_name=self.experiment_name,
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
                await self._record_trial_result(trial_result, recorder=recorder)

        self._retry_config = job.config.retry
        try:
            job.on_trial_started(self._on_trial_started)
            job.on_trial_ended(self._on_trial_ended)
        except AttributeError as error:
            raise HarborPluginError(
                "Harbor does not expose trial lifecycle hooks. Install a supported Harbor version."
            ) from error
        self._report_started(plan, experiments)

    @override
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
                await self._record_trial_result(event.result)
            except Exception as error:
                self._terminal_failure = error
                raise

    def _will_retry(self, event: TrialHookEvent) -> bool:
        error = event.result.exception_info
        if error is None or error.exception_type == "CancelledError":
            return False
        retry = self._retry_config
        if retry is None:
            return False
        excluded = retry.exclude_exceptions or set()
        if error.exception_type in excluded:
            return False
        included = retry.include_exceptions or set()
        if included and error.exception_type not in included:
            return False
        attempts = self._attempts.get(str(event.trial_name), 1)
        return attempts <= retry.max_retries

    async def _record_trial_result(
        self,
        trial_result: TrialResult,
        *,
        recorder: PhoenixRecorder | None = None,
    ) -> None:
        if self.plan is None or self.snapshot is None:
            raise HarborPluginError("Phoenix trial recording started before job setup completed.")
        plan = self.plan
        snapshot = self.snapshot
        try:
            slot = plan.trial_for(str(trial_result.trial_name))
        except KeyError as error:
            raise HarborPluginError(
                f"Harbor returned unplanned trial {trial_result.trial_name!r}."
            ) from error
        run_key = (
            slot.identity_digest,
            snapshot.example_ids[slot.task_id],
            slot.repetition,
        )
        existing_experiment_run = self._runs.get(run_key)
        reusable_experiment_run = (
            existing_experiment_run
            if existing_experiment_run is not None
            and PhoenixRecorder.can_reuse_run(
                existing_experiment_run,
                trial_result=trial_result,
            )
            else None
        )
        task = plan.task_for(slot.task_id)
        evaluations = extract_evaluations(
            trial_result,
            multi_step_reward_strategy=task.multi_step_reward_strategy,
        )

        async def record_run_and_evaluations(
            phoenix_recorder: PhoenixRecorder,
        ) -> v1.ExperimentRun:
            # A resumed job may already have an immutable successful run. Reuse it,
            # then upsert evaluations that an interrupted ingestion may have missed.
            run = reusable_experiment_run or await phoenix_recorder.record_experiment_run(
                plan=plan,
                snapshot=snapshot,
                experiments=self.experiments,
                trial_result=trial_result,
            )
            await phoenix_recorder.record_evaluations(str(run["id"]), evaluations)
            return run

        if recorder is not None:
            run = await record_run_and_evaluations(recorder)
        else:
            async with self._open_client() as client:
                live_recorder = PhoenixRecorder(
                    client,
                    experiment_name=self.experiment_name,
                    experiment_name_template=self.experiment_name_template,
                )
                run = await record_run_and_evaluations(live_recorder)
        self._runs[run_key] = run

    @contextlib.asynccontextmanager
    async def _open_client(self) -> AsyncGenerator[AsyncClient, None]:
        """Open a Phoenix client and close its HTTP connection pool on exit."""
        async with httpx.AsyncClient(
            base_url=self.endpoint,
            headers=_update_headers(None, self._api_key),
            timeout=_DEFAULT_CLIENT_TIMEOUT,
            transport=httpx.AsyncHTTPTransport(retries=2),
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


def _validate_step_names(plan: JobPlan) -> None:
    """Reject step names that cannot produce unique evaluation names."""
    for task in plan.tasks:
        seen: set[str] = set()
        for step in task.steps:
            name = step.name
            if not name:
                raise HarborPluginError(
                    f"Harbor task {task.task_id!r} has an empty step name; evaluation names "
                    "cannot be generated."
                )
            if name in seen:
                raise HarborPluginError(
                    f"Harbor task {task.task_id!r} repeats step name {name!r}; its evaluation "
                    "names would collide."
                )
            seen.add(name)
