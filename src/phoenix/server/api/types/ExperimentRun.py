import re
from base64 import b64decode, b64encode

import strawberry
from strawberry.relay import GlobalID, Node
from strawberry.types import Info
from typing_extensions import Self, TypeAlias

from phoenix.server.api.types.ExperimentRepetition import ExperimentRepetition

ExperimentRowId: TypeAlias = int
DatasetExampleRowId: TypeAlias = int


@strawberry.type
class ExperimentRun(Node):
    experiment_rowid: strawberry.Private[ExperimentRowId]
    dataset_example_rowid: strawberry.Private[DatasetExampleRowId]
    repetitions: list[ExperimentRepetition]

    @strawberry.field
    def experiment_id(self) -> str:
        return str(GlobalID("Experiment", str(self.experiment_rowid)))

    @classmethod
    def resolve_id(
        cls,
        root: Self,
        *,
        info: Info,
    ) -> str:
        unencoded_id = f"ExperimentRuns:experiment_id={root.experiment_rowid}:dataset_example_id={root.dataset_example_rowid}"  # noqa: E501
        encoded_id = _base64_encode(unencoded_id)
        return encoded_id


_EXPERIMENT_RUN_NODE_ID_PATTERN = re.compile(
    r"ExperimentRun:experiment_id=(\d+):dataset_example_id=(\d+)"
)


def get_experiment_run_node_id(
    experiment_rowid: ExperimentRowId, dataset_example_rowid: DatasetExampleRowId
) -> str:
    return _base64_encode(
        f"ExperimentRun:experiment_id={experiment_rowid}:dataset_example_id={dataset_example_rowid}"
    )


def parse_experiment_run_node_id(node_id: str) -> tuple[ExperimentRowId, DatasetExampleRowId]:
    decoded_node_id = _base64_decode(node_id)
    match = re.match(_EXPERIMENT_RUN_NODE_ID_PATTERN, decoded_node_id)
    if not match:
        raise ValueError(f"Invalid node ID format: {node_id}")

    experiment_id = int(match.group(1))
    dataset_example_id = int(match.group(2))
    return experiment_id, dataset_example_id


def _base64_encode(string: str) -> str:
    return b64encode(string.encode()).decode()


def _base64_decode(string: str) -> str:
    return b64decode(string.encode()).decode()
