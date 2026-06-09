"""Evaluator for jq expressions.

Executes a parsed AST against a value, returning results.
"""

import json
from typing import Any

from .builtins import call_builtin
from .types import (
    ArrayDestructure,
    AstNode,
    EvalContext,
    FuncDef,
    JqError,
    ObjectDestructure,
)


class BreakException(Exception):
    """Exception for label/break control flow."""

    def __init__(self, name: str, values: list | None = None):
        self.name = name
        self.values: list = values or []
        super().__init__(f"break {name}")


def _pattern_matches(
    pattern: str | ArrayDestructure | ObjectDestructure,
    value: Any,
) -> bool:
    """Check if a value matches a destructuring pattern type."""
    if isinstance(pattern, str):
        return True  # Simple $var matches anything
    if isinstance(pattern, ArrayDestructure):
        return isinstance(value, list)
    if isinstance(pattern, ObjectDestructure):
        return isinstance(value, dict)
    return True


def _bind_pattern(
    pattern: str | ArrayDestructure | ObjectDestructure,
    value: Any,
    base_vars: dict[str, Any],
) -> dict[str, Any]:
    """Bind a value to a destructuring pattern, returning updated vars dict."""
    if isinstance(pattern, str):
        return {**base_vars, pattern: value}
    elif isinstance(pattern, ArrayDestructure):
        new_vars = dict(base_vars)
        for i, elem in enumerate(pattern.elements):
            v = value[i] if isinstance(value, list) and i < len(value) else None
            new_vars = _bind_pattern(elem, v, new_vars)
        return new_vars
    elif isinstance(pattern, ObjectDestructure):
        new_vars = dict(base_vars)
        for key, pat in pattern.entries:
            v = value.get(key) if isinstance(value, dict) else None
            new_vars = _bind_pattern(pat, v, new_vars)
        return new_vars
    return base_vars


