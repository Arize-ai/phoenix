"""Builtin functions for the query engine.

This module provides all the builtin functions available in jq expressions.
"""

import base64
import json
import math
import re
from collections.abc import Callable
from typing import Any
from urllib.parse import quote as uri_quote

from ..types import AstNode, EvalContext, JqError

# Type for the evaluate function passed from evaluator
EvalFunc = Callable[[Any, AstNode, EvalContext], list[Any]]


def call_builtin(
    value: Any,
    name: str,
    args: list[AstNode],
    ctx: EvalContext,
    eval_fn: EvalFunc,
) -> list[Any]:
    """Call a builtin function.

    Args:
        value: The current input value
        name: The function name
        args: The function arguments (as AST nodes)
        ctx: The evaluation context
        eval_fn: Function to evaluate AST nodes

    Returns:
        A list of result values

    Raises:
        ValueError: If the function is unknown
    """
    # Core functions
    if name == "keys":
        if isinstance(value, list):
            return [list(range(len(value)))]
        if isinstance(value, dict):
            return [sorted(value.keys())]
        return [None]

    if name == "keys_unsorted":
        if isinstance(value, list):
            return [list(range(len(value)))]
        if isinstance(value, dict):
            return [list(value.keys())]
        return [None]

    if name == "values":
        if isinstance(value, list):
            return [value]
        if isinstance(value, dict):
            return [list(value.values())]
        return [None]

    if name == "length":
        if isinstance(value, str):
            return [len(value)]
        if isinstance(value, (list, dict)):
            return [len(value)]
        if value is None:
            return [0]
        return [None]

    if name == "utf8bytelength":
        if isinstance(value, str):
            return [len(value.encode("utf-8"))]
        type_name = _jq_type_for_error(value)
        short_val = json.dumps(value) if not isinstance(value, (dict, list)) else (
            "[]" if isinstance(value, list) and not value else
            "{}" if isinstance(value, dict) and not value else
            json.dumps(value)[:20]
        )
        raise ValueError(f"{type_name} ({short_val}) only strings have UTF-8 byte length")

    if name == "type":
        if value is None:
            return ["null"]
        if isinstance(value, bool):
            return ["boolean"]
        if isinstance(value, (int, float)):
            return ["number"]
        if isinstance(value, str):
            return ["string"]
        if isinstance(value, list):
            return ["array"]
        if isinstance(value, dict):
            return ["object"]
        return ["null"]

    if name == "empty":
        return []

    if name == "error":
        msg = eval_fn(value, args[0], ctx)[0] if args else value
        raise JqError(msg)

    if name == "not":
        return [not _is_truthy(value)]

    if name == "null":
        return [None]

    if name == "true":
        return [True]

    if name == "false":
        return [False]

    if name == "first":
        if args:
            try:
                results = eval_fn(value, args[0], ctx)
            except (JqError, ValueError):
                results = []
            return [results[0]] if results else []
        if isinstance(value, list) and value:
            return [value[0]]
        return [None]

    if name == "last":
        if args:
            try:
                results = eval_fn(value, args[0], ctx)
            except (JqError, ValueError):
                results = []
            return [results[-1]] if results else []
        if isinstance(value, list) and value:
            return [value[-1]]
        return [None]

    if name == "nth":
        if not args:
            return [None]
        ns = eval_fn(value, args[0], ctx)
        if len(args) > 1:
            try:
                gen_results = eval_fn(value, args[1], ctx)
            except (JqError, ValueError):
                gen_results = []
            results = []
            for n in ns:
                if isinstance(n, int):
                    if n < 0:
                        raise JqError("nth doesn't support negative indices")
                    if 0 <= n < len(gen_results):
                        results.append(gen_results[n])
            return results
        n = ns[0] if ns else 0
        if isinstance(value, list):
            return [value[n]] if isinstance(n, int) and 0 <= n < len(value) else [None]
        return [None]

    if name == "range":
        if not args:
            return []
        starts = eval_fn(value, args[0], ctx)
        if len(args) == 1:
            # range(n) — for each n, generate 0..n-1
            results = []
            for n in starts:
                ni = int(n) if isinstance(n, (int, float)) else 0
                if ni > 0:
                    results.extend(range(ni))
            return results
        ends = eval_fn(value, args[1], ctx)
        if len(args) == 2:
            # range(start; end) — generate for each combination
            results = []
            for s in starts:
                for e in ends:
                    si = int(s) if isinstance(s, (int, float)) else 0
                    ei = int(e) if isinstance(e, (int, float)) else 0
                    results.extend(range(si, ei))
            return results
        # range(start; end; step)
        steps = eval_fn(value, args[2], ctx)
        results = []
        for s in starts:
            for e in ends:
                for st in steps:
                    si = int(s) if isinstance(s, (int, float)) else 0
                    ei = int(e) if isinstance(e, (int, float)) else 0
                    sti = int(st) if isinstance(st, (int, float)) else 0
                    if sti == 0:
                        continue
                    results.extend(range(si, ei, sti))
        return results

    if name == "reverse":
        if isinstance(value, list):
            return [list(reversed(value))]
        if isinstance(value, str):
            return [value[::-1]]
        return [None]

    if name == "sort":
        if isinstance(value, list):
            return [sorted(value, key=_jq_sort_key)]
        return [None]

    if name == "sort_by":
        if not isinstance(value, list) or not args:
            return [None]
        items = [(eval_fn(item, args[0], ctx), item) for item in value]
        sorted_items = sorted(items, key=lambda x: _jq_sort_key(x[0][0] if x[0] else None))
        return [[item for _, item in sorted_items]]

    if name == "unique":
        if isinstance(value, list):
            seen = set()
            result = []
            for item in value:
                key = json.dumps(item, sort_keys=True)
                if key not in seen:
                    seen.add(key)
                    result.append(item)
            return [result]
        return [None]

    if name == "unique_by":
        if not isinstance(value, list) or not args:
            return [None]
        seen = set()
        result = []
        for item in value:
            key_vals = eval_fn(item, args[0], ctx)
            key = json.dumps(key_vals[0] if key_vals else None, sort_keys=True)
            if key not in seen:
                seen.add(key)
                result.append(item)
        return [result]

    if name == "group_by":
        if not isinstance(value, list) or not args:
            return [None]
        groups: dict[str, list[Any]] = {}
        for item in value:
            key_vals = eval_fn(item, args[0], ctx)
            key = json.dumps(key_vals[0] if key_vals else None, sort_keys=True)
            if key not in groups:
                groups[key] = []
            groups[key].append(item)
        return [list(groups.values())]

    if name == "max":
        if isinstance(value, list) and value:
            return [max(value, key=_jq_sort_key)]
        return [None]

    if name == "max_by":
        if not isinstance(value, list) or not value or not args:
            return [None]
        items = [(eval_fn(item, args[0], ctx), item) for item in value]
        max_item = max(items, key=lambda x: _jq_sort_key(x[0][0] if x[0] else None))
        return [max_item[1]]

    if name == "min":
        if isinstance(value, list) and value:
            return [min(value, key=_jq_sort_key)]
        return [None]

    if name == "min_by":
        if not isinstance(value, list) or not value or not args:
            return [None]
        items = [(eval_fn(item, args[0], ctx), item) for item in value]
        min_item = min(items, key=lambda x: _jq_sort_key(x[0][0] if x[0] else None))
        return [min_item[1]]

    if name == "flatten":
        if not isinstance(value, list):
            return [None]
        if args:
            depth_vals = eval_fn(value, args[0], ctx)
            results = []
            for d in depth_vals:
                depth = d if isinstance(d, (int, float)) else float("inf")
                results.append(_flatten(value, int(depth) if depth != float("inf") else None))
            return results
        return [_flatten(value, None)]

    if name == "add":
        if args:
            # add(filter) - collect filter results and add them
            results = eval_fn(value, args[0], ctx)
            if not results:
                return [None]
            return _jq_add(results)
        if isinstance(value, list):
            if not value:
                return [None]
            return _jq_add(value)
        return [None]

    if name == "any":
        if args:
            if isinstance(value, list):
                return [
                    any(
                        _is_truthy(eval_fn(item, args[0], ctx)[0])
                        for item in value
                        if eval_fn(item, args[0], ctx)
                    )
                ]
            return [False]
        if isinstance(value, list):
            return [any(_is_truthy(x) for x in value)]
        return [False]

    if name == "all":
        if args:
            if isinstance(value, list):
                return [
                    all(
                        _is_truthy(eval_fn(item, args[0], ctx)[0])
                        for item in value
                        if eval_fn(item, args[0], ctx)
                    )
                ]
            return [True]
        if isinstance(value, list):
            return [all(_is_truthy(x) for x in value)]
        return [True]

    if name == "select":
        if not args:
            return [value]
        conds = eval_fn(value, args[0], ctx)
        return [value] if any(_is_truthy(c) for c in conds) else []

    if name == "map":
        if not args or not isinstance(value, list):
            return [None]
        results = []
        for item in value:
            results.extend(eval_fn(item, args[0], ctx))
        return [results]

    if name == "map_values":
        if not args:
            return [None]
        if isinstance(value, list):
            results = []
            for item in value:
                item_results = eval_fn(item, args[0], ctx)
                results.extend(item_results)
            return [results]
        if isinstance(value, dict):
            result = {}
            for k, v in value.items():
                mapped = eval_fn(v, args[0], ctx)
                if mapped:
                    result[k] = mapped[0]
            return [result]
        return [None]

    if name == "has":
        if not args:
            return [False]
        keys = eval_fn(value, args[0], ctx)
        key = keys[0] if keys else None
        if isinstance(value, list) and isinstance(key, int):
            return [0 <= key < len(value)]
        if isinstance(value, dict) and isinstance(key, str):
            return [key in value]
        return [False]

    if name == "in":
        if not args:
            return [False]
        objs = eval_fn(value, args[0], ctx)
        obj = objs[0] if objs else None
        if isinstance(obj, list) and isinstance(value, int):
            return [0 <= value < len(obj)]
        if isinstance(obj, dict) and isinstance(value, str):
            return [value in obj]
        return [False]

    if name == "contains":
        if not args:
            return [False]
        others = eval_fn(value, args[0], ctx)
        other = others[0] if others else None
        return [_contains_deep(value, other)]

    if name == "inside":
        if not args:
            return [False]
        others = eval_fn(value, args[0], ctx)
        other = others[0] if others else None
        return [_contains_deep(other, value)]

    if name == "getpath":
        if not args:
            return [None]
        paths = eval_fn(value, args[0], ctx)
        results = []
        for path in paths:
            if not isinstance(path, list):
                results.append(None)
                continue
            current = value
            for key in path:
                if current is None:
                    current = None
                    break
                if isinstance(current, list) and isinstance(key, int):
                    current = current[key] if 0 <= key < len(current) else None
                elif isinstance(current, dict) and isinstance(key, str):
                    current = current.get(key)
                else:
                    current = None
                    break
            results.append(current)
        return results

    if name == "setpath":
        if len(args) < 2:
            return [None]
        paths = eval_fn(value, args[0], ctx)
        path = paths[0] if paths else []
        vals = eval_fn(value, args[1], ctx)
        new_val = vals[0] if vals else None
        return [_set_path(value, path, new_val)]

    if name == "delpaths":
        if not args:
            return [value]
        path_lists = eval_fn(value, args[0], ctx)
        paths = path_lists[0] if path_lists else []
        result = value
        # Delete longest paths first to avoid index shifting issues
        for path in sorted(paths, key=len, reverse=True):
            result = _delete_path(result, path)
        return [result]

    if name == "path":
        if not args:
            return [[]]
        # Compute paths that the expression navigates to
        paths = _compute_paths(value, args[0], ctx, eval_fn)
        return paths

    if name == "del":
        if not args:
            return [value]
        # Compute all paths to delete, then delete from longest first
        paths = _compute_paths(value, args[0], ctx, eval_fn)
        if not paths:
            return [_apply_del(value, args[0], ctx, eval_fn)]
        result = value
        # Delete by paths, longest first to avoid shifting
        for path in sorted(paths, key=len, reverse=True):
            result = _delete_path(result, path)
        return [result]

    if name == "paths":
        paths = _get_all_paths(value, [])
        if args:
            # Filter paths by predicate
            filtered = []
            for p in paths:
                v = _get_value_at_path(value, p)
                results = eval_fn(v, args[0], ctx)
                if any(_is_truthy(r) for r in results):
                    filtered.append(p)
            return filtered
        return paths

    if name == "leaf_paths":
        return [_get_leaf_paths(value, [])]

    if name == "to_entries":
        if isinstance(value, dict):
            return [[{"key": k, "value": v} for k, v in value.items()]]
        return [None]

    if name == "from_entries":
        if isinstance(value, list):
            result = {}
            for item in value:
                if isinstance(item, dict):
                    key = item.get("key") or item.get("name") or item.get("k")
                    val = item.get("value") if "value" in item else item.get("v")
                    if key is not None:
                        result[str(key)] = val
            return [result]
        return [None]

    if name == "with_entries":
        if not args:
            return [value]
        if isinstance(value, dict):
            entries = [{"key": k, "value": v} for k, v in value.items()]
            new_entries = []
            for entry in entries:
                results = eval_fn(entry, args[0], ctx)
                new_entries.extend(results)
            result = {}
            for item in new_entries:
                if isinstance(item, dict):
                    key = item.get("key") or item.get("name") or item.get("k")
                    val = item.get("value") if "value" in item else item.get("v")
                    if key is not None:
                        result[str(key)] = val
            return [result]
        return [None]

    # String functions
    if name == "join":
        if not isinstance(value, list):
            return [None]
        seps = eval_fn(value, args[0], ctx) if args else [""]
        results = []
        for sep in seps:
            s = str(sep) if sep is not None else ""
            parts = []
            for v in value:
                if v is None:
                    parts.append("")
                elif isinstance(v, str):
                    parts.append(v)
                else:
                    parts.append(json.dumps(v))
            results.append(s.join(parts))
        return results

    if name == "split":
        if not isinstance(value, str) or not args:
            return [None]
        seps = eval_fn(value, args[0], ctx)
        sep = seps[0] if seps else ""
        if isinstance(sep, str):
            if sep == "":
                return [list(value)]
            # With 2 args, second is flags for regex split
            if len(args) > 1:
                flags_val = eval_fn(value, args[1], ctx)
                flags = flags_val[0] if flags_val else ""
                re_flags = _get_re_flags(str(flags) if flags else "")
                return [re.split(sep, value, flags=re_flags)]
            return [value.split(sep)]
        return [None]

    if name == "test":
        if not isinstance(value, str) or not args:
            return [False]
        patterns = eval_fn(value, args[0], ctx)
        pattern = str(patterns[0]) if patterns else ""
        try:
            flags = eval_fn(value, args[1], ctx)[0] if len(args) > 1 else ""
            re_flags = _get_re_flags(flags)
            return [bool(re.search(pattern, value, re_flags))]
        except re.error:
            return [False]

    if name == "match":
        if not isinstance(value, str) or not args:
            return [None]
        pattern, flags_str = _extract_pattern_flags(value, args, ctx, eval_fn)
        try:
            re_flags = _get_re_flags(flags_str)
            is_global = "g" in flags_str
            if is_global:
                matches = list(re.finditer(pattern, value, re_flags))
                if not matches:
                    return []
                return [_match_to_dict(m, pattern) for m in matches]
            m = re.search(pattern, value, re_flags)
            if not m:
                return [None]
            return [_match_to_dict(m, pattern)]
        except re.error:
            return [None]

    if name == "capture":
        if not isinstance(value, str) or not args:
            return [None]
        pattern, flags_str = _extract_pattern_flags(value, args, ctx, eval_fn)
        try:
            re_flags = _get_re_flags(flags_str)
            m = re.search(pattern, value, re_flags)
            if not m:
                return [None]
            # Return dict of named groups (None for unmatched optional groups)
            result = {}
            for gname, gval in m.groupdict().items():
                result[gname] = gval
            return [result] if result else [None]
        except re.error:
            return [None]

    if name == "scan":
        if not isinstance(value, str) or not args:
            return [None]
        pattern, flags_str = _extract_pattern_flags(value, args, ctx, eval_fn)
        try:
            re_flags = _get_re_flags(flags_str)
            results = []
            for m in re.finditer(pattern, value, re_flags):
                if m.lastindex and m.lastindex > 0:
                    # Has capture groups - return as array
                    results.append(list(m.groups()))
                else:
                    results.append(m.group())
            return results
        except re.error:
            return []

    if name == "splits":
        if not isinstance(value, str) or not args:
            return [None]
        pattern, flags_str = _extract_pattern_flags(value, args, ctx, eval_fn)
        try:
            re_flags = _get_re_flags(flags_str)
            return re.split(pattern, value, flags=re_flags)
        except re.error:
            return [value]

    if name == "sub":
        if not isinstance(value, str) or len(args) < 2:
            return [None]
        pattern, flags_str = _extract_pattern_flags(value, [args[0]] + args[2:], ctx, eval_fn)
        try:
            re_flags = _get_re_flags(flags_str)
            is_global = "g" in flags_str
            # The replacement is a jq expression, evaluated with match as input
            m = re.search(pattern, value, re_flags)
            if not m:
                return [value]
            match_dict = _match_to_dict(m, pattern)
            replacements = eval_fn(match_dict, args[1], ctx)
            results = []
            for repl in replacements:
                replacement = str(repl) if repl is not None else ""
                if is_global:
                    results.append(re.sub(pattern, replacement, value, flags=re_flags))
                else:
                    results.append(re.sub(pattern, replacement, value, count=1, flags=re_flags))
            return results
        except re.error:
            return [value]

    if name == "gsub":
        if not isinstance(value, str) or len(args) < 2:
            return [None]
        pattern, flags_str = _extract_pattern_flags(value, [args[0]] + args[2:], ctx, eval_fn)
        try:
            re_flags = _get_re_flags(flags_str)
            # Evaluate replacement for each match
            matches = list(re.finditer(pattern, value, re_flags))
            if not matches:
                return [value]
            # Build replacement by evaluating the replacement expr for each match
            result = value
            offset_adjust = 0
            replacements_expr = args[1]
            all_repls = []
            for m in matches:
                match_dict = _match_to_dict(m, pattern)
                repls = eval_fn(match_dict, replacements_expr, ctx)
                all_repls.extend(repls)

            if len(all_repls) <= 1:
                # Simple case: one replacement for all matches
                repl = str(all_repls[0]) if all_repls else ""
                return [re.sub(pattern, repl, value, flags=re_flags)]
            else:
                # Multiple outputs from replacement - return multiple results
                results = []
                for repl in all_repls:
                    results.append(re.sub(pattern, str(repl) if repl is not None else "", value, flags=re_flags))
                return results
        except re.error:
            return [value]

    if name == "ascii_downcase":
        if isinstance(value, str):
            return [value.lower()]
        return [None]

    if name == "ascii_upcase":
        if isinstance(value, str):
            return [value.upper()]
        return [None]

    if name == "ltrimstr":
        if not isinstance(value, str) or not args:
            return [value]
        prefixes = eval_fn(value, args[0], ctx)
        prefix = str(prefixes[0]) if prefixes else ""
        return [value[len(prefix) :] if value.startswith(prefix) else value]

    if name == "rtrimstr":
        if not isinstance(value, str) or not args:
            return [value]
        suffixes = eval_fn(value, args[0], ctx)
        suffix = str(suffixes[0]) if suffixes else ""
        return [value[: -len(suffix)] if value.endswith(suffix) and suffix else value]

    if name == "trim":
        if isinstance(value, str):
            return [value.strip()]
        return [value]

    if name == "startswith":
        if not isinstance(value, str) or not args:
            return [False]
        prefixes = eval_fn(value, args[0], ctx)
        prefix = str(prefixes[0]) if prefixes else ""
        return [value.startswith(prefix)]

    if name == "endswith":
        if not isinstance(value, str) or not args:
            return [False]
        suffixes = eval_fn(value, args[0], ctx)
        suffix = str(suffixes[0]) if suffixes else ""
        return [value.endswith(suffix)]

    if name == "index":
        if not args:
            return [None]
        needles = eval_fn(value, args[0], ctx)
        results = []
        for needle in needles:
            if isinstance(value, str) and isinstance(needle, str):
                if needle == "":
                    results.append(None)
                else:
                    idx = value.find(needle)
                    results.append(idx if idx >= 0 else None)
            elif isinstance(value, list):
                found = None
                for i, item in enumerate(value):
                    if _deep_equal(item, needle):
                        found = i
                        break
                results.append(found)
            else:
                results.append(None)
        return results

    if name == "rindex":
        if not args:
            return [None]
        needles = eval_fn(value, args[0], ctx)
        results = []
        for needle in needles:
            if isinstance(value, str) and isinstance(needle, str):
                idx = value.rfind(needle)
                results.append(idx if idx >= 0 else None)
            elif isinstance(value, list):
                found = None
                for i in range(len(value) - 1, -1, -1):
                    if _deep_equal(value[i], needle):
                        found = i
                        break
                results.append(found)
            else:
                results.append(None)
        return results

    if name == "indices":
        if not args:
            return [[]]
        needles = eval_fn(value, args[0], ctx)
        results = []
        for needle in needles:
            result = []
            if isinstance(value, str) and isinstance(needle, str):
                idx = value.find(needle)
                while idx != -1:
                    result.append(idx)
                    idx = value.find(needle, idx + 1)
            elif isinstance(value, list) and isinstance(needle, list):
                # Find subsequence positions
                nlen = len(needle)
                for i in range(len(value) - nlen + 1):
                    if all(_deep_equal(value[i + j], needle[j]) for j in range(nlen)):
                        result.append(i)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if _deep_equal(item, needle):
                        result.append(i)
            results.append(result)
        return results if len(results) != 1 else results

    # Math functions
    if name == "floor":
        if isinstance(value, (int, float)):
            return [math.floor(value)]
        return [None]

    if name == "ceil":
        if isinstance(value, (int, float)):
            return [math.ceil(value)]
        return [None]

    if name == "round":
        if isinstance(value, (int, float)):
            return [round(value)]
        return [None]

    if name == "sqrt":
        if isinstance(value, (int, float)):
            result = math.sqrt(value)
            if result == int(result):
                return [int(result)]
            return [result]
        return [None]

    if name in ("fabs", "abs"):
        if isinstance(value, (int, float)):
            return [abs(value)]
        return [None]

    if name == "log":
        if isinstance(value, (int, float)):
            return [math.log(value)]
        return [None]

    if name == "log10":
        if isinstance(value, (int, float)):
            return [math.log10(value)]
        return [None]

    if name == "log2":
        if isinstance(value, (int, float)):
            return [math.log2(value)]
        return [None]

    if name == "exp":
        if isinstance(value, (int, float)):
            return [math.exp(value)]
        return [None]

    if name == "exp10":
        if isinstance(value, (int, float)):
            return [10**value]
        return [None]

    if name == "exp2":
        if isinstance(value, (int, float)):
            return [2**value]
        return [None]

    if name == "pow":
        if not isinstance(value, (int, float)) or not args:
            return [None]
        exps = eval_fn(value, args[0], ctx)
        exp = exps[0] if exps else 1
        return [value**exp]

    if name == "sin":
        if isinstance(value, (int, float)):
            return [math.sin(value)]
        return [None]

    if name == "cos":
        if isinstance(value, (int, float)):
            return [math.cos(value)]
        return [None]

    if name == "tan":
        if isinstance(value, (int, float)):
            return [math.tan(value)]
        return [None]

    if name == "asin":
        if isinstance(value, (int, float)):
            return [math.asin(value)]
        return [None]

    if name == "acos":
        if isinstance(value, (int, float)):
            return [math.acos(value)]
        return [None]

    if name == "atan":
        if isinstance(value, (int, float)):
            return [math.atan(value)]
        return [None]

    if name == "tostring":
        if isinstance(value, str):
            return [value]
        return [json.dumps(value)]

    if name == "tonumber":
        if isinstance(value, (int, float)):
            return [value]
        if isinstance(value, str):
            try:
                return [float(value) if "." in value else int(value)]
            except ValueError:
                return [None]
        return [None]

    if name == "infinite":
        return [not math.isfinite(value) if isinstance(value, (int, float)) else False]

    if name == "nan":
        return [math.isnan(value) if isinstance(value, (int, float)) else False]

    if name == "isnan":
        return [isinstance(value, (int, float)) and math.isnan(value)]

    if name == "isinfinite":
        return [isinstance(value, (int, float)) and not math.isfinite(value)]

    if name == "isfinite":
        return [isinstance(value, (int, float)) and math.isfinite(value)]

    if name == "isnormal":
        return [isinstance(value, (int, float)) and math.isfinite(value) and value != 0]

    # Type filters
    if name == "numbers":
        # In Python, bool is a subclass of int, so we need to exclude bools
        return [value] if isinstance(value, (int, float)) and not isinstance(value, bool) else []

    if name == "strings":
        return [value] if isinstance(value, str) else []

    if name == "booleans":
        return [value] if isinstance(value, bool) else []

    if name == "nulls":
        return [value] if value is None else []

    if name == "arrays":
        return [value] if isinstance(value, list) else []

    if name == "objects":
        return [value] if isinstance(value, dict) else []

    if name == "iterables":
        return [value] if isinstance(value, (list, dict)) else []

    if name == "scalars":
        return [value] if not isinstance(value, (list, dict)) else []

    if name == "now":
        import time

        return [time.time()]

    if name == "env":
        return [ctx.env]

    if name == "recurse":
        if not args:
            results = []
            _walk_recurse(value, results)
            return results
        results = []
        seen = set()

        def walk(v: Any) -> None:
            key = json.dumps(v, sort_keys=True) if isinstance(v, (dict, list)) else str(v)
            if key in seen:
                return
            seen.add(key)
            results.append(v)
            nexts = eval_fn(v, args[0], ctx)
            for n in nexts:
                if n is not None:
                    walk(n)

        walk(value)
        return results

    if name == "recurse_down":
        return call_builtin(value, "recurse", args, ctx, eval_fn)

    if name == "walk":
        if not args:
            return [value]
        seen: set[int] = set()

        def walk_fn(v: Any) -> Any:
            if isinstance(v, (dict, list)):
                obj_id = id(v)
                if obj_id in seen:
                    return v
                seen.add(obj_id)

            if isinstance(v, list):
                transformed = [walk_fn(item) for item in v]
            elif isinstance(v, dict):
                transformed = {k: walk_fn(val) for k, val in v.items()}
            else:
                transformed = v

            results = eval_fn(transformed, args[0], ctx)
            return results[0] if results else transformed

        return [walk_fn(value)]

    if name == "transpose":
        if not isinstance(value, list):
            return [None]
        if not value:
            return [[]]
        max_len = max((len(row) if isinstance(row, list) else 0) for row in value)
        result = []
        for i in range(max_len):
            row = [r[i] if isinstance(r, list) and i < len(r) else None for r in value]
            result.append(row)
        return [result]

    if name == "ascii":
        if isinstance(value, str) and value:
            return [ord(value[0])]
        return [None]

    if name == "explode":
        if isinstance(value, str):
            return [[ord(c) for c in value]]
        return [None]

    if name == "implode":
        if isinstance(value, list):
            try:
                return ["".join(chr(c) for c in value)]
            except (TypeError, ValueError):
                return [None]
        return [None]

    if name in ("tojson", "tojsonstream"):
        return [json.dumps(value)]

    if name == "fromjson":
        if isinstance(value, str):
            try:
                return [json.loads(value)]
            except json.JSONDecodeError:
                return [None]
        return [None]

    if name == "limit":
        if len(args) < 2:
            return []
        ns = eval_fn(value, args[0], ctx)
        results = []
        for n in ns:
            ni = int(n) if isinstance(n, (int, float)) else 0
            if ni < 0:
                raise JqError("limit doesn't support negative count")
            if ni == 0:
                continue
            try:
                stream = eval_fn(value, args[1], ctx)
            except (JqError, ValueError):
                stream = []
            results.extend(stream[:ni])
        return results

    if name == "until":
        if len(args) < 2:
            return [value]
        current = value
        max_iterations = ctx.limits.max_iterations
        for _ in range(max_iterations):
            conds = eval_fn(current, args[0], ctx)
            if any(_is_truthy(c) for c in conds):
                return [current]
            nexts = eval_fn(current, args[1], ctx)
            if not nexts:
                return [current]
            current = nexts[0]
        raise ValueError(f"jq until: too many iterations ({max_iterations})")

    if name == "while":
        if len(args) < 2:
            return [value]
        results = []
        current = value
        max_iterations = ctx.limits.max_iterations
        for _ in range(max_iterations):
            conds = eval_fn(current, args[0], ctx)
            if not any(_is_truthy(c) for c in conds):
                break
            results.append(current)
            nexts = eval_fn(current, args[1], ctx)
            if not nexts:
                break
            current = nexts[0]
        return results

    if name == "repeat":
        if not args:
            return [value]
        results = []
        current = value
        max_iterations = ctx.limits.max_iterations
        for _ in range(max_iterations):
            results.append(current)
            nexts = eval_fn(current, args[0], ctx)
            if not nexts:
                break
            current = nexts[0]
        return results

    if name == "debug":
        return [value]

    if name == "input_line_number":
        return [1]

    # Format strings
    if name == "@base64":
        if isinstance(value, str):
            return [base64.b64encode(value.encode("utf-8")).decode("utf-8")]
        return [None]

    if name == "@base64d":
        if isinstance(value, str):
            # Check for trailing bytes issue first
            stripped = value.rstrip("=")
            if len(stripped) % 4 == 1:
                raise JqError(f"string ({json.dumps(value)}) trailing base64 byte found")
            try:
                # Add padding if needed
                padded = value + "=" * (4 - len(value) % 4) if len(value) % 4 else value
                return [base64.b64decode(padded).decode("utf-8")]
            except Exception:
                # Truncate long values in error message (jq truncates without closing quote)
                if len(value) > 10:
                    display = f'"{value[:10]}...'
                else:
                    display = json.dumps(value)
                raise JqError(f"string ({display}) is not valid base64 data")
        return [None]

    if name == "@uri":
        if isinstance(value, str):
            return [uri_quote(value, safe="")]
        return [None]

    if name == "@csv":
        if not isinstance(value, list):
            return [None]
        escaped = []
        for v in value:
            s = str(v) if v is not None else ""
            if "," in s or '"' in s or "\n" in s:
                escaped.append(f'"{s.replace(chr(34), chr(34) + chr(34))}"')
            else:
                escaped.append(s)
        return [",".join(escaped)]

    if name == "@tsv":
        if not isinstance(value, list):
            return [None]
        escaped = []
        for v in value:
            s = str(v) if v is not None else ""
            escaped.append(s.replace("\t", "\\t").replace("\n", "\\n"))
        return ["\t".join(escaped)]

    if name == "@json":
        return [json.dumps(value)]

    if name == "@html":
        if isinstance(value, str):
            return [
                value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#39;")
            ]
        return [None]

    if name == "@sh":
        if isinstance(value, str):
            return [f"'{value.replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'"]
        return [None]

    if name == "@text":
        if isinstance(value, str):
            return [value]
        if value is None:
            return [""]
        return [str(value)]

    # Navigation operators
    if name == "parent":
        if ctx.root is None or not ctx.current_path:
            return []
        path = ctx.current_path
        if not path:
            return []
        levels = 1
        if args:
            levels_vals = eval_fn(value, args[0], ctx)
            levels = levels_vals[0] if levels_vals else 1

        if levels >= 0:
            if levels > len(path):
                return []
            parent_path = path[: len(path) - levels]
        else:
            target_len = -levels - 1
            if target_len >= len(path):
                return [value]
            parent_path = path[:target_len]
        return [_get_value_at_path(ctx.root, parent_path)]

    if name == "parents":
        if ctx.root is None or not ctx.current_path:
            return [[]]
        path = ctx.current_path
        parents = []
        for i in range(len(path) - 1, -1, -1):
            parents.append(_get_value_at_path(ctx.root, path[:i]))
        return [parents]

    if name == "root":
        return [ctx.root] if ctx.root is not None else []

    if name == "isempty":
        if not args:
            return [value is None or (isinstance(value, (list, dict, str)) and len(value) == 0)]
        try:
            results = eval_fn(value, args[0], ctx)
            return [len(results) == 0]
        except Exception:
            return [True]

    if name == "IN":
        if len(args) == 1:
            # IN(stream) — check if . is in the stream
            try:
                stream = eval_fn(value, args[0], ctx)
                return [value in stream]
            except Exception:
                return [False]
        if len(args) == 2:
            # IN(expr; stream) — check if each result of expr is in stream
            vals = eval_fn(value, args[0], ctx)
            stream = eval_fn(value, args[1], ctx)
            return [v in stream for v in vals]
        return [False]

    if name == "bsearch":
        if not args or not isinstance(value, list):
            return [None]
        targets = eval_fn(value, args[0], ctx)
        target = targets[0] if targets else None
        # Binary search on sorted array
        lo, hi = 0, len(value) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if value[mid] == target:
                return [mid]
            elif _jq_sort_key(value[mid]) < _jq_sort_key(target):
                lo = mid + 1
            else:
                hi = mid - 1
        return [-(lo + 1)]

    if name == "combinations":
        if not isinstance(value, list):
            return [None]
        if args:
            # combinations(n) — n-ary combinations of value
            ns = eval_fn(value, args[0], ctx)
            n = int(ns[0]) if ns else 2
            import itertools
            return list(list(combo) for combo in itertools.product(value, repeat=n))
        # combinations — treat value as array of arrays, return cartesian product
        if all(isinstance(x, list) for x in value):
            import itertools
            return [list(combo) for combo in itertools.product(*value)]
        return [value]

    if name == "builtins":
        # Return list of builtin function names
        builtin_names = [
            "add", "all", "any", "arrays", "ascii", "ascii_downcase", "ascii_upcase",
            "booleans", "bsearch", "builtins", "capture", "ceil", "combinations",
            "contains", "debug", "del", "delpaths", "empty", "endswith", "env",
            "error", "exp", "exp10", "exp2", "explode", "false", "first",
            "flatten", "floor", "from_entries", "fromjson", "getpath", "group_by",
            "gsub", "has", "if", "implode", "in", "IN", "indices", "infinite",
            "input_line_number", "inside", "isempty", "isfinite", "isinfinite",
            "isnan", "isnormal", "iterables", "join", "keys", "keys_unsorted",
            "last", "leaf_paths", "length", "limit", "log", "log10", "log2",
            "ltrimstr", "map", "map_values", "match", "max", "max_by", "min",
            "min_by", "nan", "not", "now", "nth", "null", "nulls", "numbers",
            "objects", "path", "paths", "pow", "range", "recurse", "repeat",
            "reverse", "round", "rtrimstr", "scalars", "select", "setpath",
            "sin", "sort", "sort_by", "split", "sqrt", "startswith",
            "strings", "sub", "test", "to_entries", "tostring", "tonumber",
            "transpose", "trim", "true", "type", "unique", "unique_by",
            "until", "utf8bytelength", "values", "walk", "while",
            "with_entries",
        ]
        return [builtin_names]

    if name == "toboolean":
        if isinstance(value, bool):
            return [value]
        if isinstance(value, str):
            if value.lower() == "true":
                return [True]
            if value.lower() == "false":
                return [False]
            raise JqError(f"string ({json.dumps(value)}) cannot be parsed as a boolean")
        raise JqError(f"{_jq_type_for_error(value)} ({json.dumps(value)}) cannot be parsed as a boolean")

    if name == "pick":
        if not args:
            return [None]
        result = {}
        for arg in args:
            # Get paths for this expression, then set them in result
            paths = _get_paths_for_expr(value, arg, ctx, eval_fn)
            for p in paths:
                v = _get_value_at_path(value, p)
                result = _set_path(result, p, v)
        return [result]

    if name == "skip":
        if len(args) < 2:
            return []
        ns = eval_fn(value, args[0], ctx)
        gen = eval_fn(value, args[1], ctx)
        results = []
        for n in ns:
            ni = int(n) if isinstance(n, (int, float)) else 0
            if ni < 0:
                raise JqError("skip doesn't support negative count")
            results.extend(gen[ni:])
        return results

    if name == "trimstr":
        if not args:
            return [value]
        strs = eval_fn(value, args[0], ctx)
        s = strs[0] if strs else ""
        if isinstance(value, str) and isinstance(s, str):
            result = value
            if result.startswith(s):
                result = result[len(s):]
            if result.endswith(s):
                result = result[:-len(s)] if s else result
            return [result]
        return [value]

    if name in ("ltrim", "rtrim"):
        if isinstance(value, str):
            if name == "ltrim":
                return [value.lstrip()]
            return [value.rstrip()]
        return [value]

    if name in ("strftime", "strflocaltime"):
        import time
        if not args:
            return [None]
        fmts = eval_fn(value, args[0], ctx)
        fmt = fmts[0] if fmts else "%Y-%m-%dT%H:%M:%SZ"
        if isinstance(value, (int, float)):
            t = time.gmtime(value)
            return [time.strftime(fmt, t)]
        return [None]

    if name == "strptime":
        import time
        if not args:
            return [None]
        fmts = eval_fn(value, args[0], ctx)
        fmt = fmts[0] if fmts else "%Y-%m-%dT%H:%M:%SZ"
        if isinstance(value, str):
            try:
                t = time.strptime(value, fmt)
                # Return broken-down time as list like jq
                return [[t.tm_year, t.tm_mon - 1, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec, t.tm_wday, t.tm_yday - 1]]
            except ValueError:
                return [None]
        return [None]

    if name == "mktime":
        import calendar
        if isinstance(value, list) and len(value) >= 6:
            import time
            t = time.struct_time((value[0], value[1] + 1, value[2], value[3], value[4], value[5], 0, 0, 0))
            return [int(calendar.timegm(t))]
        return [None]

    if name == "gmtime":
        import time
        if isinstance(value, (int, float)):
            t = time.gmtime(value)
            return [[t.tm_year, t.tm_mon - 1, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec, t.tm_wday, t.tm_yday - 1]]
        return [None]

    if name == "fromdate":
        import time
        import calendar
        if isinstance(value, str):
            try:
                t = time.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
                return [int(calendar.timegm(t))]
            except ValueError:
                return [None]
        return [None]

    if name == "todate":
        import time
        if isinstance(value, (int, float)):
            t = time.gmtime(value)
            return [time.strftime("%Y-%m-%dT%H:%M:%SZ", t)]
        return [None]

    if name == "INDEX":
        if len(args) == 1:
            # INDEX(f) — create object indexed by f applied to each element
            if isinstance(value, list):
                result = {}
                for item in value:
                    keys = eval_fn(item, args[0], ctx)
                    key = keys[0] if keys else None
                    if key is not None:
                        result[str(key)] = item
                return [result]
            return [{}]
        if len(args) == 2:
            # INDEX(stream; f) — index stream by f
            stream = eval_fn(value, args[0], ctx)
            result = {}
            for item in stream:
                keys = eval_fn(item, args[1], ctx)
                key = keys[0] if keys else None
                if key is not None:
                    result[str(key)] = item
            return [result]
        return [{}]

    if name == "JOIN":
        if len(args) >= 2:
            idx = eval_fn(value, args[0], ctx)
            index_obj = idx[0] if idx else {}
            if isinstance(index_obj, dict):
                stream = eval_fn(value, args[1], ctx)
                result = {}
                for item in stream:
                    if isinstance(item, list) and len(item) >= 1:
                        key = str(item[0])
                        if key in index_obj:
                            result[key] = [index_obj[key], item]
                return [result]
        return [{}]

    if name == "@urid":
        from urllib.parse import unquote
        if isinstance(value, str):
            try:
                decoded = unquote(value, errors="strict")
                # Check for invalid UTF-8 sequences
                decoded.encode("utf-8")
                return [decoded]
            except (ValueError, UnicodeDecodeError, UnicodeEncodeError):
                raise JqError(f"string ({json.dumps(value)}) is not a valid uri encoding")
        return [value]

    raise ValueError(f"Unknown function: {name}")


