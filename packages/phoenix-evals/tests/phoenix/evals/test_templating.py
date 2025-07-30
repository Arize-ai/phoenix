import pytest

from phoenix.evals.templating import (
    FormatterFactory,
    FStringFormatter,
    MustacheFormatter,
    Template,
    TemplateFormat,
    detect_template_format,
)


class TestTemplateFormatDetection:
    """Tests for auto-detection of template formats."""

    def test_clear_mustache_detection(self):
        """Test detection of clear mustache patterns."""
        test_cases = [
            "Hello {{name}}",
            "{{user}} said: {{message}}",
            "Welcome {{first_name}} {{last_name}}",
            "Data: {{data}} and more {{info}}",
        ]

        for template in test_cases:
            detected = detect_template_format(template)
            assert detected == TemplateFormat.MUSTACHE, f"Failed for: {template}"

    def test_clear_fstring_detection(self):
        """Test detection of clear f-string patterns."""
        test_cases = [
            "Hello {name}",
            "{user} said: {message}",
            "Welcome {first_name} {last_name}",
            "Process {data} and {info}",
        ]

        for template in test_cases:
            detected = detect_template_format(template)
            assert detected == TemplateFormat.F_STRING, f"Failed for: {template}"

    def test_json_with_fstring_detection(self):
        """Test detection when JSON is mixed with f-string variables."""
        test_cases = [
            (
                'Analyze this: {"type": "data", "value": 123} for user {user_id}',
                TemplateFormat.F_STRING,
            ),
            ('Config: {"debug": true, "timeout": 30} in {environment}', TemplateFormat.F_STRING),
            ('Data: {"items": [1, 2, 3]} processed by {processor}', TemplateFormat.F_STRING),
            ('Settings: {"nested": {"key": "value"}} for {service}', TemplateFormat.F_STRING),
        ]

        for template, expected in test_cases:
            detected = detect_template_format(template)
            assert detected == expected, f"Failed for: {template}"

    def test_ambiguous_cases_default_to_mustache(self):
        """Test that ambiguous cases (escaped JSON only) default to mustache."""
        test_cases = [
            'Pure JSON: {{"key": "value"}}',
            '{{"debug": true, "timeout": 30}}',
            '{{"items": [1, 2, 3], "count": 3}}',
            'Config: {{"nested": {{"key": "value"}}}}',
        ]

        for template in test_cases:
            detected = detect_template_format(template)
            assert detected == TemplateFormat.MUSTACHE, f"Failed for: {template}"

    def test_mixed_patterns_prefer_mustache(self):
        """Test that when both clear patterns exist, mustache is preferred."""
        test_cases = [
            "User {{user}} and {env}",  # Clear mustache + clear f-string
            "{{name}} in environment {env}",
            "Welcome {{user}} with config {config}",
        ]

        for template in test_cases:
            detected = detect_template_format(template)
            assert detected == TemplateFormat.MUSTACHE, f"Failed for: {template}"

    def test_escaped_json_with_fstring_prefers_fstring(self):
        """Test that escaped JSON + clear f-string prefers f-string."""
        test_cases = [
            'Config: {{"debug": true}} for {environment}',
            'Data: {{"items": [1, 2, 3]}} processed by {processor}',
            'JSON: {{"key": "value"}} and user {user_id}',
        ]

        for template in test_cases:
            detected = detect_template_format(template)
            assert detected == TemplateFormat.F_STRING, f"Failed for: {template}"

    def test_no_variables_defaults_to_mustache(self):
        """Test that templates with no variables default to mustache."""
        test_cases = [
            "No variables here",
            "Just plain text",
            "Empty braces: {}",
            "Numbers: {123} and {456}",
            "Booleans: {true} and {false}",
        ]

        for template in test_cases:
            detected = detect_template_format(template)
            assert detected == TemplateFormat.MUSTACHE, f"Failed for: {template}"


