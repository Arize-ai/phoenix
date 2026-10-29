"""Marks GraphQL arguments and input fields whose values must not reach span attributes."""

from collections.abc import Generator
from typing import Annotated, Any, TypeVar

import strawberry
from graphql import (
    ArgumentNode,
    DocumentNode,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLResolveInfo,
    GraphQLSchema,
    ObjectFieldNode,
    StringValueNode,
    TypeInfo,
    TypeInfoVisitor,
    VariableNode,
    Visitor,
    get_named_type,
    print_ast,
    visit,
)
from opentelemetry.trace import SpanKind
from strawberry.extensions import LifecycleStep
from strawberry.extensions.tracing import OpenTelemetryExtension
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


def redact_document(document: DocumentNode, schema: GraphQLSchema) -> str:
    """Print the document with every literal bound to a ``Redacted`` argument or input
    field replaced by ``"[redacted]"``. Variables are left as written: their values are
    not part of the document."""
    type_info = TypeInfo(schema)
    return print_ast(visit(document, TypeInfoVisitor(type_info, _RedactLiterals(type_info))))


class _RedactLiterals(Visitor):
    def __init__(self, type_info: TypeInfo) -> None:
        super().__init__()
        self._type_info = type_info

    def enter_argument(self, node: ArgumentNode, *_: Any) -> ArgumentNode | None:
        graphql_argument = self._type_info.get_argument()
        if graphql_argument is None or isinstance(node.value, VariableNode):
            return None
        argument = (graphql_argument.extensions or {}).get("strawberry-definition")
        if isinstance(argument, StrawberryArgument) and argument.metadata.get(_REDACTED_KEY):
            return ArgumentNode(name=node.name, value=StringValueNode(value=REDACTED_VALUE))
        return None

    def enter_object_field(self, node: ObjectFieldNode, *_: Any) -> ObjectFieldNode | None:
        parent = get_named_type(self._type_info.get_parent_input_type())
        if not isinstance(parent, GraphQLInputObjectType) or isinstance(node.value, VariableNode):
            return None
        graphql_field = parent.fields.get(node.name.value)
        if graphql_field is None:
            return None
        field = (graphql_field.extensions or {}).get("strawberry-definition")
        if isinstance(field, StrawberryField) and _is_redacted_field(field):
            return ObjectFieldNode(name=node.name, value=StringValueNode(value=REDACTED_VALUE))
        return None


class RedactingOpenTelemetryExtension(OpenTelemetryExtension):
    """Strawberry's OpenTelemetry extension with ``Redacted`` values blanked.

    Resolver arguments go through ``redact_arguments``. The operation span records the
    parsed document with its ``Redacted`` literals blanked rather than the raw request
    text, so an inlined password is not exported either. A request that fails to parse
    records no document.
    """

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("arg_filter", redact_arguments)
        super().__init__(**kwargs)

    def on_operation(self) -> Generator[None, None, None]:
        self._operation_name = self.execution_context.operation_name
        span = self._tracer.start_span(
            _operation_span_name(self._operation_name), kind=SpanKind.SERVER
        )
        span.set_attribute("component", "graphql")
        self._span_holder[LifecycleStep.OPERATION] = span
        yield
        if not self._operation_name and self.execution_context.operation_name:
            span.update_name(_operation_span_name(self.execution_context.operation_name))
        if (document := self.execution_context.graphql_document) is not None:
            span.set_attribute(
                "query", redact_document(document, self.execution_context.schema._schema)
            )
        span.end()


def _operation_span_name(operation_name: str | None) -> str:
    return f"GraphQL Query: {operation_name}" if operation_name else "GraphQL Query"


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


__all__ = [
    "REDACTED_VALUE",
    "Redacted",
    "RedactingOpenTelemetryExtension",
    "redact_arguments",
    "redact_document",
]
