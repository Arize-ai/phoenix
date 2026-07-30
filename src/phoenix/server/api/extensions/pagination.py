"""Extensions that enforce safe GraphQL pagination defaults.

Phoenix uses the field extension here on large connection fields where
unbounded or backward pagination would create expensive database queries and
oversized responses. The schema extension applies to every connection field.
"""

from typing import Any, Callable, Optional

from graphql import GraphQLResolveInfo
from strawberry import UNSET
from strawberry.annotation import StrawberryAnnotation
from strawberry.extensions import FieldExtension, SchemaExtension
from strawberry.types.arguments import StrawberryArgument
from strawberry.types.field import StrawberryField

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.types.pagination import empty_connection

DEFAULT_MAX_PAGE_SIZE = 1000


class EmptyPageExtension(SchemaExtension):
    """Answer ``first: 0`` on any connection field without resolving it.

    Registered schema-wide rather than per field, so the cost of asking for no
    edges is the same everywhere. Without it, ``first: 0`` would be free on the
    few fields carrying `RequireForwardPaginationExtension` and a full query on
    the rest -- an asymmetry nothing in the schema advertises.

    Every field in this schema that accepts ``first`` returns a ``Connection``,
    so matching on the argument alone cannot substitute a connection for some
    other type.

    This runs outside field extensions, so ``first: 0`` returns before their
    validation. The only check that misses is the rejection of ``last`` and
    ``before``, on a request whose page is empty either way.
    """

    def resolve(
        self,
        _next: Callable[..., Any],
        root: Any,
        info: GraphQLResolveInfo,
        *args: str,
        **kwargs: Any,
    ) -> Any:
        # A plain `== 0` is deliberate: it is safe when `first` is absent,
        # where `<= 0` would raise on None or UNSET, and it leaves a negative
        # `first` to the error paths that already reject it.
        if kwargs.get("first") == 0:
            return empty_connection()
        return _next(root, info, *args, **kwargs)


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
        if not isinstance(first, int) or first < 0:
            raise BadRequest("`first` must be a non-negative integer")
        if self.max_page_size is not None and first > self.max_page_size:
            raise BadRequest(f"`first` must be less than or equal to {self.max_page_size}")
        last = kwargs.get("last", UNSET)
        before = kwargs.get("before", UNSET)
        if last is not UNSET and last is not None:
            raise BadRequest("Backward pagination with `last` is not supported")
        if before is not UNSET and before is not None:
            raise BadRequest("Backward pagination with `before` is not supported")
