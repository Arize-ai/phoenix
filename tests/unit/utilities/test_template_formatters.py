from typing import Any

import pytest

from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    JSONPathTemplateFormatter,
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
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.name}",
            {"name": "world"},
            "world",
            id="jsonpath-simple-path",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.user.name}",
            {"user": {"name": "Alice"}},
            "Alice",
            id="jsonpath-nested-path",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.items[0]}",
            {"items": ["first", "second"]},
            "first",
            id="jsonpath-array-index",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.users[0].name}",
            {"users": [{"name": "Alice"}, {"name": "Bob"}]},
            "Alice",
            id="jsonpath-nested-array-path",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.name}, {$.age}",
            {"name": "Alice", "age": 30},
            "Alice, 30",
            id="jsonpath-multiple-paths",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            r"\{$.name}",
            {"name": "Alice"},
            r"\{$.name}",
            id="jsonpath-escaped-bracket",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.missing}",
            {"name": "Alice"},
            "{$.missing}",
            id="jsonpath-unmatched-path-left-as-is",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.value}",
            {"value": 42},
            "42",
            id="jsonpath-integer-value",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.value}",
            {"value": [1, 2, 3]},
            "[1, 2, 3]",
            id="jsonpath-list-value",
        ),
        pytest.param(
            JSONPathTemplateFormatter,
            "{$.user.name}",
            {"user": {"name": "Café"}},
            "Café",
            id="jsonpath-unicode-value",
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


def test_jsonpath_template_formatter_parse_extracts_variables() -> None:
    formatter = JSONPathTemplateFormatter()

    # Simple path
    assert formatter.parse("{$.name}") == {"$.name"}

    # Nested path
    assert formatter.parse("{$.user.name}") == {"$.user.name"}

    # Array index
    assert formatter.parse("{$.items[0]}") == {"$.items[0]"}

    # Multiple paths
    assert formatter.parse("{$.name} and {$.age}") == {"$.name", "$.age"}

    # Escaped brackets should not be extracted
    assert formatter.parse(r"\{$.name}") == set()

    # Mixed content
    assert formatter.parse("Hello {$.user.name}, you are {$.user.age} years old") == {
        "$.user.name",
        "$.user.age",
    }
