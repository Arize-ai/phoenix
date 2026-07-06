import strawberry


@strawberry.type
class AnnotationNameCount:
    """The number of annotations that share a given name for a particular target
    type (span, trace, or session) within a project."""

    name: str
    count: int
