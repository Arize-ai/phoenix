import math
from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.exceptions import BadRequest

MAX_CALIBRATION_LABELS_PER_BATCH = 200


@strawberry.input
class DatasetExampleCalibrationLabelInput:
    """One human expected output to set, or clear when no value is given."""

    example_id: GlobalID
    expected_revision_id: GlobalID
    annotation_name: str
    label: Optional[str]
    score: Optional[float] = None
    explanation: Optional[str] = None

    def __post_init__(self) -> None:
        if self.label is None and self.score is None and self.explanation is not None:
            raise BadRequest("An expected output requires a label or score.")
        if self.score is not None and not math.isfinite(self.score):
            raise BadRequest("Score must be finite.")
        if self.explanation is not None and len(self.explanation) > 10000:
            raise BadRequest("Explanation must be at most 10000 characters.")
        if not self.annotation_name.strip() or len(self.annotation_name) > 256:
            raise BadRequest("Annotation name must contain between 1 and 256 characters.")
        if self.label is not None and (not self.label.strip() or len(self.label) > 1024):
            raise BadRequest("Label must contain between 1 and 1024 characters.")

    @property
    def is_clear(self) -> bool:
        return self.label is None and self.score is None and self.explanation is None


@strawberry.input
class SetDatasetExampleCalibrationLabelsInput:
    """Set or clear human expected outputs on several examples of one dataset
    in a single dataset version. Applied atomically: one stale revision rejects
    the whole batch."""

    dataset_id: GlobalID
    labels: list[DatasetExampleCalibrationLabelInput]

    def __post_init__(self) -> None:
        if not self.labels:
            raise BadRequest("Provide at least one expected output.")
        if len(self.labels) > MAX_CALIBRATION_LABELS_PER_BATCH:
            raise BadRequest(
                f"Provide at most {MAX_CALIBRATION_LABELS_PER_BATCH} expected outputs per batch."
            )
        seen: set[tuple[str, str]] = set()
        for item in self.labels:
            key = (str(item.example_id), item.annotation_name)
            if key in seen:
                raise BadRequest(
                    "Each example and annotation name may appear once per batch; "
                    "combine repeated annotations before sending."
                )
            seen.add(key)
