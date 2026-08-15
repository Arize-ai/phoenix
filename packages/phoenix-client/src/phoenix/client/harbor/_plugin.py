from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any, Literal

from phoenix.client.utils.config import get_base_url, get_env_phoenix_api_key, get_env_project_name

# Harbor is an optional dependency that requires Python >=3.12.
if TYPE_CHECKING and sys.version_info >= (3, 12):
    from harbor.job import Job
    from harbor.models.job.result import JobResult
else:
    Job = Any
    JobResult = Any


class PhoenixJobPlugin:
    """Records Harbor evaluation jobs in Phoenix.

    Registered in Harbor's ``harbor.plugins`` entry-point group as ``phoenix``.
    """

    def __init__(
        self,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        project: str | None = None,
        trace_mode: Literal["atif", "otlp", "none"] = "atif",
    ) -> None:
        if trace_mode not in ("atif", "otlp", "none"):
            raise ValueError(f"unsupported trace_mode: {trace_mode!r}")

        self.dataset = dataset
        self.endpoint = endpoint or str(get_base_url())
        self._api_key = api_key or get_env_phoenix_api_key()
        self.project = project or get_env_project_name()
        # TODO: Implement trace export for the selected mode.
        self.trace_mode = trace_mode

    async def on_job_start(self, job: Job) -> None:
        del job
        raise RuntimeError(
            "The Phoenix Harbor plugin is configured but lifecycle orchestration is not "
            "implemented yet."
        )

    async def on_job_end(self, job_result: JobResult) -> None:
        del job_result
