"""
Parity tests to ensure Python and TypeScript Mustache variable extraction behave identically.

These tests document the expected behavior that both implementations should follow.
The Python implementation is in phoenix.utilities.template_formatters.MustacheTemplateFormatter
The TypeScript implementation is in app/src/components/templateEditor/language/mustacheLike/

Both implementations should:
1. Extract only top-level variables (depth 0)
2. Track section depth using # and ^ as openers, / as closers
3. Treat backslash-prefixed tags (\\{{) as normal tags
4. Strip whitespace from variable names
5. Extract section names (the part after # or ^) when at top level
"""

import pytest

from phoenix.utilities.template_formatters import MustacheTemplateFormatter


class TestMustacheParserParity:
    """Tests ensuring Python parse() matches TypeScript extractVariablesFromMustacheLike()."""

    @pytest.mark.parametrize(
        "template, expected_variables",
        [
            # Simple variables
            pytest.param(
                "{{name}}",
                {"name"},
                id="simple-variable",
            ),
            pytest.param(
                "{{name}} and {{email}}",
                {"name", "email"},
                id="multiple-simple-variables",
            ),
            # Sections
            pytest.param(
                "{{#items}}{{name}}{{/items}}",
                {"items"},
                id="section-extracts-only-section-name",
            ),
            pytest.param(
                "{{#items}}{{name}}{{/items}}{{simple}}",
                {"items", "simple"},
                id="section-and-simple-variable",
            ),
            # Inverted sections
            pytest.param(
                "{{^items}}No items{{/items}}",
                {"items"},
                id="inverted-section-extracts-section-name",
            ),
            pytest.param(
                "{{#items}}{{name}}{{/items}}{{^items}}None{{/items}}",
                {"items"},
                id="section-and-inverted-section-same-name",
            ),
            # Nested sections
            pytest.param(
                "{{#outer}}{{#inner}}{{x}}{{/inner}}{{/outer}}",
                {"outer"},
                id="nested-sections-only-extract-outermost",
            ),
            pytest.param(
                "{{#a}}{{#b}}{{#c}}{{deep}}{{/c}}{{/b}}{{/a}}",
                {"a"},
                id="deeply-nested-sections",
            ),
            # Mixed content
            pytest.param(
                "{{header}}{{#list}}{{item}}{{/list}}{{footer}}",
                {"header", "list", "footer"},
                id="mixed-variables-and-sections",
            ),
            # Backslash-prefixed tags are treated as normal tags
            pytest.param(
                r"\{{escaped}}",
                {"escaped"},
                id="backslash-prefixed-variable-extracted",
            ),
            pytest.param(
                r"\{{escaped}} but {{real}}",
                {"escaped", "real"},
                id="backslash-prefixed-and-real-variable",
            ),
            pytest.param(
                r"\{{a}} \{{b}} {{c}}",
                {"a", "b", "c"},
                id="multiple-backslash-prefixed-and-real",
            ),
            # Whitespace handling
            pytest.param(
                "{{  name  }}",
                {"name"},
                id="whitespace-both-sides",
            ),
            pytest.param(
                "{{   name}}",
                {"name"},
                id="whitespace-left-only",
            ),
            pytest.param(
                "{{name   }}",
                {"name"},
                id="whitespace-right-only",
            ),
            pytest.param(
                "{{ #items }}{{name}}{{ /items }}",
                {"items"},
                id="whitespace-in-section-tags",
            ),
            # Nested properties (dot notation) - only root variable is extracted
            # Mustache uses dots to traverse nested objects (user.name means context["user"]["name"])
            # For validation, we only need the root variable to exist
            pytest.param(
                "{{user.name}}",
                {"user"},
                id="nested-property-extracts-root-only",
            ),
            pytest.param(
                "{{function.name}}: {{function.description}}",
                {"function"},
                id="nested-property-multiple-same-root",
            ),
            pytest.param(
                "{{user.name}} and {{account.id}}",
                {"user", "account"},
                id="nested-property-different-roots",
            ),
            pytest.param(
                "{{#tool}}{{function.name}}{{/tool}}",
                {"tool"},
                id="nested-property-inside-section",
            ),
            pytest.param(
                "{{#output.available_tools}}{{function.name}}{{/output.available_tools}}",
                {"output"},
                id="section-with-dotted-path-extracts-root",
            ),
            # Complex real-world patterns
            pytest.param(
                """{{#available_tools}}
- {{function.name}}: {{function.description}}
{{/available_tools}}
{{^available_tools}}
No tools available.
{{/available_tools}}""",
                {"available_tools"},
                id="tool-formatter-pattern",
            ),
            pytest.param(
                """{{#messages}}
{{role}}: {{content}}
{{#tool_calls}}
- {{function.name}}({{function.arguments}})
{{/tool_calls}}
{{/messages}}""",
                {"messages"},
                id="messages-with-nested-tool-calls",
            ),
            # Edge cases
            pytest.param(
                "",
                set(),
                id="empty-template",
            ),
            pytest.param(
                "No variables here",
                set(),
                id="no-variables",
            ),
            pytest.param(
                "{{#a}}{{/a}}{{#b}}{{/b}}",
                {"a", "b"},
                id="adjacent-sections",
            ),
            pytest.param(
                "{{#a}}content{{/a}}{{b}}{{#c}}more{{/c}}",
                {"a", "b", "c"},
                id="sections-and-variables-interleaved",
            ),
            # Section depth tracking edge cases
            pytest.param(
                "{{#outer}}{{middle}}{{/outer}}{{after}}",
                {"outer", "after"},
                id="variable-after-section-closing",
            ),
            pytest.param(
                "{{before}}{{#section}}{{inside}}{{/section}}{{after}}",
                {"before", "section", "after"},
                id="variables-before-and-after-section",
            ),
        ],
    )
    def test_variable_extraction_parity(self, template: str, expected_variables: set[str]) -> None:
        """
        Test that Python extracts the same variables as expected.

        The expected_variables represent what both Python and TypeScript
        implementations should extract from the given template.
        """
        formatter = MustacheTemplateFormatter()
        actual_variables = formatter.parse(template)
        assert actual_variables == expected_variables


