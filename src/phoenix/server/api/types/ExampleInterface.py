import strawberry
from strawberry.scalars import JSON


@strawberry.interface
class Example:
    """
    Represents an example for generative tasks.
    For example, you might have text -> text, text -> labels, etc.
    """

    input: JSON
    output: JSON
    metadata: JSON