def _jq_add(items: list[Any]) -> list[Any]:
    """Add a list of values together jq-style."""
    if not items:
        return [None]
    # Filter out None values for type detection
    non_null = [x for x in items if x is not None]
    if not non_null:
        return [None]
    if all(isinstance(x, (int, float)) for x in non_null):
        return [sum(non_null)]
    if all(isinstance(x, str) for x in non_null):
        return ["".join(non_null)]
    if all(isinstance(x, list) for x in non_null):
        result: list[Any] = []
        for x in non_null:
            result.extend(x)
        return [result]
    if all(isinstance(x, dict) for x in non_null):
        result_dict: dict[str, Any] = {}
        for x in non_null:
            result_dict.update(x)
        return [result_dict]
    # Mixed types - try numeric
    try:
        return [sum(x for x in non_null if isinstance(x, (int, float)))]
    except Exception:
        return [None]


def _is_truthy(v: Any) -> bool:
    """Check if a value is truthy in jq terms."""
    return v is not None and v is not False


def _deep_equal(a: Any, b: Any) -> bool:
    """Deep equality check."""
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def _jq_sort_key(v: Any) -> tuple[int, Any]:
    """Generate a sort key for jq-style sorting."""
    if v is None:
        return (0, 0)
    if isinstance(v, bool):
        return (1, int(v))
    if isinstance(v, (int, float)):
        return (2, v)
    if isinstance(v, str):
        return (3, v)
    if isinstance(v, list):
        return (4, json.dumps(v, sort_keys=True))
    if isinstance(v, dict):
        return (5, json.dumps(v, sort_keys=True))
    return (6, str(v))


