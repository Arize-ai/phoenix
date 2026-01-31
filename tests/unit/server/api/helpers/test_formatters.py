"""Tests for formatter expansion logic."""

from phoenix.server.api.helpers.formatters import (
    expand_config_templates,
    expand_template_placeholders,
    load_formatters,
)


class TestLoadFormatters:
    def test_load_formatters_returns_dict(self) -> None:
        """Test that load_formatters returns a dictionary."""
        formatters = load_formatters()
        assert isinstance(formatters, dict)

    def test_load_formatters_contains_expected_keys(self) -> None:
        """Test that the loaded formatters contain the expected formatter names."""
        formatters = load_formatters()
        assert "available_tools_descriptions" in formatters
        assert "tool_calls_to_string" in formatters


class TestExpandTemplatePlaceholders:
    def test_expand_single_placeholder(self) -> None:
        """Test expanding a single placeholder."""
        template = "Tools: {{available_tools}}"
        formatters_mapping = {"available_tools": "tools_formatter"}
        formatters = {"tools_formatter": "{{#tools}}{{name}}{{/tools}}"}

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Tools: {{#tools}}{{name}}{{/tools}}"

    def test_expand_multiple_placeholders(self) -> None:
        """Test expanding multiple placeholders."""
        template = "Tools: {{available_tools}}\nCalls: {{tool_calls}}"
        formatters_mapping = {
            "available_tools": "tools_formatter",
            "tool_calls": "calls_formatter",
        }
        formatters = {
            "tools_formatter": "[TOOLS]",
            "calls_formatter": "[CALLS]",
        }

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Tools: [TOOLS]\nCalls: [CALLS]"

    def test_expand_with_whitespace_in_placeholder(self) -> None:
        """Test that placeholders with whitespace are expanded."""
        template = "Tools: {{ available_tools }}"
        formatters_mapping = {"available_tools": "tools_formatter"}
        formatters = {"tools_formatter": "[TOOLS]"}

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Tools: [TOOLS]"

    def test_expand_leaves_unmapped_placeholders(self) -> None:
        """Test that placeholders not in the mapping are left unchanged."""
        template = "Input: {{input}}\nTools: {{available_tools}}"
        formatters_mapping = {"available_tools": "tools_formatter"}
        formatters = {"tools_formatter": "[TOOLS]"}

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Input: {{input}}\nTools: [TOOLS]"

    def test_expand_with_missing_formatter_definition(self) -> None:
        """Test that missing formatter definitions are skipped."""
        template = "Tools: {{available_tools}}"
        formatters_mapping = {"available_tools": "nonexistent_formatter"}
        formatters = {"tools_formatter": "[TOOLS]"}

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Tools: {{available_tools}}"

    def test_expand_empty_mapping(self) -> None:
        """Test that empty mapping leaves template unchanged."""
        template = "Tools: {{available_tools}}"
        formatters_mapping: dict[str, str] = {}
        formatters = {"tools_formatter": "[TOOLS]"}

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Tools: {{available_tools}}"

    def test_expand_with_special_regex_characters_in_placeholder(self) -> None:
        """Test that placeholder names with regex special chars are handled."""
        template = "Test: {{my.placeholder}}"
        formatters_mapping = {"my.placeholder": "formatter"}
        formatters = {"formatter": "[REPLACED]"}

        result = expand_template_placeholders(template, formatters_mapping, formatters)
        assert result == "Test: [REPLACED]"


class TestExpandConfigTemplates:
    def test_expand_config_with_formatters(self) -> None:
        """Test that config templates are expanded when formatters are defined."""
        from phoenix.__generated__.classification_evaluator_configs import (
            ClassificationEvaluatorConfig,
            PromptMessage,
        )

        config = ClassificationEvaluatorConfig(
            name="test",
            description="Test evaluator",
            optimization_direction="maximize",
            messages=[PromptMessage(role="user", content="Tools: {{available_tools}}")],
            choices={"yes": 1.0, "no": 0.0},
            formatters={"available_tools": "available_tools_descriptions"},
        )

        expanded = expand_config_templates(config)

        # The placeholder should be expanded to the full Mustache block
        assert "{{#available_tools}}" in expanded.messages[0].content
        assert "{{function.name}}" in expanded.messages[0].content

    def test_expand_config_without_formatters_unchanged(self) -> None:
        """Test that configs without formatters are returned unchanged."""
        from phoenix.__generated__.classification_evaluator_configs import (
            ClassificationEvaluatorConfig,
            PromptMessage,
        )

        config = ClassificationEvaluatorConfig(
            name="test",
            description="Test evaluator",
            optimization_direction="maximize",
            messages=[PromptMessage(role="user", content="Input: {{input}}")],
            choices={"yes": 1.0, "no": 0.0},
            formatters=None,
        )

        result = expand_config_templates(config)

        # Config should be unchanged
        assert result.messages[0].content == "Input: {{input}}"


class TestClassificationEvaluatorConfigsLoading:
    def test_tool_selection_config_has_expanded_formatters(self) -> None:
        """Test that tool_selection config has expanded formatter placeholders."""
        from phoenix.server.api.helpers.classification_evaluator_configs import (
            get_classification_evaluator_configs,
        )

        configs = get_classification_evaluator_configs()
        tool_sel = next(c for c in configs if c.name == "tool_selection")

        # The available_tools placeholder should be expanded
        content = tool_sel.messages[0].content
        assert "{{#available_tools}}" in content
        assert "{{function.name}}" in content
        assert "{{^available_tools}}" in content

    def test_non_tool_configs_unchanged(self) -> None:
        """Test that configs without formatters have simple placeholders."""
        from phoenix.server.api.helpers.classification_evaluator_configs import (
            get_classification_evaluator_configs,
        )

        configs = get_classification_evaluator_configs()
        correctness = next(c for c in configs if c.name == "correctness")

        # Should have simple placeholders, not expanded sections
        content = correctness.messages[0].content
        assert "{{input}}" in content
        assert "{{output}}" in content
        # Should NOT have section syntax
        assert "{{#" not in content
