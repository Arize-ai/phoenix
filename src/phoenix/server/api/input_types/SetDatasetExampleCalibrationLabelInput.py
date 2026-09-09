import math
from typing import Optional

import strawberry
from strawberry.relay import GlobalID

from phoenix.server.api.exceptions import BadRequest


@strawberry.input
class SetDatasetExampleCalibrationLabelInput:
    """Set or clear a human calibration label on the expected example revision."""

    dataset_id: GlobalID
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
