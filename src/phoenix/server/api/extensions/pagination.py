"""Field extensions that enforce safe GraphQL pagination defaults.

Phoenix uses these extensions on large connection fields where unbounded or
backward pagination would create expensive database queries and oversized
responses.
"""

from typing import Any, Optional

from strawberry import UNSET
from strawberry.annotation import StrawberryAnnotation
from strawberry.extensions import FieldExtension
from strawberry.types.arguments import StrawberryArgument
from strawberry.types.field import StrawberryField

from phoenix.server.api.exceptions import BadRequest

DEFAULT_MAX_PAGE_SIZE = 1000


class RequireForwardPaginationExtension(FieldExtension):
    """Require bounded forward pagination on a Strawberry connection field.

    The extension enforces the contract in two places:

    - At schema build time, it rewrites the field's ``first`` argument so the
      GraphQL schema exposes it as a required ``Int!`` argument.
    - At resolve time, it validates the incoming arguments, rejecting missing
      or invalid ``first`` values, backward pagination via ``last``/``before``,
      and page sizes above ``max_page_size``.

    The wrapped field must already declare a ``first`` argument. Pass
    ``max_page_size=None`` to require forward pagination without a hard cap.
    """

    def __init__(self, *, max_page_size: Optional[int] = DEFAULT_MAX_PAGE_SIZE) -> None:
        self.max_page_size = max_page_size

    def apply(self, field: StrawberryField) -> None:
        has_first = False
        arguments: list[StrawberryArgument] = []
        for argument in field.arguments:
            if argument.python_name == "first":
                has_first = True
                arguments.append(
                    StrawberryArgument(
                        python_name=argument.python_name,
                        graphql_name=argument.graphql_name,
                        # Removing the default and using a non-optional
                        # annotation makes the GraphQL argument required.
                        type_annotation=StrawberryAnnotation(int),
                        is_subscription=argument.is_subscription,
                        description=argument.description,
                        default=UNSET,
                        deprecation_reason=argument.deprecation_reason,
                        directives=argument.directives,
                        metadata=argument.metadata,
                    )
                )
            else:
                arguments.append(argument)
        if not has_first:
            raise TypeError("RequireForwardPaginationExtension requires a `first` argument")
        field.arguments = arguments

    def resolve(
        self,
        next_: Any,
        source: Any,
        info: Any,
        **kwargs: Any,
    ) -> Any:
        self._validate_kwargs(kwargs)
        return next_(source, info, **kwargs)

    async def resolve_async(
        self,
        next_: Any,
        source: Any,
        info: Any,
        **kwargs: Any,
    ) -> Any:
        self._validate_kwargs(kwargs)
        return await next_(source, info, **kwargs)

    def _validate_kwargs(self, kwargs: dict[str, Any]) -> None:
        # Keep runtime validation in addition to the schema-level rewrite so we
        # return clear BadRequest errors for invalid variables and direct calls.
        first = kwargs.get("first", UNSET)
        if first is UNSET or first is None:
            raise BadRequest("`first` is required")
        if not isinstance(first, int) or first <= 0:
            raise BadRequest("`first` must be a positive integer")
        if self.max_page_size is not None and first > self.max_page_size:
            raise BadRequest(f"`first` must be less than or equal to {self.max_page_size}")
        last = kwargs.get("last", UNSET)
        before = kwargs.get("before", UNSET)
        if last is not UNSET and last is not None:
            raise BadRequest("Backward pagination with `last` is not supported")
        if before is not UNSET and before is not None:
            raise BadRequest("Backward pagination with `before` is not supported")
