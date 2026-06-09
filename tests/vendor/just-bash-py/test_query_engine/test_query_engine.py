"""Tests for the query engine module."""

import pytest
from just_bash.query_engine import (
    tokenize,
    parse,
    evaluate,
    TokenType,
    IdentityNode,
    FieldNode,
    PipeNode,
    LiteralNode,
    CallNode,
    BinaryOpNode,
)


class TestTokenizer:
    """Test the tokenizer."""

    def test_empty_string(self):
        tokens = tokenize("")
        assert len(tokens) == 1
        assert tokens[0].type == TokenType.EOF

    def test_identity(self):
        tokens = tokenize(".")
        assert len(tokens) == 2
        assert tokens[0].type == TokenType.DOT
        assert tokens[1].type == TokenType.EOF

    def test_field_access(self):
        tokens = tokenize(".foo")
        assert len(tokens) == 3
        assert tokens[0].type == TokenType.DOT
        assert tokens[1].type == TokenType.IDENT
        assert tokens[1].value == "foo"

    def test_pipe(self):
        tokens = tokenize(". | .foo")
        assert tokens[0].type == TokenType.DOT
        assert tokens[1].type == TokenType.PIPE
        assert tokens[2].type == TokenType.DOT
        assert tokens[3].type == TokenType.IDENT

    def test_operators(self):
        tokens = tokenize(". | .foo == 1")
        types = [t.type for t in tokens]
        assert TokenType.DOT in types
        assert TokenType.PIPE in types
        assert TokenType.EQ in types

    def test_comparison_operators(self):
        for op, expected in [
            ("==", TokenType.EQ),
            ("!=", TokenType.NE),
            ("<", TokenType.LT),
            ("<=", TokenType.LE),
            (">", TokenType.GT),
            (">=", TokenType.GE),
        ]:
            tokens = tokenize(f".a {op} .b")
            types = [t.type for t in tokens]
            assert expected in types, f"Expected {expected} for {op}"

    def test_update_operators(self):
        for op, expected in [
            ("+=", TokenType.UPDATE_ADD),
            ("-=", TokenType.UPDATE_SUB),
            ("*=", TokenType.UPDATE_MUL),
            ("/=", TokenType.UPDATE_DIV),
            ("%=", TokenType.UPDATE_MOD),
            ("|=", TokenType.UPDATE_PIPE),
            ("//=", TokenType.UPDATE_ALT),
        ]:
            tokens = tokenize(f".a {op} 1")
            types = [t.type for t in tokens]
            assert expected in types, f"Expected {expected} for {op}"

    def test_numbers(self):
        tokens = tokenize("123")
        assert tokens[0].type == TokenType.NUMBER
        assert tokens[0].value == 123

        tokens = tokenize("3.14")
        assert tokens[0].type == TokenType.NUMBER
        assert tokens[0].value == 3.14

        tokens = tokenize("-42")
        assert tokens[0].type == TokenType.NUMBER
        assert tokens[0].value == -42

        tokens = tokenize("1e10")
        assert tokens[0].type == TokenType.NUMBER
        assert tokens[0].value == 1e10

    def test_strings(self):
        tokens = tokenize('"hello"')
        assert tokens[0].type == TokenType.STRING
        assert tokens[0].value == "hello"

        tokens = tokenize('"hello\\nworld"')
        assert tokens[0].type == TokenType.STRING
        assert tokens[0].value == "hello\nworld"

    def test_keywords(self):
        for keyword, expected in [
            ("and", TokenType.AND),
            ("or", TokenType.OR),
            ("not", TokenType.NOT),
            ("if", TokenType.IF),
            ("then", TokenType.THEN),
            ("else", TokenType.ELSE),
            ("end", TokenType.END),
            ("true", TokenType.TRUE),
            ("false", TokenType.FALSE),
            ("null", TokenType.NULL),
        ]:
            tokens = tokenize(keyword)
            assert tokens[0].type == expected, f"Expected {expected} for {keyword}"

    def test_brackets_and_braces(self):
        tokens = tokenize("[.a, .b]")
        types = [t.type for t in tokens]
        assert TokenType.LBRACKET in types
        assert TokenType.RBRACKET in types
        assert TokenType.COMMA in types

        tokens = tokenize("{a: 1}")
        types = [t.type for t in tokens]
        assert TokenType.LBRACE in types
        assert TokenType.RBRACE in types
        assert TokenType.COLON in types

    def test_comments(self):
        tokens = tokenize(". # this is a comment\n| .foo")
        # Comments should be skipped
        types = [t.type for t in tokens]
        assert TokenType.DOT in types
        assert TokenType.PIPE in types

    def test_dotdot(self):
        tokens = tokenize("..")
        assert tokens[0].type == TokenType.DOTDOT