def _flatten(lst: list[Any], depth: int | None) -> list[Any]:
    """Flatten a list to a given depth."""
    if depth == 0:
        return lst
    result = []
    for item in lst:
        if isinstance(item, list):
            new_depth = None if depth is None else depth - 1
            result.extend(_flatten(item, new_depth))
        else:
            result.append(item)
    return result


def _contains_deep(a: Any, b: Any) -> bool:
    """Check if a contains b (deep containment)."""
    if _deep_equal(a, b):
        return True
    if isinstance(a, list) and isinstance(b, list):
        return all(any(_contains_deep(a_item, b_item) for a_item in a) for b_item in b)
    if isinstance(a, dict) and isinstance(b, dict):
        return all(k in a and _contains_deep(a[k], v) for k, v in b.items())
    return False


def _set_path(value: Any, path: list[str | int], new_val: Any) -> Any:
    """Set a value at a path."""
    if not path:
        return new_val
    head, *rest = path
    if isinstance(head, int):
        arr = list(value) if isinstance(value, list) else []
        while len(arr) <= head:
            arr.append(None)
        arr[head] = _set_path(arr[head], rest, new_val)
        return arr
    else:
        obj = dict(value) if isinstance(value, dict) else {}
        obj[head] = _set_path(obj.get(head), rest, new_val)
        return obj


