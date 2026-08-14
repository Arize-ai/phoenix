from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any

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

    async def on_job_start(self, job: Job) -> None:
        del job
        raise RuntimeError(
            "The Phoenix Harbor plugin is configured but lifecycle orchestration is not "
            "implemented yet."
        )

    async def on_job_end(self, job_result: JobResult) -> None:
        del job_result
