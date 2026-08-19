from __future__ import annotations

import contextlib
import logging
import sys
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Literal

import httpx

# The plugin owns the connection pool it hands to ``AsyncClient`` (see
# ``_open_client``), so it needs the same defaults ``AsyncClient`` would apply.
# These live in a sibling module of the same distribution, not another package.
from phoenix.client.client import (
    _DEFAULT_CLIENT_TIMEOUT,  # pyright: ignore[reportPrivateUsage]
    AsyncClient,
    _update_headers,  # pyright: ignore[reportPrivateUsage]
)
from phoenix.client.harbor._adapter import build_job_plan
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import JobPlan
from phoenix.client.harbor._recorder import (
    DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    DatasetSnapshot,
    ExperimentHandle,
    PhoenixRecorder,
)
from phoenix.client.utils.config import get_base_url, get_env_phoenix_api_key, get_env_project_name

# Harbor is an optional dependency that requires Python >=3.12.
if TYPE_CHECKING and sys.version_info >= (3, 12):
    from harbor.job import Job
    from harbor.models.job.result import JobResult
else:
    Job = Any
    JobResult = Any

logger = logging.getLogger(__name__)

TraceMode = Literal["atif", "otlp", "none"]

_TRACE_MODES: tuple[str, ...] = ("atif", "otlp", "none")


class PhoenixJobPlugin:
    """Records Harbor evaluation jobs in Phoenix.

    Registered in Harbor's ``harbor.plugins`` entry-point group as ``phoenix``,
    so a job records to Phoenix with ``harbor run --plugin phoenix``.

    At job start the plugin resolves Harbor's task and trial plan, synchronizes
    the tasks into a Phoenix dataset as one version, and creates or recovers one
    Phoenix experiment for each agent and model configuration in the job.

    Selecting this plugin makes Phoenix recording a requirement of the job:
    anything that would leave the job unrecorded is raised from
    ``on_job_start``, which Harbor propagates, stopping the job before any trial
    compute is spent.

    Not yet implemented: experiment runs, evaluation scores, and trace linkage.
    Those land in follow-up work; until then a recorded job produces a dataset
    and empty experiments.
    """

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

    async def on_job_start(self, job: Job) -> None:
        plan = build_job_plan(job, dataset_override=self.dataset)
        async with self._open_client() as client:
            recorder = PhoenixRecorder(
                client,
                experiment_name_template=self.experiment_name_template,
            )
            snapshot = await recorder.sync_dataset(plan)
            experiments = await recorder.resolve_experiments(plan, snapshot)

        self.plan = plan
        self.snapshot = snapshot
        self.experiments = experiments
        self._report_started(plan, experiments)

    async def on_job_end(self, job_result: JobResult) -> None:
        del job_result
        # Harbor logs and swallows exceptions from this hook, so nothing the job
        # depends on may be written here.
        if self.plan is None:
            return
        logger.info(
            "Harbor job %s recorded in Phoenix dataset %r across %d experiment(s).",
            self.plan.job_id,
            self.plan.dataset.name,
            len(self.experiments),
        )

    @contextlib.asynccontextmanager
    async def _open_client(self) -> AsyncIterator[AsyncClient]:
        """Yield a Phoenix client bound to a connection pool this plugin owns.

        ``AsyncClient`` has no close method, so the underlying ``httpx`` client
        is constructed here and closed on exit rather than left to the
        interpreter. Every Phoenix call in this stage happens inside
        ``on_job_start``; when runs start streaming from trial-end callbacks the
        pool will need to stay open for the life of the job instead.
        """
        async with httpx.AsyncClient(
            base_url=self.endpoint,
            headers=_update_headers(None, self._api_key),
            timeout=_DEFAULT_CLIENT_TIMEOUT,
        ) as http_client:
            try:
                yield AsyncClient(http_client=http_client)
            except HarborPluginError:
                raise
            except Exception as error:
                raise HarborPluginError(
                    f"Phoenix recording failed for this Harbor job: {error}"
                ) from error

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
        logger.warning(
            "The Phoenix Harbor plugin records the dataset and experiments only. "
            "Trial results, scores%s are not recorded yet.",
            "" if self.trace_mode == "none" else f", and {self.trace_mode} traces",
        )
