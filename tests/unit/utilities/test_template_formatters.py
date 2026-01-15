from typing import Any

import pytest

from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    TemplateFormatter,
    TemplateFormatterError,
)


@pytest.mark.parametrize(
    "formatter_cls, template, variables, expected_prompt",
    (
        pytest.param(
            MustacheTemplateFormatter,
            "{{ hello }}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-both-sides",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{hello}}",
            {"hello": "world"},
            "world",
            id="mustache-no-whitespace",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{  hello}}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-left",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{hello }}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-right",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            r"\{{ hello }}",
            {"hello": "world"},
            r"\{{ hello }}",
            id="mustache-does-not-replace-escaped-sequences",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ hello }}, {{ world }}",
            {"hello": "1", "world": "2"},
            "1, 2",
            id="mustache-multiple-variables",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ hello }} + {{hello}} = {{ world }}",
            {"hello": "1", "world": "2"},
            "1 + 1 = 2",
            id="mustache-duplicate-variables",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ hello }}, {{ world }}",
            {"hello": "world", "world": "hello"},
            "world, hello",
            id="mustache-replaced-value-is-variable-name",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ value }}",
            {"value": [1, 2, 3]},
            "[1, 2, 3]",
            id="mustache-list-value",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ value }}",
            {"value": 42},
            "42",
            id="mustache-integer-value",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ value }}",
            {"value": 3.14},
            "3.14",
            id="mustache-float-value",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ value }}",
            {"value": True},
            "True",
            id="mustache-boolean-true-value",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ value }}",
            {"value": False},
            "False",
            id="mustache-boolean-false-value",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ value }}",
            {"value": None},
            "None",
            id="mustache-none-value",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ output }}",
            {"output": r'{"content": "Here\u2019s an example"}'},
            r'{"content": "Here\u2019s an example"}',
            id="mustache-value-with-unicode-escape-sequence",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ output }}",
            {"output": r"line1\nline2"},
            r"line1\nline2",
            id="mustache-value-with-backslash-n",
        ),
        # Dot notation tests
        pytest.param(
            MustacheTemplateFormatter,
            "{{ user.name }}",
            {"user": {"name": "Alice"}},
            "Alice",
            id="mustache-dot-notation-simple",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{user.name}}",
            {"user": {"name": "Bob"}},
            "Bob",
            id="mustache-dot-notation-no-whitespace",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ input.query }}",
            {"input": {"query": "What is the weather?"}},
            "What is the weather?",
            id="mustache-dot-notation-input-query",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ a.b.c.d }}",
            {"a": {"b": {"c": {"d": "deep"}}}},
            "deep",
            id="mustache-dot-notation-deeply-nested",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "Hello {{ user.first_name }} {{ user.last_name }}!",
            {"user": {"first_name": "John", "last_name": "Doe"}},
            "Hello John Doe!",
            id="mustache-dot-notation-multiple-paths",
        ),
        # Array indexing tests
        pytest.param(
            MustacheTemplateFormatter,
            "{{ items[0] }}",
            {"items": ["first", "second", "third"]},
            "first",
            id="mustache-array-index-first",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ items[2] }}",
            {"items": ["first", "second", "third"]},
            "third",
            id="mustache-array-index-last",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{items[1]}}",
            {"items": ["a", "b", "c"]},
            "b",
            id="mustache-array-index-no-whitespace",
        ),
        # Combined dot notation and array indexing tests
        pytest.param(
            MustacheTemplateFormatter,
            "{{ input.messages[0] }}",
            {"input": {"messages": ["Hello", "World"]}},
            "Hello",
            id="mustache-dot-then-array",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ messages[0].content }}",
            {"messages": [{"role": "user", "content": "Hi there"}]},
            "Hi there",
            id="mustache-array-then-dot",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ input.messages[0].content }}",
            {"input": {"messages": [{"role": "user", "content": "Show database schema"}]}},
            "Show database schema",
            id="mustache-complex-path",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "User said: {{ input.messages[0].content }}\nExpected: {{ reference.answer }}",
            {
                "input": {"messages": [{"role": "user", "content": "Hello"}]},
                "reference": {"answer": "Hi there!"},
            },
            "User said: Hello\nExpected: Hi there!",
            id="mustache-multiple-complex-paths",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ data[0][1] }}",
            {"data": [["a", "b", "c"], ["d", "e", "f"]]},
            "b",
            id="mustache-nested-array-indices",
        ),
        pytest.param(
            MustacheTemplateFormatter,
            "{{ users[0].addresses[1].city }}",
            {"users": [{"addresses": [{"city": "NYC"}, {"city": "LA"}]}]},
            "LA",
            id="mustache-alternating-dot-and-array",
        ),
        pytest.param(
            FStringTemplateFormatter,
            "{hello}",
            {"hello": "world"},
            "world",
            id="f-string-single-variable",
        ),
        pytest.param(
            FStringTemplateFormatter,
            "{hello}, {world}",
            {"hello": "1", "world": "2"},
            "1, 2",
            id="f-string-multiple-variables",
        ),
        pytest.param(
            FStringTemplateFormatter,
            "{hello} + {hello} = {world}",
            {"hello": "1", "world": "2"},
            "1 + 1 = 2",
            id="f-string-duplicate-variables",
        ),
        pytest.param(
            FStringTemplateFormatter,
            "{hello}, {world}",
            {"hello": "world", "world": "hello"},
            "world, hello",
            id="f-string-replaced-value-is-variable-name",
        ),
    ),
)
def test_template_formatters_produce_expected_prompt(
    formatter_cls: type[TemplateFormatter],
    template: str,
    variables: dict[str, Any],
    expected_prompt: str,
) -> None:
    formatter = formatter_cls()
    prompt = formatter.format(template, **variables)
    assert prompt == expected_prompt


