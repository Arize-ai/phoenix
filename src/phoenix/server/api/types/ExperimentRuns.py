import re
from base64 import b64decode, b64encode
from collections.abc import Awaitable
from typing import Iterable, Literal, Optional, Union, overload

import strawberry
from sqlalchemy import select, tuple_
from strawberry.relay import Node
from strawberry.types import Info
from typing_extensions import Self, TypeAlias

from phoenix.db import models
from phoenix.server.api.types.ExperimentRun import ExperimentRun, to_gql_experiment_run

ExperimentId: TypeAlias = int
DatasetExampleId: TypeAlias = int


@strawberry.type
class ExperimentRuns(Node):
    experiment_id: strawberry.Private[ExperimentId]
    dataset_example_id: strawberry.Private[DatasetExampleId]
    runs: list[ExperimentRun]

    @classmethod
    def resolve_id(
        cls,
        root: Self,
        *,
        info: Info,
    ) -> str:
        unencoded_id = f"ExperimentRuns:experiment_id={root.experiment_id}:dataset_example_id={root.dataset_example_id}"  # noqa: E501
        encoded_id = _base64_encode(unencoded_id)
        return encoded_id

    @overload
    @classmethod
    def resolve_nodes(
        cls,
        *,
        info: Info,
        node_ids: Iterable[str],
        required: Literal[True],
    ) -> Awaitable[Iterable[Self]]: ...

    @overload
    @classmethod
    def resolve_nodes(
        cls,
        *,
        info: Info,
        node_ids: Iterable[str],
        required: Literal[False] = ...,
    ) -> Awaitable[Iterable[Optional[Self]]]: ...

    @overload
    @classmethod
    def resolve_nodes(
        cls,
        *,
        info: Info,
        node_ids: Iterable[str],
        required: bool,
    ) -> Union[
        Awaitable[Iterable[Self]],
        Awaitable[Iterable[Optional[Self]]],
    ]:
        async def resolve_nodes_inner() -> Iterable[
            Optional[Self]
        ]:  # satisfy the superclass method type by defining an inner coroutine
            experiment_and_dataset_example_ids = [
                parse_experiment_runs_node_id(node_id) for node_id in node_ids
            ]
            query = select(models.ExperimentRun).where(
                tuple_(
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRun.dataset_example_id,
                ).in_(set(experiment_and_dataset_example_ids))
            )
            experiment_runs_by_id: dict[
                tuple[ExperimentId, DatasetExampleId], list[models.ExperimentRun]
            ] = {}
            async with info.context._db() as session:
                for experiment_run in await session.scalars(query):
                    key = (experiment_run.experiment_id, experiment_run.dataset_example_id)
                    if key not in experiment_runs_by_id:
                        experiment_runs_by_id[key] = []
                    experiment_runs_by_id[key].append(experiment_run)
            experiment_runs_list: list[Optional[Self]] = []
            for key in experiment_and_dataset_example_ids:
                if (experiment_runs := experiment_runs_by_id.get(key)) is None:
                    experiment_runs_list.append(None)
                else:
                    experiment_id, dataset_example_id = key
                    experiment_runs_list.append(
                        cls(
                            experiment_id=experiment_id,
                            dataset_example_id=dataset_example_id,
                            runs=[
                                to_gql_experiment_run(run)
                                for run in sorted(
                                    experiment_runs, key=lambda run: run.repetition_number
                                )
                            ],
                        )
                    )
            return experiment_runs_list

        return resolve_nodes_inner()


_EXPERIMENT_RUNS_NODE_ID_PATTERN = re.compile(
    r"ExperimentRuns:experiment_id=(\d+):dataset_example_id=(\d+)"
)


def parse_experiment_runs_node_id(node_id: str) -> tuple[ExperimentId, DatasetExampleId]:
    decoded_node_id = _base64_decode(node_id)
    match = re.match(_EXPERIMENT_RUNS_NODE_ID_PATTERN, decoded_node_id)
    if not match:
        raise ValueError(f"Invalid node ID format: {node_id}")

    experiment_id = int(match.group(1))
    dataset_example_id = int(match.group(2))
    return experiment_id, dataset_example_id


def _base64_encode(string: str) -> str:
    return b64encode(string.encode()).decode()


def _base64_decode(string: str) -> str:
    return b64decode(string.encode()).decode()