class TestMustacheFormatter:
    """Tests for MustacheFormatter functionality."""

    def test_render_with_simple_variables(self):
        formatter = MustacheFormatter()
        template = "Hello {{name}}, welcome to {{place}}"
        variables = {"name": "Alice", "place": "Phoenix"}

        result = formatter.render(template, variables)
        assert result == "Hello Alice, welcome to Phoenix"

    def test_render_with_missing_variables(self):
        formatter = MustacheFormatter()
        template = "Hello {{name}}, welcome to {{place}}"
        variables = {"name": "Alice"}

        result = formatter.render(template, variables)
        assert "Alice" in result

    def test_extract_variables(self):
        formatter = MustacheFormatter()
        template = "Hello {{name}}, welcome to {{place}} and {{name}}"

        variables = formatter.extract_variables(template)
        assert set(variables) == {"name", "place"}

    def test_extract_variables_with_whitespace(self):
        formatter = MustacheFormatter()
        template = "Hello {{ name }}, welcome to {{  place  }}"

        variables = formatter.extract_variables(template)
        assert set(variables) == {"name", "place"}


class TestFStringFormatter:
    """Tests for FStringFormatter functionality."""

    def test_render_with_simple_variables(self):
        formatter = FStringFormatter()
        template = "Hello {name}, welcome to {place}"
        variables = {"name": "Alice", "place": "Phoenix"}

        result = formatter.render(template, variables)
        assert result == "Hello Alice, welcome to Phoenix"

    def test_render_with_json_content(self):
        """Test that f-string formatter handles JSON content correctly."""
        formatter = FStringFormatter()
        template = 'Process data: {"config": {"debug": true}} for user {user_id}'
        variables = {"user_id": "123"}

        result = formatter.render(template, variables)
        expected = 'Process data: {"config": {"debug": true}} for user 123'
        assert result == expected

    def test_render_with_complex_json(self):
        """Test f-string formatter with complex JSON structures."""
        formatter = FStringFormatter()
        template = 'Data: {"items": [1, 2, 3], "meta": {"count": 3}} in {environment}'
        variables = {"environment": "production"}

        result = formatter.render(template, variables)
        expected = 'Data: {"items": [1, 2, 3], "meta": {"count": 3}} in production'
        assert result == expected

    def test_extract_variables_excludes_json(self):
        """Test that variable extraction excludes JSON content."""
        formatter = FStringFormatter()
        template = 'Config: {"debug": true, "timeout": 30} for {environment} and {user}'

        variables = formatter.extract_variables(template)
        assert set(variables) == {"environment", "user"}

    def test_extract_variables_excludes_numbers_and_booleans(self):
        formatter = FStringFormatter()
        template = "Numbers: {123} and {45.6}, booleans: {true} {false} {null}, vars: {name}"

        variables = formatter.extract_variables(template)
        assert variables == ["name"]

    def test_render_with_missing_variable_raises_error(self):
        formatter = FStringFormatter()
        template = "Hello {name}, welcome to {place}"
        variables = {"name": "Alice"}

        with pytest.raises(KeyError, match="Template variable 'place' not found"):
            formatter.render(template, variables)


class TestFormatterFactory:
    """Tests for FormatterFactory."""

    def test_create_mustache_formatter(self):
        formatter = FormatterFactory.create(TemplateFormat.MUSTACHE)
        assert isinstance(formatter, MustacheFormatter)

    def test_create_fstring_formatter(self):
        formatter = FormatterFactory.create(TemplateFormat.F_STRING)
        assert isinstance(formatter, FStringFormatter)

    def test_create_invalid_format_raises_error(self):
        with pytest.raises(ValueError, match="Unsupported template format"):
            # This would fail if we had an invalid enum value
            FormatterFactory.create("invalid_format")  # type: ignore

    def test_auto_detect_and_create_mustache(self):
        formatter = FormatterFactory.auto_detect_and_create("Hello {{name}}")
        assert isinstance(formatter, MustacheFormatter)

    def test_auto_detect_and_create_fstring(self):
        formatter = FormatterFactory.auto_detect_and_create("Hello {name}")
        assert isinstance(formatter, FStringFormatter)