@pytest.mark.parametrize(
    "formatter_cls, template",
    (
        pytest.param(
            MustacheTemplateFormatter,
            "{{ hello }}",
            id="mustache-missing-template-variables",
        ),
        pytest.param(
            FStringTemplateFormatter,
            "{hello}",
            id="f-string-missing-template-variables",
        ),
    ),
)
def test_template_formatters_raise_expected_error_on_missing_variables(
    formatter_cls: type[TemplateFormatter], template: str
) -> None:
    formatter = formatter_cls()
    with pytest.raises(TemplateFormatterError, match=r"Missing template variable\(s\): hello"):
        formatter.format(template)


class TestMustacheDotNotationErrors:
    """Tests for error handling in dot notation and array indexing."""

    def test_missing_root_key_in_path(self) -> None:
        """Error when root key of a path doesn't exist."""
        formatter = MustacheTemplateFormatter()
        with pytest.raises(TemplateFormatterError, match=r"Missing template variable\(s\): user"):
            formatter.format("{{ user.name }}")

    def test_missing_nested_key(self) -> None:
        """Error when a nested key doesn't exist."""
        formatter = MustacheTemplateFormatter()
        with pytest.raises(TemplateFormatterError, match=r"Failed to resolve path"):
            formatter.format("{{ user.email }}", user={"name": "Alice"})

    def test_array_index_out_of_bounds(self) -> None:
        """Error when array index is out of bounds."""
        formatter = MustacheTemplateFormatter()
        with pytest.raises(TemplateFormatterError, match=r"Failed to resolve path"):
            formatter.format("{{ items[10] }}", items=["a", "b", "c"])

    def test_array_index_on_non_list(self) -> None:
        """Error when using array index on a non-list type."""
        formatter = MustacheTemplateFormatter()
        with pytest.raises(TemplateFormatterError, match=r"Failed to resolve path"):
            formatter.format("{{ user[0] }}", user={"name": "Alice"})

    def test_dot_access_on_non_dict(self) -> None:
        """Error when using dot access on a non-dict type."""
        formatter = MustacheTemplateFormatter()
        with pytest.raises(TemplateFormatterError, match=r"Failed to resolve path"):
            formatter.format("{{ items.name }}", items=["a", "b", "c"])

    def test_multiple_paths_one_missing_root(self) -> None:
        """Error when one of multiple paths has a missing root key."""
        formatter = MustacheTemplateFormatter()
        with pytest.raises(TemplateFormatterError, match=r"Missing template variable\(s\): other"):
            formatter.format("{{ user.name }} and {{ other.value }}", user={"name": "Alice"})


class TestMustachePathParsing:
    """Tests for the parse method with dot notation paths."""

    def test_parse_simple_variable(self) -> None:
        formatter = MustacheTemplateFormatter()
        result = formatter.parse("{{ hello }}")
        assert result == {"hello"}

    def test_parse_dot_notation(self) -> None:
        formatter = MustacheTemplateFormatter()
        result = formatter.parse("{{ user.name }}")
        assert result == {"user.name"}

    def test_parse_array_index(self) -> None:
        formatter = MustacheTemplateFormatter()
        result = formatter.parse("{{ items[0] }}")
        assert result == {"items[0]"}

    def test_parse_complex_path(self) -> None:
        formatter = MustacheTemplateFormatter()
        result = formatter.parse("{{ input.messages[0].content }}")
        assert result == {"input.messages[0].content"}

    def test_parse_multiple_paths(self) -> None:
        formatter = MustacheTemplateFormatter()
        result = formatter.parse("{{ user.name }} said {{ messages[0].text }}")
        assert result == {"user.name", "messages[0].text"}
