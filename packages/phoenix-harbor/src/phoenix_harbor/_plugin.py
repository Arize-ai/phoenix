from __future__ import annotations

from harbor.job import Job
from harbor.models.job.plugin import BaseJobPlugin
from harbor.models.job.result import JobResult

from phoenix_harbor._config import (
    DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    PhoenixConfig,
    TraceMode,
)


class PhoenixJobPlugin(BaseJobPlugin):
    def __init__(
        self,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        trace_mode: str | TraceMode = TraceMode.ATIF,
        experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE,
        project: str | None = None,
    ) -> None:
        super().__init__()
        self.config = PhoenixConfig.from_sources(
            dataset=dataset,
            endpoint=endpoint,
            api_key=api_key,
            trace_mode=trace_mode,
            experiment_name_template=experiment_name_template,
            project=project,
        )

    async def on_job_start(self, job: Job) -> None:
        del job
        raise RuntimeError(
            "The Phoenix Harbor plugin package is scaffolded but lifecycle orchestration "
            "is not implemented yet."
        )

    async def on_job_end(self, job_result: JobResult) -> None:
        del job_result
