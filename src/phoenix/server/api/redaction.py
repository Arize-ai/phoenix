"""Marks GraphQL arguments and input fields whose values must not reach span attributes.

Redaction covers resolver arguments (``graphql.param.*``) and inline or default
literals in recorded GraphQL ``query`` documents. Exception messages raised by
resolvers are recorded on spans verbatim, so resolver errors should not echo
sensitive values.
"""

from collections.abc import AsyncIterator, Callable, Generator
from dataclasses import dataclass, field
from inspect import isawaitable
from typing import Annotated, Any, Optional, TypeVar

import strawberry
from graphql import (
    ArgumentNode,
    DocumentNode,
    FragmentArgumentNode,
    FragmentSpreadNode,
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
    OperationDefinitionNode,
    StringValueNode,
    TypeInfo,
    TypeInfoVisitor,
    ValueNode,
    VariableDefinitionNode,
    VariableNode,
    Visitor,
    get_named_type,
    is_input_type,
    print_ast,
    type_from_ast,
    visit,
)
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.trace import Span, SpanKind, TracerProvider
from strawberry.extensions import LifecycleStep
from strawberry.extensions.tracing import OpenTelemetryExtension
from strawberry.extensions.tracing.utils import should_skip_tracing
from strawberry.types.arguments import StrawberryArgument, StrawberryArgumentAnnotation
from strawberry.types.field import StrawberryField
from typing_extensions import get_args, get_origin

from phoenix.server.telemetry import (
    bind_server_span,
    get_bound_server_span,
    record_span_exception,
    report_instrumentation_failure,
    resolve_server_parent_context,
)

_REDACTED_KEY = "phoenix.redacted"
REDACTED_VALUE = "[redacted]"
_REDACTED_LITERAL = StringValueNode(value=REDACTED_VALUE)
_SUBSCRIPTION_WRAPPED_ATTR = "_phoenix_server_span_wrapped"

T = TypeVar("T")

Redacted = Annotated[T, strawberry.argument(metadata={_REDACTED_KEY: True})]
"""A resolver argument or input field whose value is blanked on spans; the GraphQL type
stays ``T``.

    @strawberry.input
    class CreateUserInput:
        email: Redacted[str]
        password: Redacted[Optional[str]] = UNSET
"""


@dataclass
class _OperationVarState:
    declared_types: dict[str, GraphQLInputType | None] = field(default_factory=dict)
    redacted_names: set[str] = field(default_factory=set)
    referenced_names: set[str] = field(default_factory=set)
    spread_fragments: set[str] = field(default_factory=set)


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
    """Return ``document`` printed with redacted literals and variable defaults blanked.

    Variable declarations and usages are tracked per ``OperationDefinitionNode``,
    and AST values that do not match ``schema`` fail closed to ``"[redacted]"``.
    """
    op_states = _build_operation_var_states(document, schema)
    type_info = TypeInfo(schema)
    literal_visitor = _RedactLiterals(type_info, op_states=op_states)
    redacted_doc = visit(document, TypeInfoVisitor(type_info, literal_visitor))
    if any(state.declared_types for state in op_states):
        literal_visitor.propagate_fragment_usages()
        redacted_doc = visit(redacted_doc, _RedactVariableDefaults(op_states))
    return print_ast(redacted_doc)


def _list_depth(type_: GraphQLInputType) -> int:
    depth = 0
    current: Any = type_
    while isinstance(current, (GraphQLNonNull, GraphQLList)):
        if isinstance(current, GraphQLList):
            depth += 1
        current = current.of_type
    return depth


def _build_operation_var_states(
    document: DocumentNode, schema: GraphQLSchema
) -> list[_OperationVarState]:
    states: list[_OperationVarState] = []
    for definition in document.definitions:
        if not isinstance(definition, OperationDefinitionNode):
            continue
        state = _OperationVarState()
        ambiguous: set[str] = set()
        for var_def in definition.variable_definitions or ():
            name = var_def.variable.name.value
            resolved = type_from_ast(schema, var_def.type)
            input_type = resolved if resolved is not None and is_input_type(resolved) else None
            if name in state.declared_types:
                ambiguous.add(name)
            else:
                state.declared_types[name] = input_type
        for name in ambiguous:
            state.declared_types[name] = None
        states.append(state)
    return states


