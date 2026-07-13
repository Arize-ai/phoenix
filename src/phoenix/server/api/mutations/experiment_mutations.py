import asyncio
from datetime import datetime, timezone

import strawberry
from sqlalchemy import delete, or_, select, update
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]
from strawberry import UNSET
from strawberry.dataloader import DataLoader
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import EXPERIMENT_TOGGLE_COOLDOWN
from phoenix.db import models
from phoenix.db.helpers import get_eval_trace_ids_for_experiments, get_project_names_for_experiments
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.auth import IsLocked, IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, Conflict, CustomGraphQLError
from phoenix.server.api.experiment_tags import BASELINE_EXPERIMENT_TAG_NAME
from phoenix.server.api.input_types.DeleteExperimentsInput import DeleteExperimentsInput
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.PatchExperimentInput import PatchExperimentInput
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.ExperimentJob import ExperimentJob
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.utils import delete_projects, delete_traces
from phoenix.server.dml_event import ExperimentDeleteEvent


@strawberry.type
class ExperimentMutationPayload:
    experiments: list[Experiment]


@strawberry.type
class StopExperimentPayload:
    job: ExperimentJob


@strawberry.type
class ResumeExperimentPayload:
    job: ExperimentJob


@strawberry.type
class DismissExperimentPayload:
    experiment: Experiment


@strawberry.type
class ReinstateExperimentPayload:
    experiment: Experiment


@strawberry.type
class PatchExperimentPayload:
    experiment: Experiment


@strawberry.type
class SetExperimentBaselinePayload:
    dataset: Dataset
    experiment: Experiment
    previous_baseline_experiment: Experiment | None = None


