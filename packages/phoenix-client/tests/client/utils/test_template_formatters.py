from typing import Any

import pytest

from phoenix.client.utils.template_formatters import (
    FStringBaseTemplateFormatter,
    MustacheBaseTemplateFormatter,
    NoOpFormatterBase,
    TemplateFormatter,
    TemplateFormatterError,
)


@pytest.mark.parametrize(
    "formatter_cls, template, variables, expected_output",
    [
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ user_id }}",
            {"user_id": r"2025\l6300"},
            r"2025\l6300",
            id="mustache-escaped-sequence",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ hello }}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-both-sides",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{hello}}",
            {"hello": "world"},
            "world",
            id="mustache-no-whitespace",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{  hello}}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-left",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{hello }}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-right",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            r"\{{ hello }}",
            {"hello": "world"},
            r"\{{ hello }}",
            id="mustache-escaped-sequence-is-not-replaced",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ hello }}, {{ world }}",
            {"hello": "1", "world": "2"},
            "1, 2",
            id="mustache-multiple-variables",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ hello }} + {{hello}} = {{ world }}",
            {"hello": "1", "world": "2"},
            "1 + 1 = 2",
            id="mustache-duplicate-variables",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ hello }}, {{ world }}",
            {"hello": "world", "world": "hello"},
            "world, hello",
            id="mustache-value-is-variable-name",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ user.name }}",
            {"user.name": "Alice"},
            "Alice",
            id="mustache-dotted-variable-name",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{user.name}}: {{ user.answer }}",
            {"user.name": "Alice", "user.answer": "42"},
            "Alice: 42",
            id="mustache-dotted-variable-names",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            "{{ user }} is {{ user.name }}",
            {"user": "Alice", "user.name": "the user"},
            "Alice is the user",
            id="mustache-dotted-and-undotted-variable-names",
        ),
        pytest.param(
            MustacheBaseTemplateFormatter,
            r"\{{ user.name }} {{ user.name }}",
            {"user.name": "Alice"},
            r"\{{ user.name }} Alice",
            id="mustache-escaped-dotted-sequence-is-not-replaced",
        ),
        pytest.param(
            FStringBaseTemplateFormatter,
            "{hello}",
            {"hello": "world"},
            "world",
            id="fstring-single-variable",
        ),
        pytest.param(
            FStringBaseTemplateFormatter,
            "{hello}, {world}",
            {"hello": "1", "world": "2"},
            "1, 2",
            id="fstring-multiple-variables",
        ),
        pytest.param(
            FStringBaseTemplateFormatter,
            "{hello} + {hello} = {world}",
            {"hello": "1", "world": "2"},
            "1 + 1 = 2",
            id="fstring-duplicate-variables",
        ),
        pytest.param(
            FStringBaseTemplateFormatter,
            "{hello}, {world}",
            {"hello": "world", "world": "hello"},
            "world, hello",
            id="fstring-value-is-variable-name",
        ),
        pytest.param(
            NoOpFormatterBase,
            "Hello, world!",
            {},
            "Hello, world!",
            id="noop-formatter-no-change",
        ),
    ],
)
def test_formatters_produce_expected_output(
    formatter_cls: type[TemplateFormatter],
    template: str,
    variables: dict[str, Any],
    expected_output: str,
) -> None:
    formatter = formatter_cls()
    output = formatter.format(template, variables=variables)
    assert output == expected_output


@pytest.mark.parametrize(
    "template, variables",
    [
        pytest.param("{{ user.name }}", {}, id="no-variables"),
        pytest.param("{{ user.name }}", {"user": "Alice"}, id="root-name-only"),
        pytest.param("{{ user }} is {{ user.name }}", {"user": "Alice"}, id="mixed"),
    ],
)
def test_mustache_formatter_reports_missing_dotted_variable(
    template: str,
    variables: dict[str, str],
) -> None:
    formatter = MustacheBaseTemplateFormatter()
    with pytest.raises(
        TemplateFormatterError, match=r"Missing template variable\(s\): user\.name$"
    ):
        formatter.format(template, variables=variables)
