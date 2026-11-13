"""Marks GraphQL arguments and input fields whose values must not reach span attributes."""

from collections.abc import Callable, Generator
from inspect import isawaitable
from typing import Annotated, Any, Optional, TypeVar

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
    ListValueNode,
    NullValueNode,
    ObjectFieldNode,
    ObjectValueNode,
    StringValueNode,
    TypeInfo,
    TypeInfoVisitor,
    ValueNode,
    VariableDefinitionNode,
    VariableNode,
    Visitor,
    get_named_type,
    print_ast,
    visit,
)
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode, TracerProvider
from strawberry.extensions import LifecycleStep
from strawberry.extensions.tracing import OpenTelemetryExtension
from strawberry.extensions.tracing.utils import should_skip_tracing
from strawberry.types.arguments import StrawberryArgument, StrawberryArgumentAnnotation
from strawberry.types.field import StrawberryField
from typing_extensions import get_args, get_origin

from phoenix.server.telemetry import bind_server_span, resolve_server_parent_context

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
    """Return ``document`` printed with redacted literals and variable defaults blanked."""
    type_info = TypeInfo(schema)
    literal_visitor = _RedactLiterals(type_info)
    redacted_doc = visit(document, TypeInfoVisitor(type_info, literal_visitor))
    if literal_visitor.redacted_variable_names:
        redacted_doc = visit(
            redacted_doc,
            _RedactVariableDefaults(literal_visitor.redacted_variable_names),
        )
    return print_ast(redacted_doc)


def _redact_ast_value(value: ValueNode, redacted_variable_names: set[str]) -> ValueNode:
    if isinstance(value, VariableNode):
        redacted_variable_names.add(value.name.value)
        return value
    if isinstance(value, NullValueNode):
        return value
    if isinstance(value, ListValueNode):
        return ListValueNode(
            values=tuple(_redact_ast_value(item, redacted_variable_names) for item in value.values)
        )
    if isinstance(value, ObjectValueNode):
        return ObjectValueNode(
            fields=tuple(
                ObjectFieldNode(
                    name=field.name,
                    value=_redact_ast_value(field.value, redacted_variable_names),
                )
                for field in value.fields
            )
        )
    return _REDACTED_LITERAL


class _RedactLiterals(Visitor):
    def __init__(self, type_info: TypeInfo) -> None:
        super().__init__()
        self._type_info = type_info
        self.redacted_variable_names: set[str] = set()

    def enter_argument(self, node: ArgumentNode, *_: Any) -> ArgumentNode | None:
        graphql_argument = self._type_info.get_argument()
        if graphql_argument is not None and _is_redacted_argument(graphql_argument):
            new_value = _redact_ast_value(node.value, self.redacted_variable_names)
            return (
                ArgumentNode(name=node.name, value=new_value)
                if new_value is not node.value
                else None
            )
        return None

    def enter_object_field(self, node: ObjectFieldNode, *_: Any) -> ObjectFieldNode | None:
        parent = get_named_type(self._type_info.get_parent_input_type())
        if not isinstance(parent, GraphQLInputObjectType):
            return None
        graphql_field = parent.fields.get(node.name.value)
        if graphql_field is not None and _is_redacted_input_field(graphql_field):
            new_value = _redact_ast_value(node.value, self.redacted_variable_names)
            return (
                ObjectFieldNode(name=node.name, value=new_value)
                if new_value is not node.value
                else None
            )
        return None


class _RedactVariableDefaults(Visitor):
    def __init__(self, redacted_variable_names: set[str]) -> None:
        super().__init__()
        self._redacted_variable_names = redacted_variable_names

    def enter_variable_definition(
        self, node: VariableDefinitionNode, *_: Any
    ) -> VariableDefinitionNode | None:
        if (
            node.variable.name.value in self._redacted_variable_names
            and node.default_value is not None
            and not isinstance(node.default_value, NullValueNode)
        ):
            return VariableDefinitionNode(
                variable=node.variable,
                type=node.type,
                default_value=_REDACTED_LITERAL,
                directives=node.directives,
            )
        return None


_REDACTED_LITERAL = StringValueNode(value=REDACTED_VALUE)


class RedactingOpenTelemetryExtension(OpenTelemetryExtension):
    """Redact GraphQL inputs and preserve server parentage across OpenInference contexts."""

    def __init__(
        self,
        *,
        tracer_provider: Optional[TracerProvider] = None,
        **kwargs: Any,
    ) -> None:
        self._tracer_provider = tracer_provider
        kwargs.setdefault("arg_filter", redact_arguments)
        super().__init__(tracer_provider=tracer_provider, **kwargs)

    def on_operation(self) -> Generator[None, None, None]:
        self._operation_name = self.execution_context.operation_name
        parent_context = (
            resolve_server_parent_context(self._tracer_provider)
            if self._tracer_provider is not None
            else None
        )
        span = self._tracer.start_span(
            _operation_span_name(self._operation_name),
            context=parent_context if parent_context is not None else otel_context.Context(),
            kind=SpanKind.SERVER,
        )
        span.set_attribute("component", "graphql")
        self._span_holder[LifecycleStep.OPERATION] = span
        try:
            yield
        except Exception as exc:
            if span.is_recording():
                span.record_exception(exc)
                span.set_status(Status(StatusCode.ERROR, str(exc)))
            raise
        finally:
            if not self._operation_name and self.execution_context.operation_name:
                span.update_name(_operation_span_name(self.execution_context.operation_name))
            if (document := self.execution_context.graphql_document) is not None:
                span.set_attribute(
                    "query", redact_document(document, self.execution_context.schema._schema)
                )
            span.end()

    async def resolve(
        self,
        _next: Callable[..., Any],
        root: Any,
        info: GraphQLResolveInfo[Any],
        *args: str,
        **kwargs: Any,
    ) -> Any:
        """Trace field resolution while leaving OpenTelemetry's ambient ``Context`` untouched.

        ``span`` is published via :func:`bind_server_span` rather than made
        OTel-current so in-process GraphQL executions inside OpenInference runs
        keep their active OpenInference span in ``trace.get_current_span()``.
        """
        if should_skip_tracing(_next, info):
            result = _next(root, info, *args, **kwargs)
            if isawaitable(result):
                result = await result
            return result

        operation_span = self._span_holder.get(LifecycleStep.OPERATION)
        parent_context = (
            trace.set_span_in_context(operation_span, otel_context.Context())
            if operation_span is not None
            else otel_context.Context()
        )
        span = self._tracer.start_span(
            f"GraphQL Resolving: {info.field_name}",
            context=parent_context,
        )
        try:
            self.add_tags(span, info, kwargs)
            with bind_server_span(span, self._tracer_provider):
                result = _next(root, info, *args, **kwargs)
                if isawaitable(result):
                    result = await result
                return result
        except Exception as exc:
            if span.is_recording():
                span.record_exception(exc)
                span.set_status(Status(StatusCode.ERROR, str(exc)))
            raise
        finally:
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