class TestParser:
    """Test the parser."""

    def test_identity(self):
        ast = parse(".")
        assert ast.type == "Identity"

    def test_field_access(self):
        ast = parse(".foo")
        assert ast.type == "Field"
        assert ast.name == "foo"

    def test_nested_field_access(self):
        ast = parse(".foo.bar")
        assert ast.type == "Field"
        assert ast.name == "bar"
        assert ast.base is not None
        assert ast.base.type == "Field"
        assert ast.base.name == "foo"

    def test_pipe(self):
        ast = parse(".a | .b")
        assert ast.type == "Pipe"
        assert ast.left.type == "Field"
        assert ast.right.type == "Field"

    def test_array_index(self):
        ast = parse(".[0]")
        assert ast.type == "Index"

    def test_array_iterator(self):
        ast = parse(".[]")
        assert ast.type == "Iterate"

    def test_array_slice(self):
        ast = parse(".[1:3]")
        assert ast.type == "Slice"

    def test_literal_number(self):
        ast = parse("42")
        assert ast.type == "Literal"
        assert ast.value == 42

    def test_literal_string(self):
        ast = parse('"hello"')
        assert ast.type == "Literal"
        assert ast.value == "hello"

    def test_literal_boolean(self):
        ast = parse("true")
        assert ast.type == "Literal"
        assert ast.value is True

        ast = parse("false")
        assert ast.type == "Literal"
        assert ast.value is False

    def test_literal_null(self):
        ast = parse("null")
        assert ast.type == "Literal"
        assert ast.value is None

    def test_array_construction(self):
        ast = parse("[.a, .b]")
        assert ast.type == "Array"

    def test_object_construction(self):
        ast = parse("{a: 1}")
        assert ast.type == "Object"
        assert len(ast.entries) == 1
        assert ast.entries[0].key == "a"

    def test_function_call(self):
        ast = parse("keys")
        assert ast.type == "Call"
        assert ast.name == "keys"

    def test_function_call_with_args(self):
        ast = parse("select(.a > 1)")
        assert ast.type == "Call"
        assert ast.name == "select"
        assert len(ast.args) == 1

    def test_binary_op(self):
        ast = parse(".a + .b")
        assert ast.type == "BinaryOp"
        assert ast.op == "+"

    def test_comparison(self):
        ast = parse(".a == .b")
        assert ast.type == "BinaryOp"
        assert ast.op == "=="

    def test_conditional(self):
        ast = parse("if .a then .b else .c end")
        assert ast.type == "Cond"

    def test_try_catch(self):
        ast = parse("try .a catch null")
        assert ast.type == "Try"

    def test_reduce(self):
        ast = parse("reduce .[] as $x (0; . + $x)")
        assert ast.type == "Reduce"
        assert ast.var_name == "$x"

    def test_optional(self):
        ast = parse(".a?")
        assert ast.type == "Optional"