class TestTemplate:
    """Tests for the Template class."""

    def test_explicit_mustache_format(self):
        template = Template(
            template="Classify: {{text}}",
            template_format=TemplateFormat.MUSTACHE,
        )

        assert template.template_format == TemplateFormat.MUSTACHE
        assert template.variables == ["text"]

    def test_explicit_fstring_format(self):
        template = Template(
            template="Classify: {text}",
            template_format=TemplateFormat.F_STRING,
        )

        assert template.template_format == TemplateFormat.F_STRING
        assert template.variables == ["text"]

    def test_auto_detection_mustache(self):
        template = Template(template="Classify: {{text}}")

        assert template.template_format == TemplateFormat.MUSTACHE
        assert template.variables == ["text"]

    def test_auto_detection_fstring(self):
        template = Template(template="Classify: {text}")

        assert template.template_format == TemplateFormat.F_STRING
        assert template.variables == ["text"]

    def test_auto_detection_with_json_content(self):
        template = Template(template='Analyze: {"config": {"debug": true}} for {user_id}')

        assert template.template_format == TemplateFormat.F_STRING
        assert template.variables == ["user_id"]

    def test_render_mustache_template(self):
        template = Template(
            template="Classify: {{text}}",
            template_format=TemplateFormat.MUSTACHE,
        )

        result = template.render({"text": "Hello world"})

        assert isinstance(result, str)
        assert result == "Classify: Hello world"

    def test_render_fstring_template(self):
        template = Template(
            template="Classify: {text}",
            template_format=TemplateFormat.F_STRING,
        )

        result = template.render({"text": "Hello world"})

        assert isinstance(result, str)
        assert result == "Classify: Hello world"

    def test_render_fstring_with_json(self):
        template = Template(
            template='Process: {"config": {"debug": true}} for user {user_id}',
            template_format=TemplateFormat.F_STRING,
        )

        result = template.render({"user_id": "123"})

        expected = 'Process: {"config": {"debug": true}} for user 123'
        assert result == expected

    def test_empty_template_raises_error(self):
        with pytest.raises(ValueError, match="Template cannot be empty"):
            Template(template="")

    def test_render_with_invalid_variables_raises_error(self):
        template = Template(template="Hello {name}", template_format=TemplateFormat.F_STRING)

        with pytest.raises(TypeError, match="Variables must be a dictionary"):
            template.render("invalid")  # type: ignore


class TestRealWorldUseCases:
    """Tests for real-world use cases and edge cases."""

    def test_sentiment_classification_mustache(self):
        template = Template(
            template=(
                "Classify the sentiment of this text: {{text}}\n\nConsider the context: {{context}}"
            ),
            template_format=TemplateFormat.MUSTACHE,
        )

        result = template.render({"text": "I love this product!", "context": "Customer review"})

        expected = (
            "Classify the sentiment of this text: I love this product!\n\nConsider the "
            "context: Customer review"
        )
        assert result == expected

    def test_sentiment_classification_fstring(self):
        template = Template(
            template=(
                "Classify the sentiment of this text: {text}\n\nConsider the context: {context}"
            ),
            template_format=TemplateFormat.F_STRING,
        )

        result = template.render({"text": "I love this product!", "context": "Customer review"})

        expected = (
            "Classify the sentiment of this text: I love this product!\n\nConsider the "
            "context: Customer review"
        )
        assert result == expected

    def test_complex_json_with_variables(self):
        """Test a complex real-world case with JSON configuration and variables."""
        template = Template(
            template="""
Given this configuration:
{
    "model_settings": {
        "temperature": 0.3,
        "max_tokens": 150,
        "response_format": {"type": "json_object"}
    },
    "evaluation_criteria": ["accuracy", "relevance", "coherence"]
}

Analyze the following text for user {user_id} in environment {environment}:
"{text}"

Consider the previous conversation context if available.
            """.strip(),
            template_format=TemplateFormat.F_STRING,
        )

        result = template.render(
            {"user_id": "user_123", "environment": "production", "text": "This is a test message"}
        )

        assert "user_123" in result
        assert "production" in result
        assert "This is a test message" in result
        # JSON should be preserved exactly
        assert '"temperature": 0.3' in result
        assert '"response_format": {"type": "json_object"}' in result

    def test_ambiguous_case_with_explicit_format(self):
        """Test handling of ambiguous cases with explicit format specification."""
        # This template is ambiguous - could be f-string escaped JSON or mustache
        ambiguous_template = 'Config: {{"debug": true}} for analysis'

        # Test as f-string (escaped JSON)
        template_fstring = Template(
            template=ambiguous_template,
            template_format=TemplateFormat.F_STRING,
        )

        result_fstring = template_fstring.render({})
        assert result_fstring == 'Config: {"debug": true} for analysis'

        # Test as mustache (variable named "debug": true)
        template_mustache = Template(
            template=ambiguous_template,
            template_format=TemplateFormat.MUSTACHE,
        )

        result_mustache = template_mustache.render({'"debug": true': "REPLACED"})
        assert result_mustache == "Config: REPLACED for analysis"