def _redact_ast_value(
    value: ValueNode,
    redacted_variable_names: set[str],
    referenced_variable_names: set[str],
) -> ValueNode:
    if isinstance(value, VariableNode):
        referenced_variable_names.add(value.name.value)
        redacted_variable_names.add(value.name.value)
        return value
    if isinstance(value, NullValueNode):
        return value
    if isinstance(value, ListValueNode):
        return ListValueNode(
            values=tuple(
                _redact_ast_value(item, redacted_variable_names, referenced_variable_names)
                for item in value.values
            )
        )
    if isinstance(value, ObjectValueNode):
        return ObjectValueNode(
            fields=tuple(
                ObjectFieldNode(
                    name=field.name,
                    value=_redact_ast_value(
                        field.value, redacted_variable_names, referenced_variable_names
                    ),
                )
                for field in value.fields
            )
        )
    return _REDACTED_LITERAL


def _sanitize_ast_value(
    value: ValueNode,
    expected_type: GraphQLInputType | None,
    *,
    declared_var_types: dict[str, GraphQLInputType | None] | None,
    redacted_variable_names: set[str],
    referenced_variable_names: set[str],
    fragment_expected_types: dict[str, list[GraphQLInputType]] | None = None,
) -> ValueNode:
    if isinstance(value, NullValueNode):
        return value
    if expected_type is None:
        return _redact_ast_value(value, redacted_variable_names, referenced_variable_names)
    if isinstance(expected_type, GraphQLNonNull):
        return _sanitize_ast_value(
            value,
            expected_type.of_type,
            declared_var_types=declared_var_types,
            redacted_variable_names=redacted_variable_names,
            referenced_variable_names=referenced_variable_names,
            fragment_expected_types=fragment_expected_types,
        )
    if isinstance(value, VariableNode):
        var_name = value.name.value
        referenced_variable_names.add(var_name)
        if declared_var_types is None:
            if fragment_expected_types is not None:
                fragment_expected_types.setdefault(var_name, []).append(expected_type)
            else:
                redacted_variable_names.add(var_name)
            return value
        var_type = declared_var_types.get(var_name)
        if (
            var_type is None
            or get_named_type(var_type) is not get_named_type(expected_type)
            or _list_depth(var_type) > _list_depth(expected_type)
        ):
            redacted_variable_names.add(var_name)
        return value
    if isinstance(expected_type, GraphQLList):
        if isinstance(value, ListValueNode):
            new_items = tuple(
                _sanitize_ast_value(
                    item,
                    expected_type.of_type,
                    declared_var_types=declared_var_types,
                    redacted_variable_names=redacted_variable_names,
                    referenced_variable_names=referenced_variable_names,
                    fragment_expected_types=fragment_expected_types,
                )
                for item in value.values
            )
            return ListValueNode(values=new_items) if new_items != value.values else value
        return _sanitize_ast_value(
            value,
            expected_type.of_type,
            declared_var_types=declared_var_types,
            redacted_variable_names=redacted_variable_names,
            referenced_variable_names=referenced_variable_names,
            fragment_expected_types=fragment_expected_types,
        )
    if isinstance(expected_type, GraphQLInputObjectType):
        if not isinstance(value, ObjectValueNode):
            return _redact_ast_value(value, redacted_variable_names, referenced_variable_names)
        changed = False
        new_fields: list[ObjectFieldNode] = []
        for field_node in value.fields:
            graphql_field = expected_type.fields.get(field_node.name.value)
            field_type = (
                None
                if graphql_field is None or _is_redacted_input_field(graphql_field)
                else graphql_field.type
            )
            new_field_value = _sanitize_ast_value(
                field_node.value,
                field_type,
                declared_var_types=declared_var_types,
                redacted_variable_names=redacted_variable_names,
                referenced_variable_names=referenced_variable_names,
                fragment_expected_types=fragment_expected_types,
            )
            if new_field_value is not field_node.value:
                changed = True
                new_fields.append(ObjectFieldNode(name=field_node.name, value=new_field_value))
            else:
                new_fields.append(field_node)
        return ObjectValueNode(fields=tuple(new_fields)) if changed else value
    if isinstance(value, (ObjectValueNode, ListValueNode)):
        return _redact_ast_value(value, redacted_variable_names, referenced_variable_names)
    return value


