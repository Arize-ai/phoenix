from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any

from phoenix.client.harbor._config import (
    DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    DEFAULT_TRACE_MODE,
    PhoenixConfig,
)

# `harbor` requires Python >=3.12 and pulls a large dependency tree, so it is never imported
# at runtime and is not a dependency of this package. Harbor's plugin contract is a
# @runtime_checkable Protocol, so structural conformance is enough: Harbor accepts this class
# without it subclassing harbor.models.job.plugin.BaseJobPlugin.
#
# The version guard means type checkers configured for the client's 3.10 floor take the else
# branch and never look for harbor at all. Where a checker does take the import branch,
# harbor ships no py.typed, so the names still resolve to Any (see [[tool.mypy.overrides]]
# in pyproject). Either way the annotations below are documentation for readers.
if TYPE_CHECKING and sys.version_info >= (3, 12):
    from harbor.job import Job
    from harbor.models.job.result import JobResult
else:
    Job = Any
    JobResult = Any


class PhoenixJobPlugin:
    """Records Harbor evaluation jobs in Phoenix.

    Registered in Harbor's ``harbor.plugins`` entry-point group as ``phoenix`` and selected
    with ``harbor run --plugin phoenix``. Settings are passed through ``--plugin-kwarg``.

    Experimental. This module tracks a pre-1.0 external harness and is not covered by the
    stability guarantees of the rest of ``arize-phoenix-client``.
    """

    def __init__(
        self,
        *,
        dataset: str | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        trace_mode: str = DEFAULT_TRACE_MODE,
        experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE,
        project: str | None = None,
    ) -> None:
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
            "The Phoenix Harbor plugin is configured but lifecycle orchestration is not "
            "implemented yet."
        )

    async def on_job_end(self, job_result: JobResult) -> None:
        del job_result
