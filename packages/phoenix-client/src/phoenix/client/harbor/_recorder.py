# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# Harbor cannot be installed on the client's Python 3.10 and 3.11 CI jobs.
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
"""Write a resolved Harbor job to Phoenix."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, cast

import httpx
from harbor.models.trial.result import TrialResult

from phoenix.client.__generated__ import v1
from phoenix.client.client import AsyncClient
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import ExperimentSlice, JobPlan, canonical_digest
from phoenix.client.harbor._naming import experiment_names, validate_experiment_naming
from phoenix.client.harbor._scores import ExtractedEvaluation
from phoenix.client.harbor._traces import HarborTrace

logger = logging.getLogger(__name__)

__all__ = [
    "DatasetSnapshot",
    "ExperimentHandle",
    "PhoenixRecorder",
    "trial_output",
]

_INTEGRATION = "harbor"
_TRACE_PERSISTENCE_TIMEOUT_SECONDS = 30.0

RunKey = tuple[str, str, int]


@dataclass(frozen=True)
class DatasetSnapshot:
    dataset_id: str
    version_id: str
    example_ids: Mapping[str, str]
    """Harbor task ID to Phoenix example GlobalID."""


@dataclass(frozen=True)
class ExperimentHandle:
    experiment_id: str
    name: str
    created: bool
    project_name: str | None = None


class PhoenixRecorder:
    """Create or recover Phoenix records for a Harbor job."""

    def __init__(
        self,
        client: AsyncClient,
        *,
        experiment_name: str | None = None,
        experiment_name_template: str | None = None,
    ) -> None:
        self._client = client
        self._experiment_name, self._experiment_name_template = validate_experiment_naming(
            experiment_name=experiment_name,
            experiment_name_template=experiment_name_template,
        )

    async def sync_dataset(self, plan: JobPlan) -> DatasetSnapshot:
        """Create the dataset or replace its contents with a new version."""
        examples = [task.to_example() for task in plan.tasks]
        try:
            # Update creates the dataset or a new version from this complete snapshot.
            dataset = await self._client.datasets.create_dataset(
                name=plan.dataset.name,
                dataset_description=f"Harbor dataset {plan.dataset.name!r} ({plan.dataset.kind}).",
                examples=examples,
            )
        except Exception as error:
            raise HarborPluginError(
                f"Failed to upload Harbor tasks to Phoenix dataset {plan.dataset.name!r}: {error}"
            ) from error

        version_id = dataset.version_id
        if not version_id:
            raise HarborPluginError(
                f"Phoenix returned no version for dataset {plan.dataset.name!r}."
            )

        example_ids = _example_ids_by_task(dataset.examples)
        missing = [task.task_id for task in plan.tasks if task.task_id not in example_ids]
        if missing:
            raise HarborPluginError(
                f"Missing Phoenix examples for Harbor tasks: {', '.join(sorted(missing))}. "
                "Requires Phoenix server >=15.0."
            )
        logger.info(
            "Phoenix dataset %r: %d task(s), version %s.",
            plan.dataset.name,
            len(plan.tasks),
            version_id,
        )
        return DatasetSnapshot(
            dataset_id=dataset.id,
            version_id=version_id,
            example_ids=example_ids,
        )

    async def resolve_experiments(
        self,
        plan: JobPlan,
        snapshot: DatasetSnapshot,
    ) -> dict[str, ExperimentHandle]:
        """Resolve one experiment per agent configuration."""
        names = experiment_names(
            plan,
            experiment_name=self._experiment_name,
            experiment_name_template=self._experiment_name_template,
        )
        try:
            existing = await self._client.experiments.list(dataset_id=snapshot.dataset_id)
        except Exception as error:
            raise HarborPluginError(
                f"Could not list Phoenix experiments for dataset {plan.dataset.name!r}: {error}"
            ) from error

        handles: dict[str, ExperimentHandle] = {}
        for experiment_slice in plan.slices:
            identity = experiment_identity(plan, snapshot, experiment_slice)
            handles[experiment_slice.identity_digest] = await self._resolve_experiment(
                plan=plan,
                snapshot=snapshot,
                experiment_slice=experiment_slice,
                identity=identity,
                name=names[experiment_slice.identity_digest],
                existing=existing,
            )
        return handles

    async def existing_runs(
        self,
        experiments: Mapping[str, ExperimentHandle],
    ) -> dict[RunKey, v1.ExperimentRun]:
        """Return runs keyed by agent identity, example, and repetition."""
        indexed: dict[RunKey, v1.ExperimentRun] = {}
        for identity, experiment in experiments.items():
            for run in await self._list_runs(experiment):
                key = _run_key(identity, run)
                if key in indexed:
                    raise HarborPluginError(
                        f"Phoenix experiment {experiment.name!r} returned more than one run "
                        f"for example {key[1]!r}, repetition {key[2]}."
                    )
                indexed[key] = run
        return indexed

    async def _list_runs(self, experiment: ExperimentHandle) -> list[v1.ExperimentRun]:
        try:
            return await self._client.experiments._get_all_experiment_runs(  # noqa: SLF001  # pyright: ignore[reportPrivateUsage]
                experiment_id=experiment.experiment_id
            )
        except Exception as error:
            raise HarborPluginError(
                f"Could not list runs for Phoenix experiment {experiment.name!r}: {error}"
            ) from error

    @staticmethod
    def can_reuse_run(
        run: v1.ExperimentRun,
        *,
        trial_result: TrialResult,
        expected_trace_id: str | None = None,
    ) -> bool:
        """Validate an immutable successful run or allow a failed run to be replaced."""
        if run.get("error"):
            return False

        expected_output = trial_output(trial_result)
        expected_error = _trial_error(trial_result)
        mismatches: list[str] = []
        if run.get("output") != expected_output:
            mismatches.append("output")
        if expected_error is not None:
            mismatches.append("error")
        stored_trace_id = run.get("trace_id")
        if stored_trace_id is not None and stored_trace_id != expected_trace_id:
            mismatches.append("trace")
        if mismatches:
            trial_name = str(trial_result.trial_name)
            fields = ", ".join(mismatches)
            raise HarborPluginError(
                f"Phoenix run {run['id']} already records Harbor trial {trial_name!r}, but its "
                f"{fields} does not match the terminal Harbor result. Use a new Harbor job name "
                "or resolve the conflicting Phoenix run."
            )
        return True

    async def _recover_conflicting_run(
        self,
        *,
        experiment: ExperimentHandle,
        dataset_example_id: str,
        repetition: int,
        trial_result: TrialResult,
    ) -> v1.ExperimentRun:
        matches = [
            run
            for run in await self._list_runs(experiment)
            if str(run["dataset_example_id"]) == dataset_example_id
            and int(run["repetition_number"]) == repetition
        ]
        if len(matches) != 1:
            raise HarborPluginError(
                f"Phoenix rejected Harbor trial {trial_result.trial_name!r} as a duplicate, "
                f"but returned {len(matches)} matching runs for validation."
            )
        run = matches[0]
        if not self.can_reuse_run(run, trial_result=trial_result):
            raise HarborPluginError(
                f"Phoenix rejected Harbor trial {trial_result.trial_name!r} as a duplicate, "
                "but the matching run is failed and should be writable."
            )
        return run

    async def record_experiment_run(
        self,
        *,
        plan: JobPlan,
        snapshot: DatasetSnapshot,
        experiments: Mapping[str, ExperimentHandle],
        trial_result: TrialResult,
        trace_id: str | None = None,
    ) -> v1.ExperimentRun:
        """Record one terminal Harbor trial as a Phoenix experiment run."""
        trial_name = str(trial_result.trial_name)
        try:
            slot = plan.trial_for(trial_name)
        except KeyError as error:
            raise HarborPluginError(
                f"Harbor returned unplanned trial {trial_name!r}; cannot record it in Phoenix."
            ) from error
        experiment = experiments[slot.identity_digest]
        example_id = snapshot.example_ids[slot.task_id]
        start_time = trial_result.started_at
        end_time = trial_result.finished_at
        if start_time is None or end_time is None:
            raise HarborPluginError(
                f"Harbor trial {trial_name!r} has no complete start and end timestamps."
            )

        try:
            return await self._client.experiments.log_run(
                experiment_id=experiment.experiment_id,
                dataset_example_id=example_id,
                output=trial_output(trial_result),
                start_time=start_time,
                end_time=end_time,
                repetition_number=slot.repetition,
                trace_id=trace_id,
                error=_trial_error(trial_result),
            )
        except httpx.HTTPStatusError as error:
            if error.response.status_code == 409:
                return await self._recover_conflicting_run(
                    experiment=experiment,
                    dataset_example_id=example_id,
                    repetition=slot.repetition,
                    trial_result=trial_result,
                )
            raise HarborPluginError(
                f"Could not record Harbor trial {trial_name!r} in Phoenix experiment "
                f"{experiment.name!r}: {error}"
            ) from error
        except Exception as error:
            raise HarborPluginError(
                f"Could not record Harbor trial {trial_name!r} in Phoenix experiment "
                f"{experiment.name!r}: {error}"
            ) from error

    async def confirm_trace(
        self,
        *,
        experiment: ExperimentHandle,
        trace: HarborTrace,
    ) -> str | None:
        """Upload missing spans and return the trace ID after exact persistence."""
        try:
            project_name = await self._project_name(experiment)
            if project_name is None:
                logger.warning(
                    "Phoenix experiment %r has no trace project; recording the Harbor run "
                    "without a trace.",
                    experiment.name,
                )
                return None

            expected = {span["context"]["span_id"] for span in trace.spans}
            stored = await self._trace_span_ids(
                project_name=project_name,
                trace_id=trace.trace_id,
                expected_count=len(expected),
            )
            unexpected = stored - expected
            if unexpected:
                logger.warning(
                    "Phoenix trace %s in project %r contains unexpected span IDs; "
                    "refusing to attach it to the Harbor run.",
                    trace.trace_id,
                    project_name,
                )
                return None

            missing = expected - stored
            if missing:
                spans = [span for span in trace.spans if span["context"]["span_id"] in missing]
                try:
                    result = await self._client.spans.log_spans(
                        project_identifier=project_name,
                        spans=spans,
                    )
                    received = int(result.get("total_received", -1))
                    queued = int(result.get("total_queued", -1))
                    if received != len(spans) or queued != len(spans):
                        logger.warning(
                            "Phoenix accepted %d of %d Harbor trace spans for trace %s; "
                            "leaving the run untraced until replay.",
                            queued,
                            len(spans),
                            trace.trace_id,
                        )
                        return None
                except Exception:
                    # A prior async request can become visible between preflight and POST.
                    stored = await self._trace_span_ids(
                        project_name=project_name,
                        trace_id=trace.trace_id,
                        expected_count=len(expected),
                    )
                    if stored != expected:
                        raise

            loop = asyncio.get_running_loop()
            deadline = loop.time() + _TRACE_PERSISTENCE_TIMEOUT_SECONDS
            delay = 0.05
            while True:
                stored = await self._trace_span_ids(
                    project_name=project_name,
                    trace_id=trace.trace_id,
                    expected_count=len(expected),
                )
                if stored == expected:
                    return trace.trace_id
                if stored - expected:
                    logger.warning(
                        "Phoenix trace %s changed shape while being stored; leaving the Harbor "
                        "run untraced.",
                        trace.trace_id,
                    )
                    return None
                remaining = deadline - loop.time()
                if remaining <= 0:
                    logger.warning(
                        "Phoenix did not persist all spans for Harbor trace %s within %.0f "
                        "seconds; completed-job replay will retry.",
                        trace.trace_id,
                        _TRACE_PERSISTENCE_TIMEOUT_SECONDS,
                    )
                    return None
                await asyncio.sleep(min(delay, remaining))
                delay = min(delay * 2, 2.0)
        except Exception as error:
            logger.warning(
                "Could not store Harbor trace %s for Phoenix experiment %r: %s",
                trace.trace_id,
                experiment.name,
                error,
            )
            return None

    async def _project_name(self, experiment: ExperimentHandle) -> str | None:
        if experiment.project_name:
            return experiment.project_name
        detail = await self._client.experiments.get(experiment_id=experiment.experiment_id)
        project_name = detail.get("project_name")
        return str(project_name) if project_name else None

    async def _trace_span_ids(
        self,
        *,
        project_name: str,
        trace_id: str,
        expected_count: int,
    ) -> set[str]:
        spans = await self._client.spans.get_spans(
            project_identifier=project_name,
            trace_ids=[trace_id],
            limit=expected_count + 1,
        )
        return {span["context"]["span_id"] for span in spans}

    async def record_evaluations(
        self,
        run_id: str,
        records: Sequence[ExtractedEvaluation],
    ) -> None:
        """Upsert the complete evaluation set for an experiment run."""
        for record in records:
            try:
                await self._client.experiments.log_evaluation(
                    experiment_run_id=run_id,
                    name=record.name,
                    annotator_kind="CODE",
                    start_time=record.start_time,
                    end_time=record.end_time,
                    score=record.score,
                    label=record.label,
                    explanation=record.explanation,
                    metadata=record.metadata,
                )
            except Exception as error:
                raise HarborPluginError(
                    f"Could not record Harbor evaluation {record.name!r} for Phoenix run "
                    f"{run_id}: {error}"
                ) from error

    async def _resolve_experiment(
        self,
        *,
        plan: JobPlan,
        snapshot: DatasetSnapshot,
        experiment_slice: ExperimentSlice,
        identity: str,
        name: str,
        existing: Sequence[v1.Experiment],
    ) -> ExperimentHandle:
        matches = [
            experiment
            for experiment in existing
            if _identity_of(experiment.get("metadata")) == identity
        ]
        if len(matches) > 1:
            ids = ", ".join(sorted(str(match["id"]) for match in matches))
            raise HarborPluginError(
                f"{len(matches)} Phoenix experiments share identity {name!r} ({ids}). "
                "Delete duplicates, or use a new Harbor job name."
            )
        if matches:
            experiment = matches[0]
            _require_consistent(experiment, snapshot=snapshot, plan=plan, name=name)
            created = False
        else:
            try:
                experiment = await self._client.experiments.create(
                    dataset_id=snapshot.dataset_id,
                    dataset_version_id=snapshot.version_id,
                    experiment_name=name,
                    experiment_description=(
                        f"Harbor job {plan.job_name or plan.job_id} ({experiment_slice.agent_name})"
                    ),
                    experiment_metadata=_experiment_metadata(plan, experiment_slice, identity),
                    repetitions=plan.repetitions,
                )
            except Exception as error:
                raise HarborPluginError(
                    f"Could not create Phoenix experiment {name!r}: {error}"
                ) from error
            created = True
        return ExperimentHandle(
            experiment_id=str(experiment["id"]),
            name=str(experiment.get("name") or name),
            created=created,
            project_name=(
                str(experiment["project_name"]) if experiment.get("project_name") else None
            ),
        )


def experiment_identity(
    plan: JobPlan,
    snapshot: DatasetSnapshot,
    experiment_slice: ExperimentSlice,
) -> str:
    """Return an identity that separates job, dataset, and agent configuration.

    The job ID keeps separate executions from competing for the same immutable
    experiment run keys.
    """
    return canonical_digest(
        {
            "integration": _INTEGRATION,
            "job_id": plan.job_id,
            "dataset_version_id": snapshot.version_id,
            "agent": experiment_slice.identity_digest,
        }
    )


def _experiment_metadata(
    plan: JobPlan,
    experiment_slice: ExperimentSlice,
    identity: str,
) -> dict[str, Any]:
    return {
        "integration": _INTEGRATION,
        "harbor_identity_digest": identity,
        "harbor_job_id": plan.job_id,
        "harbor_job_name": plan.job_name,
        "harbor_version": plan.harbor_version,
        "harbor_dataset_name": plan.dataset.name,
        "harbor_dataset_kind": plan.dataset.kind,
        "harbor_agent": experiment_slice.describe(),
        "harbor_agent_digest": experiment_slice.identity_digest,
    }


def _identity_of(metadata: Any) -> str | None:
    if not isinstance(metadata, Mapping):
        return None
    fields = cast(Mapping[str, Any], metadata)
    if fields.get("integration") != _INTEGRATION:
        return None
    identity = fields.get("harbor_identity_digest")
    return str(identity) if identity else None


def _require_consistent(
    experiment: v1.Experiment,
    *,
    snapshot: DatasetSnapshot,
    plan: JobPlan,
    name: str,
) -> None:
    """Reject a recovered experiment that no longer matches the plan."""
    fields = cast(Mapping[str, Any], experiment)
    stored_version = fields.get("dataset_version_id")
    if stored_version is not None and stored_version != snapshot.version_id:
        raise HarborPluginError(
            f"Phoenix experiment {name!r} ({experiment['id']}) is pinned to dataset "
            f"version {stored_version}, but this job resolved version "
            f"{snapshot.version_id}."
        )
    stored_repetitions = fields.get("repetitions")
    if stored_repetitions is not None and int(stored_repetitions) != plan.repetitions:
        raise HarborPluginError(
            f"Phoenix experiment {name!r} ({experiment['id']}) has "
            f"{stored_repetitions} repetition(s); this job plans {plan.repetitions}. "
            "Use a new Harbor job name."
        )


def _example_ids_by_task(examples: Sequence[v1.DatasetExample]) -> dict[str, str]:
    """Map Harbor task IDs to Phoenix example GlobalIDs."""
    return {
        str(example["id"]): str(example["node_id"]) for example in examples if example.get("id")
    }


def _run_key(identity: str, run: v1.ExperimentRun) -> RunKey:
    return (
        identity,
        str(run["dataset_example_id"]),
        int(run["repetition_number"]),
    )


def trial_output(trial_result: TrialResult) -> dict[str, Any]:
    n_input, n_cache, n_output, cost = trial_result.compute_token_cost_totals()
    output: dict[str, Any] = {
        "harbor_trial_id": str(trial_result.id),
        "harbor_trial_name": str(trial_result.trial_name),
        "harbor_trial_uri": str(trial_result.trial_uri),
        "task_name": str(trial_result.task_name),
    }
    token_usage = {
        "input": n_input,
        "cache": n_cache,
        "output": n_output,
    }
    if any(value is not None for value in token_usage.values()):
        output["token_usage"] = token_usage
    if cost is not None:
        output["cost_usd"] = cost
    return output


def _trial_error(trial_result: TrialResult) -> str | None:
    errors: list[str] = []
    if error := trial_result.exception_info:
        errors.append(f"{error.exception_type}: {error.exception_message}")
    for step_result in trial_result.step_results or ():
        if (
            error := step_result.exception_info
        ) is not None and step_result.verifier_result is None:
            errors.append(
                f"step {step_result.step_name}: {error.exception_type}: {error.exception_message}"
            )
    return "; ".join(errors) or None