def _delete_path(value: Any, path: list[str | int]) -> Any:
    """Delete a value at a path."""
    if not path:
        return None
    if len(path) == 1:
        head = path[0]
        if isinstance(value, list) and isinstance(head, int):
            arr = list(value)
            if 0 <= head < len(arr):
                arr.pop(head)
            return arr
        if isinstance(value, dict) and isinstance(head, str):
            obj = dict(value)
            obj.pop(head, None)
            return obj
        return value
    head, *rest = path
    if isinstance(value, list) and isinstance(head, int):
        arr = list(value)
        if 0 <= head < len(arr):
            arr[head] = _delete_path(arr[head], rest)
        return arr
    if isinstance(value, dict) and isinstance(head, str):
        obj = dict(value)
        if head in obj:
            obj[head] = _delete_path(obj[head], rest)
        return obj
    return value


def _get_all_paths(value: Any, current: list[str | int]) -> list[list[str | int]]:
    """Get all paths in a value."""
    paths = []
    if isinstance(value, dict):
        for k, v in value.items():
            new_path = current + [k]
            paths.append(new_path)
            paths.extend(_get_all_paths(v, new_path))
    elif isinstance(value, list):
        for i, v in enumerate(value):
            new_path = current + [i]
            paths.append(new_path)
            paths.extend(_get_all_paths(v, new_path))
    return paths


