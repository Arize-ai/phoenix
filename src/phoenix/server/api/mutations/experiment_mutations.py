import asyncio
from datetime import datetime, timezone

import strawberry
from sqlalchemy import delete, update
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.config import EXPERIMENT_TOGGLE_COOLDOWN
from phoenix.db import models
from phoenix.db.helpers import get_eval_trace_ids_for_experiments, get_project_names_for_experiments
from phoenix.server.api.auth import IsNotReadOnly, IsNotViewer
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest, CustomGraphQLError
from phoenix.server.api.input_types.DeleteExperimentsInput import DeleteExperimentsInput
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
        cooldown_seconds = EXPERIMENT_TOGGLE_COOLDOWN.total_seconds()

        async with info.context.db() as session:
            # First check cooldown
            config = await session.get(models.ExperimentExecutionConfig, exp_rowid)
            if config is None:
                raise BadRequest(f"Experiment {experiment_id} not found")

            if config.toggled_at is not None:
                elapsed = (now - config.toggled_at).total_seconds()
                if elapsed < cooldown_seconds:
                    # Cooldown not elapsed - reject
                    raise BadRequest(f"Experiment {experiment_id} is still in cooldown")

            # Atomic update: only stop if currently running (claimed_at IS NOT NULL)
            stmt = (
                update(models.ExperimentExecutionConfig)
                .where(models.ExperimentExecutionConfig.id == exp_rowid)
                .where(models.ExperimentExecutionConfig.claimed_at.is_not(None))
                .values(
                    claimed_at=None,
                    claimed_by=None,
                    toggled_at=now,
                )
                .returning(models.ExperimentExecutionConfig)
            )
            updated_config = await session.scalar(stmt)

            if updated_config is None:
                # Already stopped - refetch and return current state (idempotent)
                await session.refresh(config)
                return StopExperimentPayload(job=ExperimentJob(id=config.id, db_record=config))

        info.context.experiment_runner.stop_experiment(updated_config.id)
        return StopExperimentPayload(
            job=ExperimentJob(id=updated_config.id, db_record=updated_config)
        )

    @strawberry.mutation(permission_classes=[IsNotReadOnly, IsNotViewer])  # type: ignore
    async def resume_experiment(
        self,
        info: Info[Context, None],
        experiment_id: GlobalID,
    ) -> ResumeExperimentPayload:
        """
        Resume a stopped experiment. Continues from where it left off.

        Uses atomic UPDATE to prevent race conditions (double-click, multi-replica).
        Enforces cooldown to prevent rapid state thrashing.
        """
        exp_rowid = from_global_id_with_expected_type(experiment_id, Experiment.__name__)
        now = datetime.now(timezone.utc)
        cooldown_seconds = EXPERIMENT_TOGGLE_COOLDOWN.total_seconds()
        replica_id = info.context.experiment_runner._replica_id

        async with info.context.db() as session:
            # First check cooldown and get config
            config = await session.get(models.ExperimentExecutionConfig, exp_rowid)
            if config is None:
                raise BadRequest(f"Experiment {experiment_id} not found")

            if config.toggled_at is not None:
                elapsed = (now - config.toggled_at).total_seconds()
                if elapsed < cooldown_seconds:
                    # Cooldown not elapsed - reject
                    raise BadRequest(f"Experiment {experiment_id} is still in cooldown")

            # Atomic update: only resume if not currently running (claimed_at IS NULL)
            stmt = (
                update(models.ExperimentExecutionConfig)
                .where(models.ExperimentExecutionConfig.id == exp_rowid)
                .where(models.ExperimentExecutionConfig.claimed_at.is_(None))
                .values(
                    claimed_at=now,
                    claimed_by=replica_id,
                    toggled_at=now,
                    last_error=None,  # Clear error on resume
                )
                .returning(models.ExperimentExecutionConfig)
            )
            updated_config = await session.scalar(stmt)

            if updated_config is None:
                # Already running - refetch and return current state (idempotent)
                await session.refresh(config)
                return ResumeExperimentPayload(job=ExperimentJob(id=config.id, db_record=config))

        await info.context.experiment_runner.start_experiment(updated_config)
        return ResumeExperimentPayload(
            job=ExperimentJob(id=updated_config.id, db_record=updated_config)
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
