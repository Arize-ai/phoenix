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


class TestMustacheSections:
    """Tests for full Mustache syntax support including sections."""

    def test_mustache_section_with_list(self) -> None:
        """Test that Mustache sections iterate over lists."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}- {{name}}\n{{/items}}"
        variables = {"items": [{"name": "foo"}, {"name": "bar"}]}
        result = formatter.format(template, **variables)
        assert result == "- foo\n- bar\n"

    def test_mustache_inverted_section_when_empty(self) -> None:
        """Test that inverted sections render when list is empty."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}{{name}}{{/items}}{{^items}}No items{{/items}}"
        variables: dict[str, Any] = {"items": []}
        result = formatter.format(template, **variables)
        assert result == "No items"

    def test_mustache_inverted_section_when_not_empty(self) -> None:
        """Test that inverted sections don't render when list has items."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}{{name}}{{/items}}{{^items}}No items{{/items}}"
        variables = {"items": [{"name": "foo"}]}
        result = formatter.format(template, **variables)
        assert result == "foo"

    def test_mustache_nested_properties(self) -> None:
        """Test that nested object properties are accessible."""
        formatter = MustacheTemplateFormatter()
        template = "{{#tool}}{{function.name}}: {{function.description}}{{/tool}}"
        variables = {
            "tool": {"function": {"name": "get_weather", "description": "Get weather info"}}
        }
        result = formatter.format(template, **variables)
        assert result == "get_weather: Get weather info"

    def test_mustache_tool_formatter_pattern(self) -> None:
        """Test the pattern used for tool formatters."""
        formatter = MustacheTemplateFormatter()
        template = """{{#available_tools}}
- {{function.name}}: {{function.description}}
{{/available_tools}}
{{^available_tools}}
No tools available.
{{/available_tools}}"""
        variables = {
            "available_tools": [
                {"function": {"name": "search", "description": "Search the web"}},
                {"function": {"name": "calculate", "description": "Do math"}},
            ]
        }
        result = formatter.format(template, **variables)
        assert "- search: Search the web" in result
        assert "- calculate: Do math" in result
        assert "No tools available" not in result

    def test_mustache_tool_formatter_empty_tools(self) -> None:
        """Test tool formatter pattern with no tools."""
        formatter = MustacheTemplateFormatter()
        template = """{{#available_tools}}
- {{function.name}}: {{function.description}}
{{/available_tools}}
{{^available_tools}}
No tools available.
{{/available_tools}}"""
        variables: dict[str, Any] = {"available_tools": []}
        result = formatter.format(template, **variables)
        assert "No tools available" in result

    def test_mustache_parse_only_extracts_top_level_variables(self) -> None:
        """Test that parse() only returns top-level variables, not nested ones."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}{{name}}{{/items}}{{simple}}"
        variables = formatter.parse(template)
        # Should include top-level keys: items, simple
        # Should NOT include nested key: name (it's inside the items section)
        assert "items" in variables
        assert "simple" in variables
        assert "name" not in variables
