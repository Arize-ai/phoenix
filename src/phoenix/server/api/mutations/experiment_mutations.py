from typing import List

import strawberry
from sqlalchemy import delete, select
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DeleteExperimentsInput import DeleteExperimentsInput
from phoenix.server.api.mutations.auth import IsAuthenticated
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.type
class ExperimentMutationPayload:
    experiments: List[Experiment]


@strawberry.type
class ExperimentMutationMixin:
    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def delete_experiments(
        self,
        info: Info[Context, None],
        input: DeleteExperimentsInput,
    ) -> ExperimentMutationPayload:
        experiment_ids = [
            from_global_id_with_expected_type(experiment_id, Experiment.__name__)
            for experiment_id in input.experiment_ids
        ]
        project_names_stmt = (
            select(models.Experiment.project_name)
            .where(models.Experiment.id.in_(experiment_ids))
            .where(models.Experiment.project_name.isnot(None))
        )
        eval_trace_ids_stmt = (
            select(models.ExperimentRunAnnotation.trace_id)
            .join(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .where(models.ExperimentRunAnnotation.trace_id.isnot(None))
        )
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
                raise ValueError(
                    "Failed to delete experiment(s), "
                    "probably due to invalid input experiment ID(s): "
                    + str(
                        [
                            str(GlobalID(Experiment.__name__, str(experiment_id)))
                            for experiment_id in unknown_experiment_ids
                        ]
                    )
                )
        if project_names:
            try:
                async with info.context.db() as session:
                    await session.execute(
                        delete(models.Project).where(
                            models.Project.name.in_(set(project_names)),
                        )
                    )
            except BaseException:
                pass
        if eval_trace_ids:
            try:
                async with info.context.db() as session:
                    await session.execute(
                        delete(models.Trace).where(
                            models.Trace.trace_id.in_(set(eval_trace_ids)),
                        )
                    )
            except BaseException:
                pass
        return ExperimentMutationPayload(
            experiments=[
                to_gql_experiment(experiments[experiment_id]) for experiment_id in experiment_ids
            ]
        )
