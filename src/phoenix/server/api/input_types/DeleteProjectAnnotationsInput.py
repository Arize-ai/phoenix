from enum import Enum
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID

from phoenix.server.api.input_types.TimeRange import TimeRange


@strawberry.enum
class AnnotationTimeRangeField(Enum):
    """The timestamp that an annotation ``timeRange`` filter is applied against
    when bulk-deleting annotations by name within a project."""

    # The annotation's own creation time.
    ANNOTATION_CREATED_AT = "annotation_created_at"
    # The start time of the span, trace, or session the annotation is attached to.
    SOURCE_START_TIME = "source_start_time"


@strawberry.input
class DeleteProjectAnnotationsInput:
    """Input for bulk-deleting every annotation with a given name for a single
    target type (span, trace, or session) within a project, optionally restricted
    to a time range."""

    project_id: GlobalID
    annotation_name: str
    time_range: Optional[TimeRange] = strawberry.field(
        default=UNSET,
        description=(
            "If provided, only annotations whose timestamp falls within this range are "
            "deleted. The end of the range is right-exclusive."
        ),
    )
    time_range_field: AnnotationTimeRangeField = strawberry.field(
        default=AnnotationTimeRangeField.ANNOTATION_CREATED_AT,
        description=(
            "Which timestamp the time range is applied against. Defaults to the "
            "annotation's own creation time."
        ),
    )