def _jq_type(v: Any) -> str:
    """Return the jq type name for a value."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "number"
    if isinstance(v, float):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return "unknown"


def evaluate(
    value: Any,
    ast: AstNode,
    ctx: EvalContext | None = None,
) -> list[Any]:
    """Evaluate an AST against a value, returning a list of results.

    Args:
        value: The input value to evaluate against
        ast: The AST node to evaluate
        ctx: Optional evaluation context (created if not provided)

    Returns:
        A list of result values (jq expressions can produce multiple outputs)
    """
    if ctx is None:
        ctx = EvalContext()

    # Initialize root if not set (first evaluation)
    if ctx.root is None:
        ctx = EvalContext(
            vars=ctx.vars,
            limits=ctx.limits,
            env=ctx.env,
            root=value,
            current_path=[],
            funcs=ctx.funcs,
        )

    return _eval_node(value, ast, ctx)


def _eval_node(value: Any, ast: AstNode, ctx: EvalContext) -> list[Any]:
    """Evaluate a single AST node."""
    node_type = ast.type

    if node_type == "Identity":
        return [value]

    elif node_type == "Field":
        node = ast  # type: FieldNode
        bases = _eval_node(value, node.base, ctx) if node.base else [value]
        results = []
        for v in bases:
            if isinstance(v, dict):
                results.append(v.get(node.name))
            elif v is None:
                results.append(None)
            else:
                raise ValueError(f"Cannot index {_jq_type(v)} with string \"{node.name}\"")
        return results

    elif node_type == "Index":
        node = ast  # type: IndexNode
        bases = _eval_node(value, node.base, ctx) if node.base else [value]
        results = []
        for v in bases:
            indices = _eval_node(v, node.index, ctx)
            for idx in indices:
                if isinstance(idx, int) and isinstance(v, list):
                    i = idx if idx >= 0 else len(v) + idx
                    if 0 <= i < len(v):
                        results.append(v[i])
                    else:
                        results.append(None)
                elif isinstance(idx, str) and isinstance(v, dict):
                    results.append(v.get(idx))
                else:
                    results.append(None)
        return results

    elif node_type == "Slice":
        node = ast  # type: SliceNode
        bases = _eval_node(value, node.base, ctx) if node.base else [value]
        results = []
        for v in bases:
            if v is None:
                results.append(None)
                continue
            if not isinstance(v, (list, str)):
                raise ValueError(f"Cannot slice {_jq_type(v)}")
                continue
            length = len(v)
            starts = _eval_node(value, node.start, ctx) if node.start else [0]
            ends = _eval_node(value, node.end, ctx) if node.end else [length]
            for s in starts:
                for e in ends:
                    start = _normalize_index(s, length)
                    end = _normalize_index(e, length)
                    results.append(v[start:end])
        return results

    elif node_type == "Iterate":
        node = ast  # type: IterateNode
        bases = _eval_node(value, node.base, ctx) if node.base else [value]
        results = []
        for v in bases:
            if isinstance(v, list):
                results.extend(v)
            elif isinstance(v, dict):
                results.extend(v.values())
            elif v is None:
                raise ValueError("Cannot iterate over null")
            else:
                raise ValueError(f"Cannot iterate over {_jq_type(v)} ({json.dumps(v)})")
        return results

    elif node_type == "Pipe":
        node = ast  # type: PipeNode
        left_results = _eval_node(value, node.left, ctx)
        results = []
        for v in left_results:
            try:
                results.extend(_eval_node(v, node.right, ctx))
            except BreakException as e:
                e.values = results + e.values
                raise
        return results

    elif node_type == "Comma":
        node = ast  # type: CommaNode
        try:
            left_results = _eval_node(value, node.left, ctx)
        except BreakException as e:
            raise
        right_results = _eval_node(value, node.right, ctx)
        return left_results + right_results

    elif node_type == "Literal":
        node = ast  # type: LiteralNode
        return [node.value]

    elif node_type == "Array":
        node = ast  # type: ArrayNode
        if node.elements is None:
            return [[]]
        elements = _eval_node(value, node.elements, ctx)
        return [elements]

    elif node_type == "Object":
        node = ast  # type: ObjectNode
        results: list[dict[str, Any]] = [{}]

        for entry in node.entries:
            if isinstance(entry.key, str):
                keys = [entry.key]
            else:
                keys = _eval_node(value, entry.key, ctx)
            values = _eval_node(value, entry.value, ctx)

            new_results = []
            for obj in results:
                for k in keys:
                    for v in values:
                        new_results.append({**obj, str(k): v})
            results = new_results

        return results

    elif node_type == "Paren":
        node = ast  # type: ParenNode
        return _eval_node(value, node.expr, ctx)

    elif node_type == "BinaryOp":
        node = ast  # type: BinaryOpNode
        return _eval_binary_op(value, node.op, node.left, node.right, ctx)

    elif node_type == "UnaryOp":
        node = ast  # type: UnaryOpNode
        operands = _eval_node(value, node.operand, ctx)
        results = []
        for v in operands:
            if node.op == "-":
                results.append(-v if isinstance(v, (int, float)) else None)
            elif node.op == "not":
                results.append(not _is_truthy(v))
        return results

    elif node_type == "Cond":
        node = ast  # type: CondNode
        conds = _eval_node(value, node.cond, ctx)
        results = []
        for c in conds:
            if _is_truthy(c):
                results.extend(_eval_node(value, node.then, ctx))
            else:
                # Check elifs
                handled = False
                for elif_ in node.elifs:
                    elif_conds = _eval_node(value, elif_.cond, ctx)
                    if any(_is_truthy(ec) for ec in elif_conds):
                        results.extend(_eval_node(value, elif_.then, ctx))
                        handled = True
                        break
                if not handled:
                    if node.else_ is not None:
                        results.extend(_eval_node(value, node.else_, ctx))
                    else:
                        results.append(None)
        return results

    elif node_type == "Try":
        node = ast  # type: TryNode
        try:
            return _eval_node(value, node.body, ctx)
        except JqError as e:
            if node.catch:
                return _eval_node(e.value, node.catch, ctx)
            return []
        except Exception as e:
            if node.catch:
                error_val = str(e)
                return _eval_node(error_val, node.catch, ctx)
            return []

    elif node_type == "Call":
        node = ast  # type: CallNode
        # Check user-defined functions first
        func_key = f"{node.name}/{len(node.args)}"
        func_def = ctx.funcs.get(func_key) or ctx.funcs.get(node.name)
        if func_def:
            new_funcs = dict(ctx.funcs)
            # In jq, function args are filters (thunks). When the param is
            # referenced in the body, it acts as a zero-arg function that
            # evaluates the arg expression with the current input.
            for i, param_name in enumerate(func_def.args):
                if i < len(node.args):
                    new_funcs[param_name] = FuncDef(
                        name=param_name, args=[], body=node.args[i]
                    )
            new_ctx = EvalContext(
                vars=dict(ctx.vars),
                limits=ctx.limits,
                env=ctx.env,
                root=ctx.root,
                current_path=ctx.current_path,
                funcs=new_funcs,
            )
            return _eval_node(value, func_def.body, new_ctx)
        return call_builtin(value, node.name, node.args, ctx, _eval_node)

    elif node_type == "VarBind":
        node = ast  # type: VarBindNode
        values = _eval_node(value, node.value, ctx)
        results = []
        all_patterns = [node.name] + (node.alt_patterns or [])
        for v in values:
            if len(all_patterns) > 1:
                # ?// alternative patterns - try each until one matches
                matched = False
                for pat in all_patterns:
                    if _pattern_matches(pat, v):
                        new_vars = _bind_pattern(pat, v, ctx.vars)
                        new_ctx = EvalContext(
                            vars=new_vars,
                            limits=ctx.limits,
                            env=ctx.env,
                            root=ctx.root,
                            current_path=ctx.current_path,
                            funcs=ctx.funcs,
                        )
                        results.extend(_eval_node(value, node.body, new_ctx))
                        matched = True
                        break
                if not matched:
                    # None matched, use last pattern binding with nulls
                    new_vars = _bind_pattern(all_patterns[-1], v, ctx.vars)
                    new_ctx = EvalContext(
                        vars=new_vars,
                        limits=ctx.limits,
                        env=ctx.env,
                        root=ctx.root,
                        current_path=ctx.current_path,
                        funcs=ctx.funcs,
                    )
                    results.extend(_eval_node(value, node.body, new_ctx))
            else:
                new_vars = _bind_pattern(node.name, v, ctx.vars)
                new_ctx = EvalContext(
                    vars=new_vars,
                    limits=ctx.limits,
                    env=ctx.env,
                    root=ctx.root,
                    current_path=ctx.current_path,
                    funcs=ctx.funcs,
                )
                results.extend(_eval_node(value, node.body, new_ctx))
        return results

    elif node_type == "VarRef":
        node = ast  # type: VarRefNode
        # Special case: $ENV returns environment variables
        if node.name == "$ENV":
            return [ctx.env]
        v = ctx.vars.get(node.name)
        return [v] if v is not None else [None]

    elif node_type == "Recurse":
        # Recursive descent (..)
        results: list[Any] = []
        seen: set[int] = set()

        def walk(val: Any) -> None:
            if isinstance(val, (dict, list)):
                obj_id = id(val)
                if obj_id in seen:
                    return
                seen.add(obj_id)
            results.append(val)
            if isinstance(val, list):
                for item in val:
                    walk(item)
            elif isinstance(val, dict):
                for v in val.values():
                    walk(v)

        walk(value)
        return results

    elif node_type == "Optional":
        node = ast  # type: OptionalNode
        try:
            return _eval_node(value, node.expr, ctx)
        except Exception:
            return []

    elif node_type == "StringInterp":
        node = ast  # type: StringInterpNode
        parts = []
        for part in node.parts:
            if isinstance(part, str):
                parts.append(part)
            else:
                vals = _eval_node(value, part, ctx)
                parts.append("".join(v if isinstance(v, str) else json.dumps(v) for v in vals))
        return ["".join(parts)]

    elif node_type == "UpdateOp":
        node = ast  # type: UpdateOpNode
        return [_apply_update(value, node.path, node.op, node.value, ctx)]

    elif node_type == "Reduce":
        node = ast  # type: ReduceNode
        items = _eval_node(value, node.expr, ctx)
        init_results = _eval_node(value, node.init, ctx)
        accumulator = init_results[0] if init_results else None
        for item in items:
            new_vars = _bind_pattern(node.var_name, item, ctx.vars)
            new_ctx = EvalContext(
                vars=new_vars,
                limits=ctx.limits,
                env=ctx.env,
                root=ctx.root,
                current_path=ctx.current_path,
                funcs=ctx.funcs,
            )
            update_results = _eval_node(accumulator, node.update, new_ctx)
            accumulator = update_results[0] if update_results else None
        return [accumulator]

    elif node_type == "Foreach":
        node = ast  # type: ForeachNode
        items = _eval_node(value, node.expr, ctx)
        init_results = _eval_node(value, node.init, ctx)
        state = init_results[0] if init_results else None
        results = []
        for item in items:
            new_vars = _bind_pattern(node.var_name, item, ctx.vars)
            new_ctx = EvalContext(
                vars=new_vars,
                limits=ctx.limits,
                env=ctx.env,
                root=ctx.root,
                current_path=ctx.current_path,
                funcs=ctx.funcs,
            )
            state_results = _eval_node(state, node.update, new_ctx)
            state = state_results[0] if state_results else None
            if node.extract:
                extracted = _eval_node(state, node.extract, new_ctx)
                results.extend(extracted)
            else:
                results.append(state)
        return results

    elif node_type == "Def":
        node = ast  # type: DefNode
        # Register the function and continue with rest
        func_key = f"{node.name}/{len(node.args)}"
        new_ctx = EvalContext(
            vars=ctx.vars,
            limits=ctx.limits,
            env=ctx.env,
            root=ctx.root,
            current_path=ctx.current_path,
            funcs={**ctx.funcs, func_key: FuncDef(node.name, node.args, node.body),
                   node.name: FuncDef(node.name, node.args, node.body)},
        )
        return _eval_node(value, node.rest, new_ctx)

    elif node_type == "Label":
        node = ast  # type: LabelNode
        try:
            return _eval_node(value, node.body, ctx)
        except BreakException as e:
            if e.name == node.name:
                return e.values
            raise

    elif node_type == "Break":
        node = ast  # type: BreakNode
        raise BreakException(node.name)

    raise ValueError(f"Unknown AST node type: {node_type}")


def _normalize_index(idx: int, length: int) -> int:
    """Normalize a slice index."""
    if idx < 0:
        return max(0, length + idx)
    return min(idx, length)


def _is_truthy(v: Any) -> bool:
    """Check if a value is truthy in jq terms."""
    return v is not None and v is not False


def _eval_binary_op(
    value: Any,
    op: str,
    left: AstNode,
    right: AstNode,
    ctx: EvalContext,
) -> list[Any]:
    """Evaluate a binary operation."""
    # Short-circuit for 'and' and 'or'
    if op == "and":
        left_vals = _eval_node(value, left, ctx)
        results = []
        for lv in left_vals:
            if not _is_truthy(lv):
                results.append(False)
            else:
                right_vals = _eval_node(value, right, ctx)
                results.extend(_is_truthy(rv) for rv in right_vals)
        return results

    if op == "or":
        left_vals = _eval_node(value, left, ctx)
        results = []
        for lv in left_vals:
            if _is_truthy(lv):
                results.append(True)
            else:
                right_vals = _eval_node(value, right, ctx)
                results.extend(_is_truthy(rv) for rv in right_vals)
        return results

    if op == "//":
        left_vals = _eval_node(value, left, ctx)
        non_null = [v for v in left_vals if v is not None and v is not False]
        if non_null:
            return non_null
        return _eval_node(value, right, ctx)

    left_vals = _eval_node(value, left, ctx)
    right_vals = _eval_node(value, right, ctx)

    results = []
    for lv in left_vals:
        for rv in right_vals:
            if op == "+":
                # jq: null + x = x, x + null = x
                if lv is None:
                    results.append(rv)
                elif rv is None:
                    results.append(lv)
                elif isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                    results.append(lv + rv)
                elif isinstance(lv, str) and isinstance(rv, str):
                    results.append(lv + rv)
                elif isinstance(lv, list) and isinstance(rv, list):
                    results.append(lv + rv)
                elif isinstance(lv, dict) and isinstance(rv, dict):
                    results.append({**lv, **rv})
                else:
                    results.append(None)
            elif op == "-":
                if isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                    results.append(lv - rv)
                elif isinstance(lv, list) and isinstance(rv, list):
                    # Subtract elements in rv from lv
                    r_set = {json.dumps(x, sort_keys=True) for x in rv}
                    results.append([x for x in lv if json.dumps(x, sort_keys=True) not in r_set])
                else:
                    results.append(None)
            elif op == "*":
                if isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                    results.append(lv * rv)
                elif isinstance(lv, str) and isinstance(rv, int):
                    results.append(lv * rv)
                elif isinstance(lv, dict) and isinstance(rv, dict):
                    results.append(_deep_merge(lv, rv))
                else:
                    results.append(None)
            elif op == "/":
                if isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                    if rv == 0:
                        results.append(None)
                    else:
                        result = lv / rv
                        # jq returns integer when both operands are ints and division is exact
                        if isinstance(lv, int) and isinstance(rv, int) and result == int(result):
                            results.append(int(result))
                        else:
                            results.append(result)
                elif isinstance(lv, str) and isinstance(rv, str):
                    results.append(lv.split(rv))
                else:
                    results.append(None)
            elif op == "%":
                if isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                    results.append(lv % rv if rv != 0 else None)
                else:
                    results.append(None)
            elif op == "==":
                results.append(_deep_equal(lv, rv))
            elif op == "!=":
                results.append(not _deep_equal(lv, rv))
            elif op == "<":
                results.append(_compare(lv, rv) < 0)
            elif op == "<=":
                results.append(_compare(lv, rv) <= 0)
            elif op == ">":
                results.append(_compare(lv, rv) > 0)
            elif op == ">=":
                results.append(_compare(lv, rv) >= 0)
            else:
                results.append(None)

    return results


def _deep_equal(a: Any, b: Any) -> bool:
    """Deep equality check."""
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def _compare(a: Any, b: Any) -> int:
    """Compare two values jq-style."""
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return -1 if a < b else (1 if a > b else 0)
    if isinstance(a, str) and isinstance(b, str):
        return -1 if a < b else (1 if a > b else 0)
    return 0


def _deep_merge(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Deep merge two dictionaries."""
    result = dict(a)
    for key, val in b.items():
        if key in result and isinstance(result[key], dict) and isinstance(val, dict):
            result[key] = _deep_merge(result[key], val)
        else:
            result[key] = val
    return result


