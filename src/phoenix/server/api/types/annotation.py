from typing import Optional

import strawberry


@strawberry.interface
class Annotation:
    name: str = strawberry.field(
        description="Name of the annotation, e.g. 'helpfulness' or 'relevance'."
    )
    score: Optional[float] = strawberry.field(
        description="Value of the annotation in the form of a numeric score."
    )
    label: Optional[str] = strawberry.field(
        description="Value of the annotation in the form of a string, e.g. "
        "'helpful' or 'not helpful'. Note that the label is not necessarily binary."
    )
    explanation: Optional[str] = strawberry.field(
        description="The annotator's explanation for the annotation result (i.e. "
        "score or label, or both) given to the subject."
    )
