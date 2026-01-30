from typing import Any

import pytest

from phoenix.utilities.template_formatters import (
    DictWrapper,
    FStringTemplateFormatter,
    ListWrapper,
    MustacheTemplateFormatter,
    ParsedVariable,
    ParsedVariables,
    TemplateFormatter,
    TemplateFormatterError,
    _extract_root_variable,
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

    def test_unclosed_section_raises(self) -> None:
        """Test that unclosed sections raise a parsing error."""
        formatter = MustacheTemplateFormatter()
        # Malformed template - unclosed section
        template = "{{#items}}{{name}}"
        with pytest.raises(TemplateFormatterError):
            formatter.parse(template)

    def test_unmatched_closing_tag(self) -> None:
        """Test template with unmatched closing tag raises an error."""
        formatter = MustacheTemplateFormatter()
        # Malformed template - closing tag without opener
        template = "{{/orphan}}{{valid}}"
        with pytest.raises(TemplateFormatterError):
            formatter.parse(template)

    def test_comment_syntax_ignored(self) -> None:
        """Test that Mustache comments ({{! comment }}) don't add variables."""
        formatter = MustacheTemplateFormatter()
        template = "{{! This is a comment }}{{real}}"
        variables = formatter.parse(template)
        assert variables == {"real"}


class TestMustacheParseWithTypes:
    """Tests for MustacheTemplateFormatter.parse_with_types()."""

    def test_simple_variables_are_string_type(self) -> None:
        """Test that simple variables ({{name}}) are typed as string."""
        formatter = MustacheTemplateFormatter()
        template = "Hello {{name}}, your score is {{score}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"name", "score"}
        assert parsed.string_variables() == {"name", "score"}
        assert parsed.section_variables() == set()

    def test_section_variables_are_section_type(self) -> None:
        """Test that section variables ({{#items}}) are typed as section."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}- {{name}}{{/items}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"items"}
        assert parsed.section_variables() == {"items"}
        assert parsed.string_variables() == set()

    def test_inverted_section_variables_are_section_type(self) -> None:
        """Test that inverted section variables ({{^items}}) are typed as section."""
        formatter = MustacheTemplateFormatter()
        template = "{{^items}}No items{{/items}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"items"}
        assert parsed.section_variables() == {"items"}
        assert parsed.string_variables() == set()

    def test_mixed_template_has_correct_types(self) -> None:
        """Test template with both sections and simple variables."""
        formatter = MustacheTemplateFormatter()
        template = """
        Header: {{title}}
        {{#items}}
        - {{name}}: {{value}}
        {{/items}}
        Footer: {{footer}}
        """
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"title", "items", "footer"}
        assert parsed.section_variables() == {"items"}
        assert parsed.string_variables() == {"title", "footer"}

    def test_nested_sections_only_extract_top_level(self) -> None:
        """Test that nested sections are not extracted."""
        formatter = MustacheTemplateFormatter()
        template = "{{#outer}}{{#inner}}{{deep}}{{/inner}}{{/outer}}{{top}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"outer", "top"}
        assert parsed.section_variables() == {"outer"}
        assert parsed.string_variables() == {"top"}
        assert "inner" not in parsed.names()
        assert "deep" not in parsed.names()

    def test_empty_template(self) -> None:
        """Test that empty template returns empty result."""
        formatter = MustacheTemplateFormatter()
        parsed = formatter.parse_with_types("")

        assert parsed.names() == set()
        assert parsed.section_variables() == set()
        assert parsed.string_variables() == set()

    def test_escaped_sequences_ignored(self) -> None:
        """Test that escaped sequences (\\{{) are treated as tags."""
        formatter = MustacheTemplateFormatter()
        template = r"\{{escaped}} and {{real}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"escaped", "real"}
        assert parsed.string_variables() == {"escaped", "real"}

    def test_section_and_inverted_section_same_variable(self) -> None:
        """Test variable used as both section and inverted section."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}Has items{{/items}}{{^items}}No items{{/items}}"
        parsed = formatter.parse_with_types(template)

        # Should only appear once in section_variables
        assert parsed.names() == {"items"}
        assert parsed.section_variables() == {"items"}
        assert parsed.string_variables() == set()

    def test_adjacent_sections_both_extracted(self) -> None:
        """Test that adjacent sections are both extracted."""
        formatter = MustacheTemplateFormatter()
        template = "{{#a}}content{{/a}}{{#b}}more{{/b}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"a", "b"}
        assert parsed.section_variables() == {"a", "b"}

    def test_names_method_returns_all_variables(self) -> None:
        """Test that names() returns all variable names regardless of type."""
        formatter = MustacheTemplateFormatter()
        template = "{{simple}}{{#section}}nested{{/section}}"
        parsed = formatter.parse_with_types(template)

        all_names = parsed.names()
        assert all_names == {"simple", "section"}
        assert all_names == parsed.section_variables() | parsed.string_variables()

    def test_unescaped_triple_brace_is_string_type(self) -> None:
        """Test that triple-brace unescaped variables ({{{name}}}) are typed as string."""
        formatter = MustacheTemplateFormatter()
        template = "{{{unescaped}}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"unescaped"}
        assert parsed.string_variables() == {"unescaped"}
        assert parsed.section_variables() == set()

    def test_unescaped_ampersand_is_string_type(self) -> None:
        """Test that ampersand unescaped variables ({{& name}}) are typed as string."""
        formatter = MustacheTemplateFormatter()
        template = "{{& unescaped}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"unescaped"}
        assert parsed.string_variables() == {"unescaped"}
        assert parsed.section_variables() == set()

    def test_mixed_escaped_and_unescaped_all_string_type(self) -> None:
        """Test that all variable syntaxes (escaped and unescaped) are typed as string."""
        formatter = MustacheTemplateFormatter()
        template = "{{escaped}} {{{triple}}} {{& ampersand}}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"escaped", "triple", "ampersand"}
        assert parsed.string_variables() == {"escaped", "triple", "ampersand"}
        assert parsed.section_variables() == set()


class TestFStringParseWithTypes:
    """Tests for FStringTemplateFormatter.parse_with_types() (default implementation)."""

    def test_all_variables_are_string_type(self) -> None:
        """Test that FString formatter treats all variables as string (default)."""
        formatter = FStringTemplateFormatter()
        template = "Hello {name}, your score is {score}"
        parsed = formatter.parse_with_types(template)

        assert parsed.names() == {"name", "score"}
        assert parsed.string_variables() == {"name", "score"}
        assert parsed.section_variables() == set()


class TestParsedVariablesDataclass:
    """Tests for the ParsedVariables dataclass."""

    def test_parsed_variables_frozenset(self) -> None:
        """Test that ParsedVariables uses frozenset for immutability."""
        var1 = ParsedVariable(name="test", variable_type="string")
        var2 = ParsedVariable(name="items", variable_type="section")
        parsed = ParsedVariables(variables=frozenset([var1, var2]))

        assert len(parsed.variables) == 2
        assert var1 in parsed.variables
        assert var2 in parsed.variables

    def test_parsed_variable_frozen(self) -> None:
        """Test that ParsedVariable is frozen (immutable)."""
        var = ParsedVariable(name="test", variable_type="string")
        with pytest.raises(AttributeError):
            var.name = "changed"  # type: ignore[misc]


class TestMustachePathVariables:
    """Tests for Mustache path variable support (e.g., {{reference.label}})."""

    def test_simple_path_variable_with_dict(self) -> None:
        """Test that path variables work with nested dicts."""
        formatter = MustacheTemplateFormatter()
        template = "{{reference.label}}"
        variables = {"reference": {"label": "correct"}}
        result = formatter.format(template, **variables)
        assert result == "correct"

    def test_multi_level_path_variable(self) -> None:
        """Test deeply nested path variables."""
        formatter = MustacheTemplateFormatter()
        template = "{{user.address.city}}"
        variables = {"user": {"address": {"city": "New York"}}}
        result = formatter.format(template, **variables)
        assert result == "New York"

    def test_multiple_path_variables_same_root(self) -> None:
        """Test multiple path variables with the same root object."""
        formatter = MustacheTemplateFormatter()
        template = "{{user.name}} lives in {{user.city}}"
        variables = {"user": {"name": "Alice", "city": "Boston"}}
        result = formatter.format(template, **variables)
        assert result == "Alice lives in Boston"

    def test_path_variable_with_other_variables(self) -> None:
        """Test path variables mixed with simple variables."""
        formatter = MustacheTemplateFormatter()
        template = "Hello {{name}}, your label is {{reference.label}}"
        variables = {"name": "Bob", "reference": {"label": "A"}}
        result = formatter.format(template, **variables)
        assert result == "Hello Bob, your label is A"

    def test_path_variable_validation_passes_with_root(self) -> None:
        """Test that validation passes when root variable is provided."""
        formatter = MustacheTemplateFormatter()
        template = "{{reference.label}}"
        # Should not raise - 'reference' is provided
        result = formatter.format(template, reference={"label": "value"})
        assert result == "value"

    def test_path_variable_validation_fails_without_root(self) -> None:
        """Test that validation fails when root variable is missing."""
        formatter = MustacheTemplateFormatter()
        template = "{{reference.label}}"
        with pytest.raises(
            TemplateFormatterError, match=r"Missing template variable\(s\): reference"
        ):
            formatter.format(template)

    def test_full_context_pattern(self) -> None:
        """Test the full_context pattern used in playground."""
        formatter = MustacheTemplateFormatter()
        template = "Input: {{input.question}}\nExpected: {{reference.label}}"
        full_context = {
            "input": {"question": "What is 2+2?"},
            "reference": {"label": "4"},
            "metadata": {},
        }
        result = formatter.format(template, **full_context)
        assert result == "Input: What is 2+2?\nExpected: 4"

    def test_path_variable_inside_section(self) -> None:
        """Test path variables inside sections."""
        formatter = MustacheTemplateFormatter()
        template = "{{#items}}{{data.value}}{{/items}}"
        variables = {"items": [{"data": {"value": "a"}}, {"data": {"value": "b"}}]}
        result = formatter.format(template, **variables)
        assert result == "ab"


class TestExtractRootVariable:
    """Tests for the _extract_root_variable helper function."""

    def test_simple_variable(self) -> None:
        """Test extracting root from simple variable name."""
        assert _extract_root_variable("name") == "name"

    def test_single_dot_path(self) -> None:
        """Test extracting root from single-level path."""
        assert _extract_root_variable("reference.label") == "reference"

    def test_multi_level_path(self) -> None:
        """Test extracting root from multi-level path."""
        assert _extract_root_variable("user.address.city") == "user"

    def test_bracket_notation(self) -> None:
        """Test extracting root from bracket notation."""
        assert _extract_root_variable("reference[label]") == "reference"

    def test_numeric_index(self) -> None:
        """Test extracting root from numeric index."""
        assert _extract_root_variable("items[0]") == "items"

    def test_mixed_notation(self) -> None:
        """Test extracting root from mixed dot and bracket notation."""
        assert _extract_root_variable("user.addresses[0].city") == "user"

    def test_bracket_then_dot(self) -> None:
        """Test extracting root from bracket followed by dot notation."""
        assert _extract_root_variable("items[0].name") == "items"


class TestFStringPathVariables:
    """Tests for F-string path variable support with dict wrapping."""

    def test_simple_path_variable_with_dict(self) -> None:
        """Test that path variables work with nested dicts."""
        formatter = FStringTemplateFormatter()
        template = "{reference.label}"
        variables = {"reference": {"label": "correct"}}
        result = formatter.format(template, **variables)
        assert result == "correct"

    def test_multi_level_path_variable(self) -> None:
        """Test deeply nested path variables."""
        formatter = FStringTemplateFormatter()
        template = "{user.address.city}"
        variables = {"user": {"address": {"city": "New York"}}}
        result = formatter.format(template, **variables)
        assert result == "New York"

    def test_multiple_path_variables_same_root(self) -> None:
        """Test multiple path variables with the same root object."""
        formatter = FStringTemplateFormatter()
        template = "{user.name} lives in {user.city}"
        variables = {"user": {"name": "Alice", "city": "Boston"}}
        result = formatter.format(template, **variables)
        assert result == "Alice lives in Boston"

    def test_path_variable_with_other_variables(self) -> None:
        """Test path variables mixed with simple variables."""
        formatter = FStringTemplateFormatter()
        template = "Hello {name}, your label is {reference.label}"
        variables = {"name": "Bob", "reference": {"label": "A"}}
        result = formatter.format(template, **variables)
        assert result == "Hello Bob, your label is A"

    def test_path_variable_validation_passes_with_root(self) -> None:
        """Test that validation passes when root variable is provided."""
        formatter = FStringTemplateFormatter()
        template = "{reference.label}"
        # Should not raise - 'reference' is provided
        result = formatter.format(template, reference={"label": "value"})
        assert result == "value"

    def test_path_variable_validation_fails_without_root(self) -> None:
        """Test that validation fails when root variable is missing."""
        formatter = FStringTemplateFormatter()
        template = "{reference.label}"
        with pytest.raises(
            TemplateFormatterError, match=r"Missing template variable\(s\): reference"
        ):
            formatter.format(template)

    def test_bracket_notation_with_dict(self) -> None:
        """Test bracket notation for dict access."""
        formatter = FStringTemplateFormatter()
        template = "{reference[label]}"
        variables = {"reference": {"label": "bracket_value"}}
        result = formatter.format(template, **variables)
        assert result == "bracket_value"

    def test_numeric_index_with_list(self) -> None:
        """Test numeric index access with lists."""
        formatter = FStringTemplateFormatter()
        template = "{items[0]}"
        variables = {"items": ["first", "second"]}
        result = formatter.format(template, **variables)
        assert result == "first"

    def test_mixed_list_and_dict_access(self) -> None:
        """Test accessing dict inside list."""
        formatter = FStringTemplateFormatter()
        template = "{items[0].name}"
        variables = {"items": [{"name": "Alice"}, {"name": "Bob"}]}
        result = formatter.format(template, **variables)
        assert result == "Alice"

    def test_full_context_pattern(self) -> None:
        """Test the full_context pattern used in playground."""
        formatter = FStringTemplateFormatter()
        template = "Input: {input.question}\nExpected: {reference.label}"
        full_context = {
            "input": {"question": "What is 2+2?"},
            "reference": {"label": "4"},
            "metadata": {},
        }
        result = formatter.format(template, **full_context)
        assert result == "Input: What is 2+2?\nExpected: 4"

    def test_non_dict_values_unchanged(self) -> None:
        """Test that non-dict values pass through unchanged."""
        formatter = FStringTemplateFormatter()
        template = "{name} is {age} years old"
        variables = {"name": "Alice", "age": 30}
        result = formatter.format(template, **variables)
        assert result == "Alice is 30 years old"

    def test_list_serializes_to_json_not_wrapper(self) -> None:
        """Test that lists serialize to JSON, not wrapper class name."""
        formatter = FStringTemplateFormatter()
        template = "{input.messages}"
        variables = {"input": {"messages": [{"role": "user", "content": "Hello"}]}}
        result = formatter.format(template, **variables)
        # Should be JSON, not "ListWrapper([...])"
        assert "ListWrapper" not in result
        assert '"role"' in result
        assert '"user"' in result
        assert '"content"' in result
        assert '"Hello"' in result

    def test_dict_serializes_to_json_not_wrapper(self) -> None:
        """Test that dicts serialize to JSON, not wrapper class name."""
        formatter = FStringTemplateFormatter()
        template = "{user}"
        variables = {"user": {"name": "Alice", "age": 30}}
        result = formatter.format(template, **variables)
        # Should be JSON, not "DictWrapper({...})"
        assert "DictWrapper" not in result
        assert '"name"' in result
        assert '"Alice"' in result

    def test_string_value_not_quoted(self) -> None:
        """Test that string values are not wrapped in quotes."""
        formatter = FStringTemplateFormatter()
        template = "{user.name}"
        variables = {"user": {"name": "Alice"}}
        result = formatter.format(template, **variables)
        # String should be plain, not JSON quoted
        assert result == "Alice"
        assert '"Alice"' not in result

    def test_deeply_nested_list_serializes_correctly(self) -> None:
        """Test deeply nested structure serializes correctly."""
        formatter = FStringTemplateFormatter()
        template = "{input.input.input.messages}"
        variables = {
            "input": {"input": {"input": {"messages": [{"role": "user", "content": "Hello"}]}}}
        }
        result = formatter.format(template, **variables)
        # Should be JSON array
        assert result.startswith("[")
        assert result.endswith("]")
        assert "ListWrapper" not in result
        assert '"role"' in result


class TestDictWrapper:
    """Tests for the DictWrapper class."""

    def test_attribute_access(self) -> None:
        """Test attribute access on wrapped dict."""
        wrapper = DictWrapper({"name": "Alice"})
        assert wrapper.name == "Alice"

    def test_nested_attribute_access(self) -> None:
        """Test nested attribute access returns wrapped dict."""
        wrapper = DictWrapper({"user": {"name": "Alice"}})
        assert wrapper.user.name == "Alice"

    def test_key_access(self) -> None:
        """Test key access on wrapped dict."""
        wrapper = DictWrapper({"name": "Alice"})
        assert wrapper["name"] == "Alice"

    def test_nested_key_access(self) -> None:
        """Test nested key access."""
        wrapper = DictWrapper({"user": {"name": "Alice"}})
        assert wrapper["user"]["name"] == "Alice"

    def test_mixed_access(self) -> None:
        """Test mixed attribute and key access."""
        wrapper = DictWrapper({"user": {"name": "Alice"}})
        assert wrapper.user["name"] == "Alice"
        assert wrapper["user"].name == "Alice"

    def test_missing_key_raises_attribute_error(self) -> None:
        """Test that missing key raises AttributeError for attribute access."""
        wrapper = DictWrapper({"name": "Alice"})
        with pytest.raises(AttributeError):
            _ = wrapper.missing

    def test_missing_key_raises_key_error_for_bracket(self) -> None:
        """Test that missing key raises KeyError for bracket access."""
        wrapper = DictWrapper({"name": "Alice"})
        with pytest.raises(KeyError):
            _ = wrapper["missing"]

    def test_repr(self) -> None:
        """Test string representation."""
        wrapper = DictWrapper({"name": "Alice"})
        assert "DictWrapper" in repr(wrapper)
        assert "name" in repr(wrapper)

    def test_str_serializes_to_json(self) -> None:
        """Test that str() serializes the dict to JSON."""
        wrapper = DictWrapper({"name": "Alice", "age": 30})
        result = str(wrapper)
        assert '"name"' in result
        assert '"Alice"' in result
        assert '"age"' in result
        assert "30" in result
        # Should not contain wrapper class name
        assert "DictWrapper" not in result

    def test_str_nested_dict(self) -> None:
        """Test that str() works with nested dicts."""
        wrapper = DictWrapper({"user": {"name": "Alice"}})
        result = str(wrapper)
        assert '"user"' in result
        assert '"name"' in result
        assert '"Alice"' in result


class TestListWrapper:
    """Tests for the ListWrapper class."""

    def test_index_access(self) -> None:
        """Test index access on wrapped list."""
        wrapper = ListWrapper(["a", "b", "c"])
        assert wrapper[0] == "a"
        assert wrapper[1] == "b"

    def test_nested_dict_in_list(self) -> None:
        """Test dict inside list is wrapped."""
        wrapper = ListWrapper([{"name": "Alice"}, {"name": "Bob"}])
        assert wrapper[0].name == "Alice"
        assert wrapper[1].name == "Bob"

    def test_nested_list_in_list(self) -> None:
        """Test list inside list is wrapped."""
        wrapper = ListWrapper([[1, 2], [3, 4]])
        assert wrapper[0][0] == 1
        assert wrapper[1][1] == 4

    def test_repr(self) -> None:
        """Test string representation."""
        wrapper = ListWrapper([1, 2, 3])
        assert "ListWrapper" in repr(wrapper)

    def test_str_serializes_to_json(self) -> None:
        """Test that str() serializes the list to JSON."""
        wrapper = ListWrapper([1, 2, 3])
        result = str(wrapper)
        assert result == "[1, 2, 3]"
        # Should not contain wrapper class name
        assert "ListWrapper" not in result

    def test_str_nested_dicts(self) -> None:
        """Test that str() works with nested dicts in list."""
        wrapper = ListWrapper([{"role": "user", "content": "Hello"}])
        result = str(wrapper)
        assert '"role"' in result
        assert '"user"' in result
        assert '"content"' in result
        assert '"Hello"' in result
        assert "ListWrapper" not in result
