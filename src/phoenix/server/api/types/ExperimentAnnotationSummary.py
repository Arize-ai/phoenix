import json

import strawberry
from strawberry.relay import Node, NodeID
from typing_extensions import TypeAlias

ExperimentID: TypeAlias = int
AnnotationName: TypeAlias = str


@strawberry.type
class ExperimentAnnotationSummary(Node):
    id_attr: NodeID[str]
    annotation_name: str
    mean_score: float

    _EXPERIMENT_ID: strawberry.Private[str] = "experiment_id"
    _ANNOTATION_NAME: strawberry.Private[str] = "annotation_name"

    @classmethod
    def from_fields(
        cls, experiment_id: int, annotation_name: str, mean_score: float
    ) -> "ExperimentAnnotationSummary":
        return cls(
            id_attr=cls._encode_node_id(experiment_id, annotation_name),
            annotation_name=annotation_name,
            mean_score=mean_score,
        )

    @classmethod
    def _encode_node_id(cls, experiment_id: int, annotation_name: str) -> str:
        """
        Encodes a node ID for an ExperimentAnnotationSummary.
        """
        return json.dumps(
            {
                cls._EXPERIMENT_ID: experiment_id,
                cls._ANNOTATION_NAME: annotation_name,
            },
            sort_keys=True,
            separators=(",", ":"),  # make the JSON representation as compact as possible
        )