@strawberry.type
class ExperimentMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def stop_experiment(
        self,
        info: Info[Context, None],
        experiment_id: GlobalID,
    ) -> StopExperimentPayload:
        """
        Stop a running experiment.

        Uses atomic UPDATE to prevent race conditions.
        Enforces cooldown to prevent rapid state thrashing.
        """
        exp_rowid = from_global_id_with_expected_type(experiment_id, Experiment.__name__)
        now = datetime.now(timezone.utc)

        async with info.context.db() as session:
            # Single atomic UPDATE: state guard + cooldown in one statement
            stmt = (
                update(models.ExperimentJob)
                .where(models.ExperimentJob.id == exp_rowid)
                .where(models.ExperimentJob.claimed_at.is_not(None))
                .where(
                    or_(
                        models.ExperimentJob.cooldown_until.is_(None),
                        models.ExperimentJob.cooldown_until <= now,
                    )
                )
                .values(
                    claimed_at=None,
                    claimed_by=None,
                    status="STOPPED",
                    cooldown_until=now + EXPERIMENT_TOGGLE_COOLDOWN,
                )
                .returning(models.ExperimentJob)
            )
            updated_config = await session.scalar(stmt)

            if updated_config is None:
                # 0 rows updated - diagnose why
                config = await session.get(models.ExperimentJob, exp_rowid)
                if config is None:
                    raise BadRequest(f"Experiment {experiment_id} not found")
                if config.claimed_at is None:
                    # Already stopped - idempotent return
                    return StopExperimentPayload(job=ExperimentJob(id=config.id, db_record=config))
                # Only remaining case: cooldown not elapsed
                raise BadRequest(f"Experiment {experiment_id} is still in cooldown")

        await info.context.experiment_runner.stop_experiment(updated_config.id)
        return StopExperimentPayload(
            job=ExperimentJob(id=updated_config.id, db_record=updated_config)
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def resume_experiment(
        self,
        info: Info[Context, None],
        experiment_id: GlobalID,
        credentials: list[GenerativeCredentialInput] | None = UNSET,
    ) -> ResumeExperimentPayload:
        """
        Resume a stopped experiment. Continues from where it left off.

        Uses atomic UPDATE to prevent race conditions (double-click, multi-replica).
        Enforces cooldown to prevent rapid state thrashing.
        """
        exp_rowid = from_global_id_with_expected_type(experiment_id, Experiment.__name__)
        now = datetime.now(timezone.utc)
        replica_id = info.context.experiment_runner.replica_id

        async with info.context.db() as session:
            # Single atomic UPDATE: state guard + cooldown in one statement
            # NOTE: COMPLETED experiments are resumable — the runner scans for
            # incomplete/errored runs, so resuming retries failures or picks up new examples.
            stmt = (
                update(models.ExperimentJob)
                .where(models.ExperimentJob.id == exp_rowid)
                .where(models.ExperimentJob.claimed_at.is_(None))
                .where(
                    or_(
                        models.ExperimentJob.cooldown_until.is_(None),
                        models.ExperimentJob.cooldown_until <= now,
                    )
                )
                .values(
                    claimed_at=now,
                    claimed_by=replica_id,
                    status="RUNNING",
                    cooldown_until=now + EXPERIMENT_TOGGLE_COOLDOWN,
                )
                .returning(models.ExperimentJob)
            )
            updated_config = await session.scalar(stmt)

            if updated_config is None:
                # 0 rows updated - diagnose why
                config = await session.get(models.ExperimentJob, exp_rowid)
                if config is None:
                    raise BadRequest(f"Experiment {experiment_id} not found")
                if config.claimed_at is not None:
                    # Already running - idempotent return
                    return ResumeExperimentPayload(
                        job=ExperimentJob(id=config.id, db_record=config)
                    )
                # Only remaining case: cooldown not elapsed
                raise BadRequest(f"Experiment {experiment_id} is still in cooldown")

        await info.context.experiment_runner.start_experiment(
            updated_config.id,
            credentials=credentials or None,
        )
        return ResumeExperimentPayload(
            job=ExperimentJob(id=updated_config.id, db_record=updated_config)
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def dismiss_experiment(
        self,
        info: Info[Context, None],
        experiment_id: GlobalID,
    ) -> DismissExperimentPayload:
        """
        Dismiss an experiment by marking it as ephemeral.
        Ephemeral experiments are eligible for cleanup by the sweeper daemon.
        """
        exp_rowid = from_global_id_with_expected_type(experiment_id, Experiment.__name__)
        async with info.context.db() as session:
            stmt = (
                update(models.Experiment)
                .where(models.Experiment.id == exp_rowid)
                .values(is_ephemeral=True)
                .returning(models.Experiment)
            )
            experiment = await session.scalar(stmt)
            if experiment is None:
                raise BadRequest(f"Experiment {experiment_id} not found")
        return DismissExperimentPayload(experiment=to_gql_experiment(experiment))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def reinstate_experiment(
        self,
        info: Info[Context, None],
        experiment_id: GlobalID,
    ) -> ReinstateExperimentPayload:
        """
        Reinstate a dismissed experiment by clearing its ephemeral flag.
        """
        exp_rowid = from_global_id_with_expected_type(experiment_id, Experiment.__name__)
        async with info.context.db() as session:
            stmt = (
                update(models.Experiment)
                .where(models.Experiment.id == exp_rowid)
                .values(is_ephemeral=False)
                .returning(models.Experiment)
            )
            experiment = await session.scalar(stmt)
            if experiment is None:
                raise BadRequest(f"Experiment {experiment_id} not found")
        return ReinstateExperimentPayload(experiment=to_gql_experiment(experiment))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def patch_experiment(
        self,
        info: Info[Context, None],
        input: PatchExperimentInput,
    ) -> PatchExperimentPayload:
        experiment_id = from_global_id_with_expected_type(input.experiment_id, Experiment.__name__)
        # `name` and `metadata` are non-nullable: an omitted field stays UNSET, but an explicit
        # null must be rejected rather than silently dropped (mirrors the REST updateExperiment
        # contract). `description` may be null to clear it.
        if input.name is None:
            raise BadRequest("name cannot be null")
        if input.metadata is None:
            raise BadRequest("metadata cannot be null")
        patch = {
            column.key: patch_value
            for column, patch_value, column_is_nullable in (
                (models.Experiment.name, input.name, False),
                (models.Experiment.description, input.description, True),
                (models.Experiment.metadata_, input.metadata, False),
            )
            if patch_value is not UNSET and (patch_value is not None or column_is_nullable)
        }
        if not patch:
            raise BadRequest("No fields to patch.")
        async with info.context.db() as session:
            experiment = await session.scalar(
                update(models.Experiment)
                .where(models.Experiment.id == experiment_id)
                .returning(models.Experiment)
                .values(**patch)
            )
            if experiment is None:
                raise BadRequest(f"Experiment {input.experiment_id} not found")
        return PatchExperimentPayload(experiment=to_gql_experiment(experiment))

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer, IsLocked])  # type: ignore
    async def set_experiment_baseline(
        self,
        info: Info[Context, None],
        experiment_id: GlobalID,
        baseline: bool,
    ) -> SetExperimentBaselinePayload:
        experiment_rowid = from_global_id_with_expected_type(experiment_id, Experiment.__name__)
        async with info.context.db() as session:
            experiment = await session.get(models.Experiment, experiment_rowid)
            if experiment is None:
                raise BadRequest(f"Experiment {experiment_id} not found")
            if baseline and experiment.is_ephemeral:
                raise BadRequest("Ephemeral experiments cannot be marked as baseline")
            previous_baseline_experiment_id = await session.scalar(
                select(models.ExperimentTag.experiment_id)
                .where(models.ExperimentTag.dataset_id == experiment.dataset_id)
                .where(models.ExperimentTag.name == BASELINE_EXPERIMENT_TAG_NAME)
            )
            previous_baseline_experiment = None
            if baseline:
                if (
                    previous_baseline_experiment_id is not None
                    and previous_baseline_experiment_id != experiment.id
                ):
                    previous_baseline_experiment = await session.get(
                        models.Experiment, previous_baseline_experiment_id
                    )
                await session.execute(
                    insert_on_conflict(
                        {
                            "experiment_id": experiment.id,
                            "dataset_id": experiment.dataset_id,
                            "user_id": info.context.user_id,
                            "name": BASELINE_EXPERIMENT_TAG_NAME,
                            "description": None,
                        },
                        table=models.ExperimentTag,
                        dialect=info.context.db.dialect,
                        unique_by=("dataset_id", "name"),
                        set_={
                            "experiment_id": experiment.id,
                            "user_id": info.context.user_id,
                            "description": None,
                        },
                    )
                )
            else:
                await session.execute(
                    delete(models.ExperimentTag)
                    .where(models.ExperimentTag.dataset_id == experiment.dataset_id)
                    .where(models.ExperimentTag.name == BASELINE_EXPERIMENT_TAG_NAME)
                    .where(models.ExperimentTag.experiment_id == experiment.id)
                )
            try:
                await session.commit()
            except (PostgreSQLIntegrityError, SQLiteIntegrityError):
                raise Conflict("Failed to update experiment baseline.")
        loader = info.context.data_loaders.experiment_baseline_tags
        _clear_and_prime_experiment_baseline_tag(loader, experiment.id, baseline)
        if previous_baseline_experiment is not None:
            _clear_and_prime_experiment_baseline_tag(
                loader,
                previous_baseline_experiment.id,
                False,
            )
        return SetExperimentBaselinePayload(
            dataset=Dataset(id=experiment.dataset_id),
            experiment=to_gql_experiment(experiment, is_baseline=baseline),
            previous_baseline_experiment=(
                to_gql_experiment(previous_baseline_experiment, is_baseline=False)
                if previous_baseline_experiment is not None
                else None
            ),
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def delete_experiments(
        self,
        info: Info[Context, None],
        input: DeleteExperimentsInput,
    ) -> ExperimentMutationPayload:
        experiment_ids = [
            from_global_id_with_expected_type(experiment_id, Experiment.__name__)
            for experiment_id in input.experiment_ids
        ]
        # Stop any running experiments before deleting and wait for in-flight
        # shielded DB writes to drain, avoiding FK constraint violations.
        # Note: only drains experiments owned by this replica. In multi-replica
        # deployments, another replica's shielded writes may still race with
        # the DELETE (possible FK errors or orphaned rows), but these are
        # harmless since the experiment is being deleted anyway.
        for exp_id in experiment_ids:
            await info.context.experiment_runner.stop_experiment(exp_id)
        project_names_stmt = get_project_names_for_experiments(*experiment_ids)
        eval_trace_ids_stmt = get_eval_trace_ids_for_experiments(*experiment_ids)
        async with info.context.db() as session:
            project_names = await session.scalars(project_names_stmt)
            eval_trace_ids = await session.scalars(eval_trace_ids_stmt)
            savepoint = await session.begin_nested()
            experiments = {
                experiment.id: experiment
                async for experiment in (
                    await session.stream_scalars(
                        delete(models.Experiment)
                        .where(models.Experiment.id.in_(experiment_ids))
                        .returning(models.Experiment)
                    )
                )
            }
            if unknown_experiment_ids := set(experiment_ids) - set(experiments.keys()):
                await savepoint.rollback()
                raise CustomGraphQLError(
                    "Failed to delete experiment(s), "
                    "probably due to invalid input experiment ID(s): "
                    + str(
                        [
                            str(GlobalID(Experiment.__name__, str(experiment_id)))
                            for experiment_id in unknown_experiment_ids
                        ]
                    )
                )
        await asyncio.gather(
            delete_projects(info.context.db, *project_names),
            delete_traces(info.context.db, *eval_trace_ids),
            return_exceptions=True,
        )
        info.context.event_queue.put(ExperimentDeleteEvent(tuple(experiments.keys())))
        return ExperimentMutationPayload(
            experiments=[
                to_gql_experiment(experiments[experiment_id]) for experiment_id in experiment_ids
            ]
        )


def _clear_and_prime_experiment_baseline_tag(
    loader: DataLoader[int, bool],
    experiment_id: int,
    is_baseline: bool,
) -> None:
    try:
        loader.clear(experiment_id)
    except KeyError:
        pass
    loader.prime(experiment_id, is_baseline)
