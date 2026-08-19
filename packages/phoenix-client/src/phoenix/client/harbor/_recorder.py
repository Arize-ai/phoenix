"""Maps a resolved Harbor job onto Phoenix datasets and experiments.

Nothing in this module imports Harbor. It works entirely against the frozen
records the compatibility adapter produces, which keeps it testable without a
Harbor installation and keeps Harbor's private surface in one place.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, cast

from phoenix.client.__generated__ import v1
from phoenix.client.client import AsyncClient
from phoenix.client.harbor._errors import HarborPluginError
from phoenix.client.harbor._model import ExperimentSlice, JobPlan, canonical_digest

logger = logging.getLogger(__name__)

__all__ = [
    "DEFAULT_EXPERIMENT_NAME_TEMPLATE",
    "DatasetSnapshot",
    "ExperimentHandle",
    "PhoenixRecorder",
]

DEFAULT_EXPERIMENT_NAME_TEMPLATE = "{job_name} · {agent} · {model}"

_INTEGRATION = "harbor"


@dataclass(frozen=True)
class DatasetSnapshot:
    """The Phoenix dataset version a job's experiments are pinned to."""

    dataset_id: str
    version_id: str
    example_ids: Mapping[str, str]
    """Harbor task ID -> Phoenix example node ID (a GlobalID).

    Phoenix returns two identifiers per example: ``id`` holds the external
    Harbor task ID we uploaded, while ``node_id`` holds the GlobalID. Only the
    GlobalID is accepted when logging experiment runs.
    """


@dataclass(frozen=True)
class ExperimentHandle:
    """A Phoenix experiment recording one agent/model configuration."""

    experiment_id: str
    name: str
    project_name: str | None
    identity_digest: str
    created: bool


class PhoenixRecorder:
    """Creates and recovers the Phoenix objects a Harbor job records into."""

    def __init__(
        self,
        client: AsyncClient,
        *,
        experiment_name_template: str = DEFAULT_EXPERIMENT_NAME_TEMPLATE,
    ) -> None:
        self._client = client
        self._experiment_name_template = experiment_name_template

    async def sync_dataset(self, plan: JobPlan) -> DatasetSnapshot:
        """Upload the job's complete task set as one Phoenix dataset version.

        The upload is a declarative full snapshot: Phoenix reconciles the
        uploaded examples against the dataset by external ID, and only mints a
        new version when something actually changed. Re-running an unchanged
        job therefore reuses the existing version rather than accumulating
        empty ones.
        """
        examples = plan.examples()
        try:
            # `action="update"` is what makes this a snapshot rather than an
            # append: Phoenix matches the uploaded examples against the dataset
            # by external ID and deletes any it no longer sees. The public
            # `create_dataset` wrapper hard-codes the same action, but the
            # distinction matters enough here to state it at the call site.
            dataset = await self._client.datasets._upload_json_dataset(  # noqa: SLF001  # pyright: ignore[reportPrivateUsage]
                dataset_name=plan.dataset.name,
                dataset_description=(
                    f"Harbor dataset {plan.dataset.name!r} ({plan.dataset.kind}), "
                    "synchronized by the Phoenix Harbor plugin."
                ),
                inputs=[example["input"] for example in examples],
                outputs=[example["output"] for example in examples],
                metadata=[example["metadata"] for example in examples],
                example_ids=[example["id"] for example in examples],
                action="update",
            )
        except Exception as error:
            raise HarborPluginError(
                f"Could not synchronize Harbor tasks into Phoenix dataset "
                f"{plan.dataset.name!r}: {error}"
            ) from error

        version_id = dataset.version_id
        if not version_id:
            raise HarborPluginError(
                f"Phoenix did not report a version for dataset {plan.dataset.name!r}; "
                "experiments cannot be pinned to a dataset version."
            )

        example_ids = _example_ids_by_task(dataset.examples)
        missing = [task.task_id for task in plan.tasks if task.task_id not in example_ids]
        if missing:
            raise HarborPluginError(
                "Phoenix did not return examples for these Harbor tasks: "
                f"{', '.join(sorted(missing))}. Stable external example IDs require "
                "Phoenix server >=15.0."
            )
        logger.info(
            "Phoenix dataset %r synchronized: %d task(s) at version %s.",
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
        """Create or recover one experiment per agent/model configuration."""
        try:
            existing = await self._client.experiments.list(dataset_id=snapshot.dataset_id)
        except Exception as error:
            raise HarborPluginError(
                f"Could not list Phoenix experiments for dataset {plan.dataset.name!r}: {error}"
            ) from error

        names = _experiment_names(plan, self._experiment_name_template)
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
                f"{len(matches)} Phoenix experiments already claim the identity of "
                f"{name!r} ({ids}). The plugin will not guess which one to extend; "
                "delete the duplicates or run this Harbor job under a new job name."
            )
        if matches:
            match = matches[0]
            _require_consistent(match, snapshot=snapshot, plan=plan, name=name)
            logger.info("Recovered Phoenix experiment %r (%s).", name, match["id"])
            return ExperimentHandle(
                experiment_id=str(match["id"]),
                name=str(match.get("name") or name),
                project_name=match.get("project_name"),
                identity_digest=identity,
                created=False,
            )

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
        logger.info("Created Phoenix experiment %r (%s).", name, experiment["id"])
        return ExperimentHandle(
            experiment_id=str(experiment["id"]),
            name=str(experiment.get("name") or name),
            project_name=experiment.get("project_name"),
            identity_digest=identity,
            created=True,
        )


