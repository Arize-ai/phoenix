import strawberry
from sqlalchemy import delete
from strawberry.types import Info

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.DeleteExperimentInput import DeleteExperimentInput
from phoenix.server.api.mutations.auth import IsAuthenticated
from phoenix.server.api.types.Experiment import Experiment, to_gql_experiment
from phoenix.server.api.types.node import from_global_id_with_expected_type


@strawberry.type
class ExperimentMutationPayload:
    experiment: Experiment


@strawberry.type
class ExperimentMutationMixin:
    @strawberry.mutation(permission_classes=[IsAuthenticated])  # type: ignore
    async def delete_experiment(
        self,
        info: Info[Context, None],
        input: DeleteExperimentInput,
    ) -> ExperimentMutationPayload:
        experiment_id = from_global_id_with_expected_type(input.experiment_id, Experiment.__name__)
        async with info.context.db() as session:
            if (
                experiment := await session.scalar(
                    delete(models.Experiment)
                    .where(models.Experiment.id == experiment_id)
                    .returning(models.Experiment)
                )
            ) is None:
                raise ValueError(f"Unknown experiment: {input.experiment_id}")
        return ExperimentMutationPayload(experiment=to_gql_experiment(experiment))
