import strawberry
from strawberry.scalars import JSON


@strawberry.interface
class ExampleRevision:
    """
    Represents an example revision for generative tasks.
    For example, you might have text -> text, text -> labels, etc.
    """

    input: JSON  # ty: ignore[invalid-type-form]
    output: JSON  # ty: ignore[invalid-type-form]
    metadata: JSON  # ty: ignore[invalid-type-form]
