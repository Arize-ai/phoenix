from __future__ import annotations

from typing import Protocol, runtime_checkable

from phoenix_harbor._config import PhoenixConfig
from phoenix_harbor._models import EvaluationRecord, JobPlan, TracePlan, TrialRecord


@runtime_checkable
class HarborAdapter(Protocol):
    def build_job_plan(self, job: object, config: PhoenixConfig) -> JobPlan: ...

    def build_trial_record(
        self, event: object, plan: JobPlan
    ) -> tuple[TrialRecord, tuple[EvaluationRecord, ...], TracePlan]: ...


@runtime_checkable
class PhoenixRepository(Protocol):
    async def prepare_job(self, plan: JobPlan, config: PhoenixConfig) -> None: ...

    async def write_trial(
        self,
        trial: TrialRecord,
        evaluations: tuple[EvaluationRecord, ...],
        trace: TracePlan,
    ) -> None: ...
