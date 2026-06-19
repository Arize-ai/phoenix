import strawberry


@strawberry.type
class AnnotationNameCount:
    """The number of annotations that share a given name at a particular level
    (span, trace, or session) within a project."""

    name: str
    count: int
