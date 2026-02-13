from typing import TYPE_CHECKING

import strawberry
from strawberry.scalars import JSON

if TYPE_CHECKING:
    # For type checkers: JSON is a wrapper around object
    JSONType = object
else:
    # At runtime: use the actual strawberry JSON scalar for GraphQL
    JSONType = JSON


@strawberry.interface
class ExampleRevision:
    """
    Represents an example revision for generative tasks.
    For example, you might have text -> text, text -> labels, etc.
    """

    input: JSONType
    output: JSONType
    metadata: JSONType
