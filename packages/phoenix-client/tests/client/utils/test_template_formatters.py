from typing import Any

import pytest

from phoenix.client.utils.template_formatters import (
    FStringBaseTemplateFormatter,
    MustacheBaseTemplateFormatter,
    NoOpFormatterBase,
    TemplateFormatter,
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