def _get_leaf_paths(value: Any, current: list[str | int]) -> list[list[str | int]]:
    """Get all leaf paths (paths to non-container values)."""
    paths = []
    if value is None or not isinstance(value, (dict, list)):
        return [current] if current else []
    if isinstance(value, dict):
        if not value:
            return [current] if current else []
        for k, v in value.items():
            paths.extend(_get_leaf_paths(v, current + [k]))
    elif isinstance(value, list):
        if not value:
            return [current] if current else []
        for i, v in enumerate(value):
            paths.extend(_get_leaf_paths(v, current + [i]))
    return paths


def _get_value_at_path(value: Any, path: list[str | int]) -> Any:
    """Get the value at a path."""
    current = value
    for key in path:
        if isinstance(current, dict) and isinstance(key, str):
            current = current.get(key)
        elif isinstance(current, list) and isinstance(key, int):
            current = current[key] if 0 <= key < len(current) else None
        else:
            return None
    return current


def _compute_paths(
    value: Any,
    expr: AstNode,
    ctx: EvalContext,
    eval_fn: EvalFunc,
) -> list[list[str | int]]:
    """Compute paths that an expression navigates to."""
    node_type = expr.type

    if node_type == "Identity":
        return [[]]

    if node_type == "Field":
        field_node = expr
        if field_node.base:
            base_paths = _compute_paths(value, field_node.base, ctx, eval_fn)
            results = []
            for bp in base_paths:
                results.append(bp + [field_node.name])
            return results
        return [[field_node.name]]

    if node_type == "Index":
        index_node = expr
        indices = eval_fn(value, index_node.index, ctx)
        if index_node.base:
            base_paths = _compute_paths(value, index_node.base, ctx, eval_fn)
            results = []
            for bp in base_paths:
                for idx in indices:
                    results.append(bp + [idx])
            return results
        return [[idx] for idx in indices]

    if node_type == "Iterate":
        iter_node = expr
        if iter_node.base:
            base_paths = _compute_paths(value, iter_node.base, ctx, eval_fn)
            results = []
            for bp in base_paths:
                v = _get_value_at_path(value, bp)
                if isinstance(v, list):
                    for i in range(len(v)):
                        results.append(bp + [i])
                elif isinstance(v, dict):
                    for k in v.keys():
                        results.append(bp + [k])
            return results
        if isinstance(value, list):
            return [[i] for i in range(len(value))]
        if isinstance(value, dict):
            return [[k] for k in value.keys()]
        return []

    if node_type == "Pipe":
        pipe_node = expr
        left_paths = _compute_paths(value, pipe_node.left, ctx, eval_fn)
        results = []
        for lp in left_paths:
            v = _get_value_at_path(value, lp)
            right_paths = _compute_paths(v, pipe_node.right, ctx, eval_fn)
            for rp in right_paths:
                results.append(lp + rp)
        return results

    if node_type == "Recurse":
        # .. returns all paths
        all_paths = _get_all_paths(value, [])
        return [list(p) for p in all_paths]

    if node_type == "Comma":
        comma_node = expr
        left = _compute_paths(value, comma_node.left, ctx, eval_fn)
        right = _compute_paths(value, comma_node.right, ctx, eval_fn)
        return left + right

    # For other expression types, fall back to evaluation
    return [[]]


