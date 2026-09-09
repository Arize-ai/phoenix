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

    def __post_init__(self) -> None:
        if not self.annotation_name.strip() or len(self.annotation_name) > 256:
            raise BadRequest("Annotation name must contain between 1 and 256 characters.")
        if self.label is not None and (not self.label.strip() or len(self.label) > 1024):
            raise BadRequest("Label must contain between 1 and 1024 characters.")
