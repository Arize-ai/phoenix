"""Marks GraphQL arguments and input fields whose values must not reach span attributes."""

from collections.abc import Generator
from typing import Annotated, Any, TypeVar

import strawberry
from graphql import (
    ArgumentNode,
    DocumentNode,
    GraphQLArgument,
    GraphQLInputField,
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
"""A resolver argument or input field whose value is blanked on spans; the GraphQL type
stays ``T``.

    @strawberry.input
    class CreateUserInput:
        email: Redacted[str]
        password: Redacted[Optional[str]] = UNSET
"""


def redact_arguments(args: dict[str, Any], info: GraphQLResolveInfo[Any]) -> dict[str, Any]:
    """Strawberry ``arg_filter``. ``args`` is the deep copy Strawberry makes for the
    filter, so nested input objects are blanked in place."""
    graphql_field = info.parent_type.fields.get(info.field_name)
    if graphql_field is None:
        return args
    for name, value in args.items():
        graphql_argument = graphql_field.args.get(name)
        if graphql_argument is None:
            continue
        if _is_redacted_argument(graphql_argument):
            args[name] = REDACTED_VALUE
        else:
            _redact_input_object(value, graphql_argument.type)
    return args


def redact_document(document: DocumentNode, schema: GraphQLSchema) -> str:
    """Variables are left as written: their values are not part of the document."""
    type_info = TypeInfo(schema)
    return print_ast(visit(document, TypeInfoVisitor(type_info, _RedactLiterals(type_info))))


class _RedactLiterals(Visitor):
    def __init__(self, type_info: TypeInfo) -> None:
        super().__init__()
        self._type_info = type_info

    def enter_argument(self, node: ArgumentNode, *_: Any) -> ArgumentNode | None:
        graphql_argument = self._type_info.get_argument()
        if (
            graphql_argument is not None
            and not isinstance(node.value, VariableNode)
            and _is_redacted_argument(graphql_argument)
        ):
            return ArgumentNode(name=node.name, value=_REDACTED_LITERAL)
        return None

    def enter_object_field(self, node: ObjectFieldNode, *_: Any) -> ObjectFieldNode | None:
        parent = get_named_type(self._type_info.get_parent_input_type())
        if not isinstance(parent, GraphQLInputObjectType) or isinstance(node.value, VariableNode):
            return None
        graphql_field = parent.fields.get(node.name.value)
        if graphql_field is not None and _is_redacted_input_field(graphql_field):
            return ObjectFieldNode(name=node.name, value=_REDACTED_LITERAL)
        return None


_REDACTED_LITERAL = StringValueNode(value=REDACTED_VALUE)


class RedactingOpenTelemetryExtension(OpenTelemetryExtension):
    """Strawberry's OpenTelemetry extension with ``Redacted`` values blanked.

    ``on_operation`` is reimplemented rather than wrapped: the parent records the raw
    request text before parsing, and a span attribute cannot be removed once set.
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


def _redact_input_object(value: Any, type_: GraphQLInputType) -> None:
    if isinstance(type_, GraphQLNonNull):
        _redact_input_object(value, type_.of_type)
    elif isinstance(type_, GraphQLList):
        if isinstance(value, list):
            for item in value:
                _redact_input_object(item, type_.of_type)
    elif isinstance(type_, GraphQLInputObjectType) and isinstance(value, dict):
        for name, graphql_field in type_.fields.items():
            if name not in value:
                continue
            if _is_redacted_input_field(graphql_field):
                value[name] = REDACTED_VALUE
            else:
                _redact_input_object(value[name], graphql_field.type)


def _is_redacted_argument(graphql_argument: GraphQLArgument) -> bool:
    argument = _strawberry_definition(graphql_argument)
    return isinstance(argument, StrawberryArgument) and bool(argument.metadata.get(_REDACTED_KEY))


def _is_redacted_input_field(graphql_field: GraphQLInputField) -> bool:
    field = _strawberry_definition(graphql_field)
    if not isinstance(field, StrawberryField) or field.type_annotation is None:
        return False
    annotation = field.type_annotation.evaluate()
    return get_origin(annotation) is Annotated and any(
        isinstance(item, StrawberryArgumentAnnotation) and bool(item.metadata.get(_REDACTED_KEY))
        for item in get_args(annotation)[1:]
    )


def _strawberry_definition(graphql_node: GraphQLArgument | GraphQLInputField) -> object:
    """Strawberry attaches its own definition to every graphql-core argument and field."""
    return (graphql_node.extensions or {}).get("strawberry-definition")


__all__ = [
    "REDACTED_VALUE",
    "Redacted",
    "RedactingOpenTelemetryExtension",
    "redact_arguments",
    "redact_document",
]
