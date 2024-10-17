from typing import Any, Dict

import pytest

from phoenix.utilities.template_formatters import TemplateFormatter


@pytest.mark.parametrize(
    "template_language, template, variables, expected_prompt",
    (
        pytest.param(
            "mustache",
            "{{ hello }}",
            {"hello": "world"},
            "world",
            id="mustache-whitespace-both-sides",
        ),
        pytest.param(
            "mustache", "{{hello}}", {"hello": "world"}, "world", id="nmustache-o-whitespace"
        ),
        pytest.param(
            "mustache", "{{  hello}}", {"hello": "world"}, "world", id="mustache-whitespace-left"
        ),
        pytest.param(
            "mustache", "{{hello }}", {"hello": "world"}, "world", id="mustache-whitespace-right"
        ),
        pytest.param(
            "mustache",
            "{{ hello }}, {{ world }}",
            {"hello": "1", "world": "2"},
            "1, 2",
            id="mustache-multiple-variables",
        ),
        pytest.param(
            "mustache",
            "{{ hello }} + {{hello}} = {{ world }}",
            {"hello": "1", "world": "2"},
            "1 + 1 = 2",
            id="mustache-duplicate-variables",
        ),
        pytest.param(
            "mustache",
            "{{ hello }}, {{ world }}",
            {"hello": "world", "world": "hello"},
            "world, hello",
            id="mustache-replaced-value-is-variable-name",
        ),
        pytest.param(
            "f-string", "{hello}", {"hello": "world"}, "world", id="f-string-single-variable"
        ),
        pytest.param(
            "f-string",
            "{hello}, {world}",
            {"hello": "1", "world": "2"},
            "1, 2",
            id="f-string-multiple-variables",
        ),
        pytest.param(
            "f-string",
            "{hello} + {hello} = {world}",
            {"hello": "1", "world": "2"},
            "1 + 1 = 2",
            id="f-string-duplicate-variables",
        ),
        pytest.param(
            "f-string",
            "{hello}, {world}",
            {"hello": "world", "world": "hello"},
            "world, hello",
            id="f-string-replaced-value-is-variable-name",
        ),
    ),
)
def test_template_formatter(
    template_language: str, template: str, variables: Dict[str, Any], expected_prompt: str
) -> None:
    formatter = TemplateFormatter(template, template_language)
    prompt = formatter.format(**variables)
    assert prompt == expected_prompt


@pytest.mark.parametrize(
    "template_language, template",
    (
        pytest.param(
            "mustache",
            "{{ hello }}",
            id="mustache-missing-template-variables",
        ),
        pytest.param(
            "f-string",
            "{hello}",
            id="f-string-missing-template-variable",
        ),
    ),
)
def test_template_formatter_raises_expected_error_on_missing_variables(
    template_language: str, template: str
) -> None:
    formatter = TemplateFormatter(template, template_language)
    with pytest.raises(ValueError, match="Missing template variables"):
        formatter.format()