def _collect_paths(
    value: Any,
    expr: AstNode,
    ctx: EvalContext,
    eval_fn: EvalFunc,
    current_path: list[str | int],
    paths: list[list[str | int]],
) -> None:
    """Collect paths that match an expression."""
    results = eval_fn(value, expr, ctx)
    if results:
        paths.append(current_path)


def _apply_del(value: Any, path_expr: AstNode, ctx: EvalContext, eval_fn: EvalFunc) -> Any:
    """Apply deletion at a path."""
    if path_expr.type == "Identity":
        return None
    if path_expr.type == "Field":
        field_node = path_expr
        if isinstance(value, dict):
            result = dict(value)
            result.pop(field_node.name, None)
            return result
        return value
    if path_expr.type == "Index":
        index_node = path_expr
        indices = eval_fn(value, index_node.index, ctx)
        idx = indices[0] if indices else None
        if isinstance(idx, int) and isinstance(value, list):
            arr = list(value)
            i = idx if idx >= 0 else len(arr) + idx
            if 0 <= i < len(arr):
                arr.pop(i)
            return arr
        if isinstance(idx, str) and isinstance(value, dict):
            result = dict(value)
            result.pop(idx, None)
            return result
        return value
    if path_expr.type == "Iterate":
        if isinstance(value, list):
            return []
        if isinstance(value, dict):
            return {}
        return value
    return value