class _RedactLiterals(Visitor):
    def __init__(
        self,
        type_info: TypeInfo,
        *,
        op_states: list[_OperationVarState],
    ) -> None:
        super().__init__()
        self._type_info = type_info
        self._op_states = op_states
        self._op_index = -1
        self._current_op: _OperationVarState | None = None
        self._current_fragment: str | None = None
        self._fragment_redacted: dict[str, set[str]] = {}
        self._fragment_referenced: dict[str, set[str]] = {}
        self._fragment_expected_types: dict[str, dict[str, list[GraphQLInputType]]] = {}
        self._fragment_spreads: dict[str, set[str]] = {}

    def enter_operation_definition(self, *_: Any) -> None:
        self._op_index += 1
        self._current_op = self._op_states[self._op_index]

    def leave_operation_definition(self, *_: Any) -> None:
        self._current_op = None

    def enter_fragment_definition(self, node: Any, *_: Any) -> None:
        name = node.name.value
        self._current_fragment = name
        self._fragment_redacted.setdefault(name, set())
        self._fragment_referenced.setdefault(name, set())
        self._fragment_expected_types.setdefault(name, {})
        self._fragment_spreads.setdefault(name, set())

    def leave_fragment_definition(self, *_: Any) -> None:
        self._current_fragment = None

    def enter_fragment_spread(self, node: FragmentSpreadNode, *_: Any) -> None:
        target = node.name.value
        if self._current_op is not None:
            self._current_op.spread_fragments.add(target)
        elif self._current_fragment is not None:
            self._fragment_spreads[self._current_fragment].add(target)

    def enter_argument(self, node: ArgumentNode, *_: Any) -> ArgumentNode | None:
        graphql_argument = self._type_info.get_argument()
        expected_type = (
            None
            if graphql_argument is None or _is_redacted_argument(graphql_argument)
            else graphql_argument.type
        )
        if self._current_op is not None:
            new_value = _sanitize_ast_value(
                node.value,
                expected_type,
                declared_var_types=self._current_op.declared_types,
                redacted_variable_names=self._current_op.redacted_names,
                referenced_variable_names=self._current_op.referenced_names,
            )
        elif self._current_fragment is not None:
            frag = self._current_fragment
            new_value = _sanitize_ast_value(
                node.value,
                expected_type,
                declared_var_types=None,
                redacted_variable_names=self._fragment_redacted[frag],
                referenced_variable_names=self._fragment_referenced[frag],
                fragment_expected_types=self._fragment_expected_types[frag],
            )
        else:
            new_value = _redact_ast_value(node.value, set(), set())
        return (
            ArgumentNode(name=node.name, value=new_value) if new_value is not node.value else None
        )

    def enter_fragment_argument(
        self, node: FragmentArgumentNode, *_: Any
    ) -> FragmentArgumentNode | None:
        redacted = self._current_op.redacted_names if self._current_op is not None else set()
        referenced = self._current_op.referenced_names if self._current_op is not None else set()
        new_value = _redact_ast_value(node.value, redacted, referenced)
        return (
            FragmentArgumentNode(name=node.name, value=new_value)
            if new_value is not node.value
            else None
        )

    def propagate_fragment_usages(self) -> None:
        if not self._fragment_referenced:
            return
        for op_state in self._op_states:
            visited: set[str] = set()
            stack = list(op_state.spread_fragments)
            while stack:
                frag = stack.pop()
                if frag in visited:
                    continue
                visited.add(frag)
                op_state.referenced_names |= self._fragment_referenced.get(frag, set())
                op_state.redacted_names |= self._fragment_redacted.get(frag, set())
                for var_name, expected_types in self._fragment_expected_types.get(frag, {}).items():
                    var_type = op_state.declared_types.get(var_name)
                    for expected_type in expected_types:
                        if (
                            var_type is None
                            or get_named_type(var_type) is not get_named_type(expected_type)
                            or _list_depth(var_type) > _list_depth(expected_type)
                        ):
                            op_state.redacted_names.add(var_name)
                stack.extend(self._fragment_spreads.get(frag, ()))


class _RedactVariableDefaults(Visitor):
    def __init__(self, op_states: list[_OperationVarState]) -> None:
        super().__init__()
        self._op_states = op_states
        self._op_index = -1
        self._current_op: _OperationVarState | None = None

    def enter_operation_definition(self, *_: Any) -> None:
        self._op_index += 1
        self._current_op = self._op_states[self._op_index]

    def leave_operation_definition(self, *_: Any) -> None:
        self._current_op = None

    def enter_variable_definition(
        self, node: VariableDefinitionNode, *_: Any
    ) -> VariableDefinitionNode | None:
        if (
            self._current_op is None
            or node.default_value is None
            or isinstance(node.default_value, NullValueNode)
        ):
            return None
        var_name = node.variable.name.value
        expected_type = (
            None
            if (
                var_name in self._current_op.redacted_names
                or var_name not in self._current_op.referenced_names
            )
            else self._current_op.declared_types.get(var_name)
        )
        new_default = _sanitize_ast_value(
            node.default_value,
            expected_type,
            declared_var_types=self._current_op.declared_types,
            redacted_variable_names=set(),
            referenced_variable_names=set(),
        )
        if new_default is node.default_value:
            return None
        return VariableDefinitionNode(
            variable=node.variable,
            type=node.type,
            default_value=new_default,  # type: ignore[arg-type]
            directives=node.directives,
        )


