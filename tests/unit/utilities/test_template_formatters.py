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

    def test_mustache_tool_calls_from_messages_pattern(self) -> None:
        """Test extracting tool calls from OpenAI-style messages."""
        formatter = MustacheTemplateFormatter()
        template = """{{#messages}}
{{role}}: {{content}}
{{#tool_calls}}
- {{function.name}}({{function.arguments}})
{{/tool_calls}}
{{^tool_calls}}
No tools called.
{{/tool_calls}}
{{/messages}}"""
        variables = {
            "messages": [
                {
                    "role": "assistant",
                    "content": "I'll help you with that.",
                    "tool_calls": [
                        {"function": {"name": "get_weather", "arguments": '{"city": "NYC"}'}},
                        {"function": {"name": "get_time", "arguments": "{}"}},
                    ],
                }
            ]
        }
        result = formatter.format(template, **variables)
        assert "assistant: I'll help you with that." in result
        assert '- get_weather({"city": "NYC"})' in result
        assert "- get_time({})" in result
        assert "No tools called" not in result

    def test_mustache_tool_calls_multiple_messages(self) -> None:
        """Test extracting tool calls from multiple messages."""
        formatter = MustacheTemplateFormatter()
        template = """{{#messages}}
{{role}}: {{content}}
{{#tool_calls}}
- {{function.name}}({{function.arguments}})
{{/tool_calls}}
{{/messages}}"""
        variables = {
            "messages": [
                {
                    "role": "assistant",
                    "content": "First response",
                    "tool_calls": [{"function": {"name": "tool1", "arguments": "{}"}}],
                },
                {
                    "role": "assistant",
                    "content": "Second response",
                    "tool_calls": [{"function": {"name": "tool2", "arguments": "{}"}}],
                },
            ]
        }
        result = formatter.format(template, **variables)
        assert "First response" in result
        assert "Second response" in result
        assert "- tool1({})" in result
        assert "- tool2({})" in result

    def test_mustache_message_without_tool_calls(self) -> None:
        """Test message with no tool calls."""
        formatter = MustacheTemplateFormatter()
        template = """{{#messages}}
{{role}}: {{content}}
{{#tool_calls}}
- {{function.name}}({{function.arguments}})
{{/tool_calls}}
{{^tool_calls}}
No tools called.
{{/tool_calls}}
{{/messages}}"""
        variables = {"messages": [{"role": "assistant", "content": "Just a text response"}]}
        result = formatter.format(template, **variables)
        assert "assistant: Just a text response" in result
        assert "No tools called" in result

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