class TestMustacheParserDepthTracking:
    """Tests specifically for depth tracking logic with valid templates."""

    def test_depth_increments_on_section_open(self) -> None:
        """Verify that # increases depth - variables inside sections are not extracted."""
        formatter = MustacheTemplateFormatter()
        # Variable inside section should not be extracted (only top-level)
        template = "{{#section}}{{nested}}{{/section}}"
        variables = formatter.parse(template)
        assert "section" in variables
        assert "nested" not in variables

    def test_depth_increments_on_inverted_section_open(self) -> None:
        """Verify that ^ increases depth - variables inside inverted sections are not extracted."""
        formatter = MustacheTemplateFormatter()
        # Variable inside inverted section should not be extracted
        template = "{{^section}}{{nested}}{{/section}}"
        variables = formatter.parse(template)
        assert "section" in variables
        assert "nested" not in variables

    def test_depth_decrements_on_section_close(self) -> None:
        """Verify that / decreases depth back to 0."""
        formatter = MustacheTemplateFormatter()
        template = "{{#section}}{{nested}}{{/section}}{{after}}"
        variables = formatter.parse(template)
        assert "section" in variables
        assert "nested" not in variables
        assert "after" in variables

    def test_malformed_template_raises_error(self) -> None:
        """Verify that malformed templates (unclosed sections, orphan closers) raise errors."""
        from phoenix.utilities.template_formatters import TemplateFormatterError

        formatter = MustacheTemplateFormatter()

        # Unclosed section should raise error
        with pytest.raises(TemplateFormatterError):
            formatter.parse("{{#section}}{{nested}}")

        # Orphan closing tag should raise error
        with pytest.raises(TemplateFormatterError):
            formatter.parse("{{/orphan}}{{valid}}")

    def test_multiple_depth_levels(self) -> None:
        """Verify correct tracking through multiple nesting levels."""
        formatter = MustacheTemplateFormatter()
        template = "{{a}}{{#b}}{{c}}{{#d}}{{e}}{{/d}}{{f}}{{/b}}{{g}}"
        variables = formatter.parse(template)
        # Only a and g should be extracted (depth 0)
        # b is a section opener at depth 0
        assert variables == {"a", "b", "g"}