class _BoundAsyncIterator:
    """Bind a GraphQL operation span around each step of a subscription source stream."""

    def __init__(
        self,
        inner: AsyncIterator[Any],
        span: Span,
        tracer_provider: TracerProvider,
    ) -> None:
        self._inner = inner
        self._span = span
        self._tracer_provider = tracer_provider

    def __aiter__(self) -> "_BoundAsyncIterator":
        return self

    async def __anext__(self) -> Any:
        with bind_server_span(self._span, self._tracer_provider):
            return await self._inner.__anext__()

    async def asend(self, value: Any) -> Any:
        asend = getattr(self._inner, "asend", None)
        if asend is None:
            return await self.__anext__()
        with bind_server_span(self._span, self._tracer_provider):
            return await asend(value)

    async def athrow(self, typ: Any, val: Any = None, tb: Any = None) -> Any:
        athrow = getattr(self._inner, "athrow", None)
        if athrow is None:
            if val is None:
                raise typ
            raise val
        with bind_server_span(self._span, self._tracer_provider):
            return await athrow(typ, val, tb)

    async def aclose(self) -> None:
        aclose = getattr(self._inner, "aclose", None)
        if aclose is None:
            return
        with bind_server_span(self._span, self._tracer_provider):
            await aclose()


def _wrap_subscription_resolver(subscribe_fn: Callable[..., Any]) -> Callable[..., Any]:
    if getattr(subscribe_fn, _SUBSCRIPTION_WRAPPED_ATTR, False):
        return subscribe_fn

    def _wrapped(root: Any, info: GraphQLResolveInfo[Any], **kwargs: Any) -> Any:
        binding = get_bound_server_span()
        result = subscribe_fn(root, info, **kwargs)
        if binding is None:
            return result
        span, provider = binding
        if isawaitable(result):

            async def _await_stream() -> Any:
                with bind_server_span(span, provider):
                    stream = await result
                if hasattr(stream, "__aiter__"):
                    return _BoundAsyncIterator(stream.__aiter__(), span, provider)
                return stream

            return _await_stream()
        if hasattr(result, "__aiter__"):
            return _BoundAsyncIterator(result.__aiter__(), span, provider)
        return result

    setattr(_wrapped, _SUBSCRIPTION_WRAPPED_ATTR, True)
    return _wrapped


def _ensure_subscription_fields_wrapped(schema: GraphQLSchema) -> None:
    subscription_type = schema.subscription_type
    if subscription_type is None:
        return
    for field_def in subscription_type.fields.values():
        if field_def.subscribe is not None and not getattr(
            field_def.subscribe, _SUBSCRIPTION_WRAPPED_ATTR, False
        ):
            field_def.subscribe = _wrap_subscription_resolver(field_def.subscribe)


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
            record_span_exception(span, exc, set_error_type=False)
            raise
        finally:
            try:
                if not self._operation_name and self.execution_context.operation_name:
                    span.update_name(_operation_span_name(self.execution_context.operation_name))
                if (document := self.execution_context.graphql_document) is not None:
                    span.set_attribute(
                        "query", redact_document(document, self.execution_context.schema._schema)
                    )
            except Exception:
                report_instrumentation_failure("RedactingOpenTelemetryExtension.on_operation")
            finally:
                span.end()

    def on_execute(self) -> Generator[None, None, None]:
        operation_span = self._span_holder.get(LifecycleStep.OPERATION)
        if operation_span is None or self._tracer_provider is None:
            yield
            return
        try:
            _ensure_subscription_fields_wrapped(self.execution_context.schema._schema)
        except Exception:
            report_instrumentation_failure("RedactingOpenTelemetryExtension.on_execute")
        with bind_server_span(operation_span, self._tracer_provider):
            yield

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
        Third-party OpenTelemetry instrumentors inside resolvers that inspect only
        ``trace.get_current_span()`` rather than :func:`resolve_server_parent_context`
        therefore do not inherit the resolver span.
        """
        if should_skip_tracing(_next, info) or _is_within_list_item(info):
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
            try:
                self.add_tags(span, info, kwargs)
            except Exception:
                report_instrumentation_failure("RedactingOpenTelemetryExtension.add_tags")
            with bind_server_span(span, self._tracer_provider):
                result = _next(root, info, *args, **kwargs)
                if isawaitable(result):
                    result = await result
                return result
        except Exception as exc:
            record_span_exception(span, exc, set_error_type=False)
            raise
        finally:
            span.end()


def _is_within_list_item(info: GraphQLResolveInfo[Any]) -> bool:
    """Whether the field resolves inside an element of a list.

    Per-item resolver spans multiply with list length (one span per field per
    row), which costs request-path CPU and can overflow the span export queue;
    SQL issued by such resolvers still parents to the nearest traced ancestor.
    """
    path = info.path.prev
    while path is not None:
        if isinstance(path.key, int):
            return True
        path = path.prev
    return False


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
