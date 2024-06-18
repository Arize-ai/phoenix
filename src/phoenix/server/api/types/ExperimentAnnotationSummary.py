import json

import strawberry
from strawberry.relay import Node
from strawberry.types import Info
from strawberry.utils.await_maybe import AwaitableOrValue
from typing_extensions import Self, TypeAlias

ExperimentID: TypeAlias = int
AnnotationName: TypeAlias = str


@strawberry.type
class ExperimentAnnotationSummary(Node):
    annotation_name: str
    mean_score: float
    experiment_id: strawberry.Private[int]

    _EXPERIMENT_ID: strawberry.Private[str] = "experiment_id"
    _ANNOTATION_NAME: strawberry.Private[str] = "annotation_name"

    @classmethod
    def resolve_id(
        cls,
        root: Self,
        *,
        info: Info,
    ) -> AwaitableOrValue[str]:
        """
        Encodes a node ID for an ExperimentAnnotationSummary. This bespoke logic
        for encoding this type's node ID is needed since there is no single
        number that uniquely identifies an ExperimentAnnotationSummary.
        """
        return json.dumps(
            {
                cls._EXPERIMENT_ID: root.experiment_id,
                cls._ANNOTATION_NAME: root.annotation_name,
            },
            sort_keys=True,
            separators=(",", ":"),  # make the JSON representation as compact as possible
        )