def _jq_type_for_error(v: Any) -> str:
    """Return jq type name for error messages."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return "unknown"


def _get_paths_for_expr(
    value: Any,
    expr: AstNode,
    ctx: EvalContext,
    eval_fn: EvalFunc,
) -> list[list[str | int]]:
    """Get paths that an expression refers to."""
    if expr.type == "Field":
        base_paths = _get_paths_for_expr(value, expr.base, ctx, eval_fn) if expr.base else [[]]
        return [p + [expr.name] for p in base_paths]
    if expr.type == "Index":
        base_paths = _get_paths_for_expr(value, expr.base, ctx, eval_fn) if expr.base else [[]]
        indices = eval_fn(value, expr.index, ctx)
        result = []
        for p in base_paths:
            for idx in indices:
                result.append(p + [idx])
        return result
    if expr.type == "Identity":
        return [[]]
    if expr.type == "Comma":
        left = _get_paths_for_expr(value, expr.left, ctx, eval_fn)
        right = _get_paths_for_expr(value, expr.right, ctx, eval_fn)
        return left + right
    return [[]]


def _walk_recurse(value: Any, results: list[Any]) -> None:
    """Walk recursively through a value."""
    results.append(value)
    if isinstance(value, list):
        for item in value:
            _walk_recurse(item, results)
    elif isinstance(value, dict):
        for v in value.values():
            _walk_recurse(v, results)


def _get_re_flags(flags: str) -> int:
    """Convert jq regex flag string to Python re flags."""
    result = 0
    if "i" in flags:
        result |= re.IGNORECASE
    if "m" in flags:
        result |= re.MULTILINE
    if "s" in flags:
        result |= re.DOTALL
    if "x" in flags:
        result |= re.VERBOSE
    return result


def _extract_pattern_flags(
    value: Any,
    args: list[AstNode],
    ctx: EvalContext,
    eval_fn: EvalFunc,
) -> tuple[str, str]:
    """Extract pattern and flags from match/test/sub arguments.

    Handles both match("pattern"; "flags") and match(["pattern", "flags"]) forms.
    """
    patterns = eval_fn(value, args[0], ctx)
    pat_val = patterns[0] if patterns else ""

    if isinstance(pat_val, list):
        # ["pattern", "flags"] form
        pattern = str(pat_val[0]) if pat_val else ""
        flags_str = str(pat_val[1]) if len(pat_val) > 1 else ""
    else:
        pattern = str(pat_val) if pat_val is not None else ""
        flags_str = ""

    # Also check for explicit flags argument
    if len(args) > 1:
        flags_val = eval_fn(value, args[1], ctx)
        if flags_val:
            flags_str = str(flags_val[0]) if flags_val[0] is not None else flags_str

    return pattern, flags_str


def _match_to_dict(m: re.Match, pattern: str) -> dict[str, Any]:
    """Convert a regex match object to jq match dict format."""
    # Get named groups from pattern
    named_groups = dict(re.compile(pattern).groupindex)
    name_by_idx = {v: k for k, v in named_groups.items()}

    captures = []
    for i in range(1, (m.lastindex or 0) + 1):
        grp = m.group(i)
        cap: dict[str, Any] = {
            "offset": m.start(i) if grp is not None else -1,
            "length": len(grp) if grp is not None else 0,
            "string": grp if grp is not None else None,
            "name": name_by_idx.get(i),
        }
        captures.append(cap)

    return {
        "offset": m.start(),
        "length": len(m.group()),
        "string": m.group(),
        "captures": captures,
    }