class TestMustacheParseEdgeCases:
    """Edge case tests for MustacheTemplateFormatter.parse()."""

    def test_empty_template(self) -> None:
        """Test that empty template returns no variables."""
        formatter = MustacheTemplateFormatter()
        assert formatter.parse("") == set()

    def test_template_with_no_variables(self) -> None:
        """Test template with only plain text."""
        formatter = MustacheTemplateFormatter()
        assert formatter.parse("Hello, world!") == set()

    def test_template_with_only_sections(self) -> None:
        """Test template with only sections (no plain variables)."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}{{name}}{{/items}}"
        variables = formatter.parse(template)
        assert variables == {"items"}

    def test_inverted_section_at_top_level(self) -> None:
        """Test that inverted sections (^) are extracted at top level."""
        formatter = MustacheTemplateFormatter()
        template = "{{^items}}No items{{/items}}"
        variables = formatter.parse(template)
        assert "items" in variables

    def test_deeply_nested_sections(self) -> None:
        """Test deeply nested sections only extract top level."""
        formatter = MustacheTemplateFormatter()
        template = "{{#a}}{{#b}}{{#c}}{{deep}}{{/c}}{{/b}}{{/a}}{{top}}"
        variables = formatter.parse(template)
        assert variables == {"a", "top"}
        assert "b" not in variables
        assert "c" not in variables
        assert "deep" not in variables

    def test_multiple_escaped_sequences(self) -> None:
        """Test escaped sequences are treated as tags."""
        formatter = MustacheTemplateFormatter()
        template = r"\{{a}} and \{{b}} but {{real}}"
        variables = formatter.parse(template)
        assert variables == {"a", "b", "real"}

    def test_whitespace_variations(self) -> None:
        """Test various whitespace patterns in variables."""
        formatter = MustacheTemplateFormatter()
        template = "{{  a  }} {{   b}} {{c   }} {{ d }}"
        variables = formatter.parse(template)
        assert variables == {"a", "b", "c", "d"}

    def test_nested_property_extracts_root_only(self) -> None:
        """Test that nested properties (dot notation) extract only root variable.

        Mustache uses dot notation to traverse nested objects (e.g., user.name means
        context["user"]["name"]). For validation, we only need to check that the
        root variable exists.
        """
        formatter = MustacheTemplateFormatter()
        template = "{{user.name}} and {{user.email}}"
        variables = formatter.parse(template)
        # Should extract only "user", not the full dotted paths
        assert variables == {"user"}
        assert "user.name" not in variables
        assert "user.email" not in variables

    def test_section_with_dotted_path_extracts_root_only(self) -> None:
        """Test that sections with dotted paths extract only root variable.

        This is the pattern used by tool formatters like {{#output.available_tools}}.
        """
        formatter = MustacheTemplateFormatter()
        template = """{{#output.available_tools}}
- {{function.name}}: {{function.description}}
{{/output.available_tools}}
{{^output.available_tools}}
No tools available.
{{/output.available_tools}}"""
        variables = formatter.parse(template)
        # Should extract only "output", not "output.available_tools"
        assert variables == {"output"}
        assert "output.available_tools" not in variables

    def test_mixed_sections_and_variables(self) -> None:
        """Test complex template with mixed sections and variables."""
        formatter = MustacheTemplateFormatter()
        template = """
        {{header}}
        {{#items}}
        - {{name}}: {{value}}
        {{/items}}
        {{^items}}
        No items.
        {{/items}}
        {{footer}}
        """
        variables = formatter.parse(template)
        assert variables == {"header", "items", "footer"}
        assert "name" not in variables
        assert "value" not in variables

    def test_triple_braces_handled(self) -> None:
        """Test that triple braces (unescaped HTML in Mustache) extract variable."""
        formatter = MustacheTemplateFormatter()
        template = "{{{unescaped}}}"
        variables = formatter.parse(template)
        assert "unescaped" in variables

    def test_ampersand_unescaped_handled(self) -> None:
        """Test that ampersand tags extract variable."""
        formatter = MustacheTemplateFormatter()
        template = "{{& unescaped}}"
        variables = formatter.parse(template)
        assert variables == {"unescaped"}

    def test_adjacent_sections(self) -> None:
        """Test adjacent sections both get extracted."""
        formatter = MustacheTemplateFormatter()
        template = "{{#a}}content{{/a}}{{#b}}more{{/b}}"
        variables = formatter.parse(template)
        assert variables == {"a", "b"}

    def test_unclosed_section_still_extracts(self) -> None:
        """Test that unclosed sections still extract the section name."""
        formatter = MustacheTemplateFormatter()
        # Malformed template - unclosed section
        template = "{{#items}}{{name}}"
        variables = formatter.parse(template)
        # Should still extract items as top-level
        assert "items" in variables
        # name is nested, should not be extracted
        assert "name" not in variables

    def test_unmatched_closing_tag(self) -> None:
        """Test template with unmatched closing tag."""
        formatter = MustacheTemplateFormatter()
        # Malformed template - closing tag without opener
        template = "{{/orphan}}{{valid}}"
        variables = formatter.parse(template)
        # valid should be extracted, orphan closing tag is ignored
        assert "valid" in variables

    def test_comment_syntax_ignored(self) -> None:
        """Test that Mustache comments ({{! comment }}) don't add variables."""
        formatter = MustacheTemplateFormatter()
        template = "{{! This is a comment }}{{real}}"
        variables = formatter.parse(template)
        assert variables == {"real"}
