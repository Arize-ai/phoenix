"""Marks GraphQL arguments and input fields whose values must not reach span attributes."""

from typing import Annotated, Any, TypeVar

import strawberry
from graphql import (
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLResolveInfo,
)
from strawberry.types.arguments import StrawberryArgument, StrawberryArgumentAnnotation
from strawberry.types.field import StrawberryField
from typing_extensions import get_args, get_origin

_REDACTED_KEY = "phoenix.redacted"
REDACTED_VALUE = "[redacted]"

T = TypeVar("T")

Redacted = Annotated[T, strawberry.argument(metadata={_REDACTED_KEY: True})]
"""Marks a resolver argument or input field that carries a credential, personal data
or customer content. The GraphQL type is unchanged; the value is blanked on spans.

    @strawberry.input
    class CreateUserInput:
        email: Redacted[str]
        password: Redacted[Optional[str]] = UNSET
"""


def redact_arguments(args: dict[str, Any], info: GraphQLResolveInfo[Any]) -> dict[str, Any]:
    """Strawberry ``arg_filter`` that blanks every ``Redacted`` argument and input field.

    ``args`` is keyed by GraphQL argument name and is the deep copy Strawberry hands to
    the filter, so nested input objects are modified in place.
    """
    graphql_field = info.parent_type.fields.get(info.field_name)
    if graphql_field is None:
        return args
    for name, value in args.items():
        graphql_argument = graphql_field.args.get(name)
        if graphql_argument is None:
            continue
        argument = (graphql_argument.extensions or {}).get("strawberry-definition")
        if not isinstance(argument, StrawberryArgument):
            continue
        if argument.metadata.get(_REDACTED_KEY):
            args[name] = REDACTED_VALUE
        else:
            _redact_value(value, graphql_argument.type)
    return args


def _redact_value(value: Any, type_: GraphQLInputType) -> None:
    """Blank the ``Redacted`` fields of an input object, recursing through lists and
    nested inputs. graphql-core coerces input objects to dicts keyed by GraphQL field
    name; dataclass instances are handled too in case coercion already converted them.
    """
    if value is None or value is strawberry.UNSET:
        return
    if isinstance(type_, (GraphQLNonNull, GraphQLList)):
        if isinstance(type_, GraphQLList) and isinstance(value, list):
            for item in value:
                _redact_value(item, type_.of_type)
        elif isinstance(type_, GraphQLNonNull):
            _redact_value(value, type_.of_type)
        return
    if not isinstance(type_, GraphQLInputObjectType):
        return
    for name, graphql_field in type_.fields.items():
        field = (graphql_field.extensions or {}).get("strawberry-definition")
        if not isinstance(field, StrawberryField):
            continue
        redacted = _is_redacted_field(field)
        if isinstance(value, dict):
            if name not in value:
                continue
            if redacted:
                value[name] = REDACTED_VALUE
            else:
                _redact_value(value[name], graphql_field.type)
        elif hasattr(value, field.python_name):
            if redacted:
                setattr(value, field.python_name, REDACTED_VALUE)
            else:
                _redact_value(getattr(value, field.python_name), graphql_field.type)


def _is_redacted_field(field: StrawberryField) -> bool:
    annotation = field.type_annotation
    return annotation is not None and _is_redacted(annotation.evaluate())


def _is_redacted(annotation: object) -> bool:
    if get_origin(annotation) is not Annotated:
        return False
    return any(
        isinstance(item, StrawberryArgumentAnnotation) and bool(item.metadata.get(_REDACTED_KEY))
        for item in get_args(annotation)[1:]
    )


__all__ = ["REDACTED_VALUE", "Redacted", "redact_arguments"]