def experiment_identity(
    plan: JobPlan,
    snapshot: DatasetSnapshot,
    experiment_slice: ExperimentSlice,
) -> str:
    """Return the immutable identity of one experiment.

    A Harbor job ID is part of the identity so two executions of the same
    benchmark become two experiments. Without it their runs would collide on
    ``(experiment, example, repetition)``, and Phoenix refuses to overwrite a
    successful run -- so the second execution could not be recorded at all.
    Comparison over time is expressed as several experiments on one dataset.
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
    """Return the Harbor identity an experiment claims, if it claims one.

    Experiments on the same dataset may come from anywhere -- a notebook, the
    pytest plugin, another integration -- so the ``integration`` discriminator
    is checked before the digest is trusted.
    """
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
    """Refuse to reuse an experiment whose shape no longer matches the plan.

    The identity digest already covers the dataset version, so a mismatch here
    means the stored metadata and the stored columns disagree -- something the
    plugin cannot repair and must not paper over.
    """
    stored_version = experiment.get("dataset_version_id")
    if stored_version and stored_version != snapshot.version_id:
        raise HarborPluginError(
            f"Phoenix experiment {name!r} ({experiment['id']}) is pinned to dataset "
            f"version {stored_version}, but this job resolved version "
            f"{snapshot.version_id}."
        )
    stored_repetitions = experiment.get("repetitions")
    if stored_repetitions and int(stored_repetitions) != plan.repetitions:
        raise HarborPluginError(
            f"Phoenix experiment {name!r} ({experiment['id']}) records "
            f"{stored_repetitions} repetition(s), but this job plans "
            f"{plan.repetitions}. Phoenix cannot change an experiment's repetition "
            "count; run the job under a new job name."
        )


def _example_ids_by_task(examples: Sequence[v1.DatasetExample]) -> dict[str, str]:
    """Map each Harbor task ID to the Phoenix example GlobalID it resolved to.

    Phoenix returns the external ID we uploaded in ``id`` and its own GlobalID
    in ``node_id``. Only the GlobalID is accepted when logging experiment runs.
    """
    from phoenix.client.resources.experiments import (
        _example_global_id,  # pyright: ignore[reportPrivateUsage]
    )

    # The uploaded version holds exactly the snapshot we just sent, so every
    # example's external ID is a Harbor task ID.
    return {
        str(example["id"]): _example_global_id(example) for example in examples if example.get("id")
    }


def _experiment_names(plan: JobPlan, template: str) -> dict[str, str]:
    """Render experiment names, disambiguating any that collide.

    Phoenix's compare view identifies experiments by name, so two agent
    configurations that render the same name would be indistinguishable there.
    Configurations differing only in skills, keyword arguments, or environment
    do collide under the default template, so the short configuration digest is
    appended to every member of a colliding group.
    """
    rendered: dict[str, str] = {}
    for experiment_slice in plan.slices:
        rendered[experiment_slice.identity_digest] = _render_name(template, plan, experiment_slice)
    counts: dict[str, int] = {}
    for name in rendered.values():
        counts[name] = counts.get(name, 0) + 1
    return {
        digest: (f"{name} · {plan.slice_for(digest).short_identity}" if counts[name] > 1 else name)
        for digest, name in rendered.items()
    }


def _render_name(template: str, plan: JobPlan, experiment_slice: ExperimentSlice) -> str:
    fields = {
        "job_name": plan.job_name or plan.job_id,
        "job_id": plan.job_id,
        "dataset": plan.dataset.name,
        "agent": experiment_slice.agent_name,
        "model": experiment_slice.model_name or "default",
    }
    try:
        name = template.format(**fields)
    except (KeyError, IndexError, ValueError) as error:
        raise HarborPluginError(
            f"Invalid experiment_name_template {template!r}: {error}. Available fields: "
            f"{', '.join(sorted(fields))}."
        ) from error
    name = name.strip()
    if not name:
        raise HarborPluginError(
            f"experiment_name_template {template!r} rendered an empty experiment name."
        )
    return name