def _apply_update(
    root: Any,
    path_expr: AstNode,
    op: str,
    value_expr: AstNode,
    ctx: EvalContext,
) -> Any:
    """Apply an update operation."""

    def compute_new_value(current: Any, new_val: Any) -> Any:
        if op == "=":
            return new_val
        elif op == "|=":
            # For |=, evaluate value_expr with current as input
            results = _eval_node(current, value_expr, ctx)
            return results[0] if results else None
        elif op == "+=":
            if isinstance(current, (int, float)) and isinstance(new_val, (int, float)):
                return current + new_val
            if isinstance(current, str) and isinstance(new_val, str):
                return current + new_val
            if isinstance(current, list) and isinstance(new_val, list):
                return current + new_val
            if isinstance(current, dict) and isinstance(new_val, dict):
                return {**current, **new_val}
            return new_val
        elif op == "-=":
            if isinstance(current, (int, float)) and isinstance(new_val, (int, float)):
                return current - new_val
            return current
        elif op == "*=":
            if isinstance(current, (int, float)) and isinstance(new_val, (int, float)):
                return current * new_val
            return current
        elif op == "/=":
            if isinstance(current, (int, float)) and isinstance(new_val, (int, float)):
                return current / new_val if new_val != 0 else current
            return current
        elif op == "%=":
            if isinstance(current, (int, float)) and isinstance(new_val, (int, float)):
                return current % new_val if new_val != 0 else current
            return current
        elif op == "//=":
            return current if current is not None and current is not False else new_val
        return new_val

    def update_recursive(val: Any, path: AstNode, transform) -> Any:
        if path.type == "Identity":
            return transform(val)
        elif path.type == "Field":
            field_node = path  # type: FieldNode
            if field_node.base:
                return update_recursive(
                    val,
                    field_node.base,
                    lambda base_val: (
                        {**base_val, field_node.name: transform(base_val.get(field_node.name))}
                        if isinstance(base_val, dict)
                        else base_val
                    ),
                )
            if isinstance(val, dict):
                return {**val, field_node.name: transform(val.get(field_node.name))}
            return val
        elif path.type == "Index":
            index_node = path  # type: IndexNode
            indices = _eval_node(root, index_node.index, ctx)
            idx = indices[0] if indices else None

            if index_node.base:
                return update_recursive(
                    val,
                    index_node.base,
                    lambda base_val: (_update_at_index(base_val, idx, transform)),
                )
            return _update_at_index(val, idx, transform)
        elif path.type == "Iterate":
            iter_node = path  # type: IterateNode
            apply_to_container = lambda container: (
                [transform(item) for item in container]
                if isinstance(container, list)
                else {k: transform(v) for k, v in container.items()}
                if isinstance(container, dict)
                else container
            )
            if iter_node.base:
                return update_recursive(val, iter_node.base, apply_to_container)
            return apply_to_container(val)
        elif path.type == "Pipe":
            pipe_node = path  # type: PipeNode
            left_result = update_recursive(val, pipe_node.left, lambda x: x)
            return update_recursive(left_result, pipe_node.right, transform)
        else:
            return transform(val)

    def transformer(current: Any) -> Any:
        if op == "|=":
            return compute_new_value(current, current)
        new_vals = _eval_node(root, value_expr, ctx)
        return compute_new_value(current, new_vals[0] if new_vals else None)

    return update_recursive(root, path_expr, transformer)


def _update_at_index(val: Any, idx: Any, transform) -> Any:
    """Update a value at an index."""
    if isinstance(idx, int) and isinstance(val, list):
        arr = list(val)
        i = idx if idx >= 0 else len(arr) + idx
        if 0 <= i < len(arr):
            arr[i] = transform(arr[i])
        return arr
    if isinstance(idx, str) and isinstance(val, dict):
        return {**val, idx: transform(val.get(idx))}
    return val