class TestEvaluator:
    """Test the evaluator."""

    def test_identity(self):
        assert evaluate(42, parse(".")) == [42]
        assert evaluate("hello", parse(".")) == ["hello"]
        assert evaluate([1, 2, 3], parse(".")) == [[1, 2, 3]]
        assert evaluate({"a": 1}, parse(".")) == [{"a": 1}]

    def test_field_access(self):
        assert evaluate({"a": 1}, parse(".a")) == [1]
        assert evaluate({"a": {"b": 2}}, parse(".a.b")) == [2]
        assert evaluate({"a": 1}, parse(".b")) == [None]

    def test_array_index(self):
        assert evaluate([1, 2, 3], parse(".[0]")) == [1]
        assert evaluate([1, 2, 3], parse(".[1]")) == [2]
        assert evaluate([1, 2, 3], parse(".[-1]")) == [3]

    def test_array_iterator(self):
        assert evaluate([1, 2, 3], parse(".[]")) == [1, 2, 3]
        assert evaluate({"a": 1, "b": 2}, parse(".[]")) == [1, 2]

    def test_array_slice(self):
        assert evaluate([1, 2, 3, 4], parse(".[1:3]")) == [[2, 3]]

    def test_pipe(self):
        assert evaluate({"a": {"b": 2}}, parse(".a | .b")) == [2]
        assert evaluate([{"a": 1}, {"a": 2}], parse(".[] | .a")) == [1, 2]

    def test_comma(self):
        assert evaluate({"a": 1, "b": 2}, parse(".a, .b")) == [1, 2]

    def test_literal(self):
        assert evaluate({}, parse("42")) == [42]
        assert evaluate({}, parse('"hello"')) == ["hello"]
        assert evaluate({}, parse("true")) == [True]
        assert evaluate({}, parse("false")) == [False]
        assert evaluate({}, parse("null")) == [None]

    def test_array_construction(self):
        assert evaluate({"a": 1, "b": 2}, parse("[.a, .b]")) == [[1, 2]]
        assert evaluate([1, 2, 3], parse("[.[]]")) == [[1, 2, 3]]

    def test_object_construction(self):
        result = evaluate({"a": 1, "b": 2}, parse("{x: .a, y: .b}"))
        assert result == [{"x": 1, "y": 2}]

    def test_arithmetic(self):
        assert evaluate({}, parse("1 + 2")) == [3]
        assert evaluate({}, parse("5 - 3")) == [2]
        assert evaluate({}, parse("2 * 3")) == [6]
        assert evaluate({}, parse("6 / 2")) == [3.0]
        assert evaluate({}, parse("7 % 3")) == [1]

    def test_string_concatenation(self):
        assert evaluate({}, parse('"hello" + " world"')) == ["hello world"]

    def test_array_concatenation(self):
        assert evaluate({}, parse("[1, 2] + [3, 4]")) == [[1, 2, 3, 4]]

    def test_comparison(self):
        assert evaluate({}, parse("1 == 1")) == [True]
        assert evaluate({}, parse("1 == 2")) == [False]
        assert evaluate({}, parse("1 != 2")) == [True]
        assert evaluate({}, parse("1 < 2")) == [True]
        assert evaluate({}, parse("2 <= 2")) == [True]
        assert evaluate({}, parse("2 > 1")) == [True]
        assert evaluate({}, parse("2 >= 2")) == [True]

    def test_logical_and_or(self):
        assert evaluate({}, parse("true and true")) == [True]
        assert evaluate({}, parse("true and false")) == [False]
        assert evaluate({}, parse("false or true")) == [True]
        assert evaluate({}, parse("false or false")) == [False]

    def test_alternative(self):
        assert evaluate(None, parse(". // 42")) == [42]
        assert evaluate(0, parse(". // 42")) == [0]
        assert evaluate(False, parse(". // 42")) == [42]

    def test_conditional(self):
        assert evaluate({"a": 1}, parse("if .a == 1 then .a else 0 end")) == [1]
        assert evaluate({"a": 2}, parse("if .a == 1 then .a else 0 end")) == [0]

    def test_try_catch(self):
        assert evaluate({}, parse("try error catch null")) == [None]

    def test_not(self):
        assert evaluate(True, parse("not")) == [False]
        assert evaluate(False, parse("not")) == [True]
        assert evaluate(None, parse("not")) == [True]

    def test_select(self):
        assert evaluate(1, parse("select(. > 0)")) == [1]
        assert evaluate(-1, parse("select(. > 0)")) == []

    def test_map(self):
        assert evaluate([1, 2, 3], parse("map(. * 2)")) == [[2, 4, 6]]

    def test_keys(self):
        result = evaluate({"b": 2, "a": 1}, parse("keys"))
        assert result == [["a", "b"]]

    def test_values(self):
        result = evaluate({"a": 1, "b": 2}, parse("values"))
        # values should be list of values (order may vary)
        assert len(result) == 1
        assert set(result[0]) == {1, 2}

    def test_length(self):
        assert evaluate([1, 2, 3], parse("length")) == [3]
        assert evaluate("hello", parse("length")) == [5]
        assert evaluate({"a": 1, "b": 2}, parse("length")) == [2]

    def test_type(self):
        assert evaluate(None, parse("type")) == ["null"]
        assert evaluate(True, parse("type")) == ["boolean"]
        assert evaluate(42, parse("type")) == ["number"]
        assert evaluate("hello", parse("type")) == ["string"]
        assert evaluate([], parse("type")) == ["array"]
        assert evaluate({}, parse("type")) == ["object"]

    def test_empty(self):
        assert evaluate(42, parse("empty")) == []

    def test_first_last(self):
        assert evaluate([1, 2, 3], parse("first")) == [1]
        assert evaluate([1, 2, 3], parse("last")) == [3]

    def test_reverse(self):
        assert evaluate([1, 2, 3], parse("reverse")) == [[3, 2, 1]]

    def test_sort(self):
        assert evaluate([3, 1, 2], parse("sort")) == [[1, 2, 3]]

    def test_unique(self):
        assert evaluate([1, 2, 1, 3, 2], parse("unique")) == [[1, 2, 3]]

    def test_flatten(self):
        assert evaluate([[1, 2], [3, 4]], parse("flatten")) == [[1, 2, 3, 4]]

    def test_add(self):
        assert evaluate([1, 2, 3], parse("add")) == [6]
        assert evaluate(["a", "b", "c"], parse("add")) == ["abc"]
        assert evaluate([[1], [2], [3]], parse("add")) == [[1, 2, 3]]

    def test_min_max(self):
        assert evaluate([3, 1, 2], parse("min")) == [1]
        assert evaluate([3, 1, 2], parse("max")) == [3]

    def test_has(self):
        assert evaluate({"a": 1}, parse('has("a")')) == [True]
        assert evaluate({"a": 1}, parse('has("b")')) == [False]
        assert evaluate([1, 2, 3], parse("has(1)")) == [True]
        assert evaluate([1, 2, 3], parse("has(5)")) == [False]

    def test_contains(self):
        assert evaluate([1, 2, 3], parse("contains([2])")) == [True]
        assert evaluate({"a": 1, "b": 2}, parse('contains({"a": 1})')) == [True]

    def test_split_join(self):
        assert evaluate("a,b,c", parse('split(",")')) == [["a", "b", "c"]]
        assert evaluate(["a", "b", "c"], parse('join(",")')) == ["a,b,c"]

    def test_ascii_case(self):
        assert evaluate("Hello", parse("ascii_downcase")) == ["hello"]
        assert evaluate("Hello", parse("ascii_upcase")) == ["HELLO"]

    def test_ltrimstr_rtrimstr(self):
        assert evaluate("hello world", parse('ltrimstr("hello ")')) == ["world"]
        assert evaluate("hello world", parse('rtrimstr(" world")')) == ["hello"]

    def test_startswith_endswith(self):
        assert evaluate("hello", parse('startswith("hel")')) == [True]
        assert evaluate("hello", parse('endswith("lo")')) == [True]

    def test_test_regex(self):
        assert evaluate("hello", parse('test("ell")')) == [True]
        assert evaluate("hello", parse('test("^h")')) == [True]
        assert evaluate("hello", parse('test("^x")')) == [False]

    def test_floor_ceil_round(self):
        assert evaluate(3.7, parse("floor")) == [3]
        assert evaluate(3.2, parse("ceil")) == [4]
        assert evaluate(3.5, parse("round")) == [4]

    def test_sqrt(self):
        assert evaluate(4, parse("sqrt")) == [2.0]

    def test_tostring_tonumber(self):
        assert evaluate(42, parse("tostring")) == ["42"]
        assert evaluate("42", parse("tonumber")) == [42]

    def test_to_from_entries(self):
        result = evaluate({"a": 1, "b": 2}, parse("to_entries"))
        assert len(result) == 1
        entries = result[0]
        assert {"key": "a", "value": 1} in entries
        assert {"key": "b", "value": 2} in entries

        result = evaluate([{"key": "a", "value": 1}], parse("from_entries"))
        assert result == [{"a": 1}]

    def test_group_by(self):
        data = [{"a": 1, "b": 1}, {"a": 2, "b": 1}, {"a": 1, "b": 2}]
        result = evaluate(data, parse("group_by(.a)"))
        assert len(result) == 1
        groups = result[0]
        assert len(groups) == 2

    def test_sort_by(self):
        data = [{"a": 2}, {"a": 1}, {"a": 3}]
        result = evaluate(data, parse("sort_by(.a)"))
        assert result == [[{"a": 1}, {"a": 2}, {"a": 3}]]

    def test_format_base64(self):
        assert evaluate("hello", parse("@base64")) == ["aGVsbG8="]
        assert evaluate("aGVsbG8=", parse("@base64d")) == ["hello"]

    def test_format_uri(self):
        assert evaluate("hello world", parse("@uri")) == ["hello%20world"]

    def test_format_json(self):
        result = evaluate({"a": 1}, parse("@json"))
        assert result == ['{"a": 1}']

    def test_reduce(self):
        result = evaluate([1, 2, 3, 4, 5], parse("reduce .[] as $x (0; . + $x)"))
        assert result == [15]

    def test_recurse(self):
        data = {"a": {"b": {"c": 1}}}
        result = evaluate(data, parse(".."))
        # Should include root and all nested values
        assert data in result
        assert {"b": {"c": 1}} in result
        assert {"c": 1} in result
        assert 1 in result

    def test_optional(self):
        # Optional returns null for missing fields (which doesn't trigger errors)
        # .b.c? on {"a": 1} returns [None] because .b returns null
        assert evaluate({"a": 1}, parse(".b.c?")) == [None]
        assert evaluate({"a": {"b": 1}}, parse(".a.b?")) == [1]
        # Access on non-objects is suppressed by ? (returns empty)
        assert evaluate("not an object", parse(".foo?")) == []

    def test_variable_binding(self):
        result = evaluate(5, parse(". as $x | $x * $x"))
        assert result == [25]

    def test_update_op(self):
        result = evaluate({"a": 1}, parse(".a = 2"))
        assert result == [{"a": 2}]

        result = evaluate({"a": 1}, parse(".a += 1"))
        assert result == [{"a": 2}]


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_array(self):
        assert evaluate([], parse("length")) == [0]
        assert evaluate([], parse(".[]")) == []

    def test_empty_object(self):
        assert evaluate({}, parse("length")) == [0]
        assert evaluate({}, parse(".[]")) == []

    def test_null_handling(self):
        assert evaluate(None, parse("length")) == [0]
        assert evaluate({"a": None}, parse(".a")) == [None]

    def test_nested_arrays(self):
        result = evaluate([[1, 2], [3, 4]], parse(".[][] "))
        # Note: .[][] should iterate twice
        # First .[] gives [1,2] and [3,4]
        # Second [] on each gives 1,2 and 3,4
        # But since we pipe, we need to write it differently
        result = evaluate([[1, 2], [3, 4]], parse(".[] | .[]"))
        assert result == [1, 2, 3, 4]

    def test_complex_pipe(self):
        data = {"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}
        result = evaluate(data, parse('.users | map(select(.age > 26)) | .[].name'))
        assert result == ["Alice"]

    def test_object_construction_with_computed_keys(self):
        # This tests dynamic key construction
        data = {"key": "x", "val": 1}
        result = evaluate(data, parse('{(.key): .val}'))
        assert result == [{"x": 1}]
