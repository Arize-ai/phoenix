from typing import Dict, List, Optional

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
    @pytest.mark.parametrize(
        "template,expected",
        [
            ("Hello {{name}}", TemplateFormat.MUSTACHE),
            ("{{user}} said: {{message}}", TemplateFormat.MUSTACHE),
            ("Hello {name}", TemplateFormat.F_STRING),
            ("{user} said: {message}", TemplateFormat.F_STRING),
            ('Config: {"debug": true} for {environment}', TemplateFormat.F_STRING),
            ('Data: {"items": [1, 2, 3]} processed by {processor}', TemplateFormat.F_STRING),
            ('Config: {{"debug": true}} for {environment}', TemplateFormat.F_STRING),
            ('JSON: {{"key": "value"}} and user {user_id}', TemplateFormat.F_STRING),
            ('Pure JSON: {{"key": "value"}}', TemplateFormat.MUSTACHE),
            ('{{"debug": true, "timeout": 30}}', TemplateFormat.MUSTACHE),
            ("User {{user}} and {env}", TemplateFormat.MUSTACHE),
            ("{{name}} in environment {env}", TemplateFormat.MUSTACHE),
            ("No variables here", TemplateFormat.MUSTACHE),
            ("Numbers: {123} and {true}", TemplateFormat.F_STRING),
            ("Python literals: {True} and {False}", TemplateFormat.MUSTACHE),
            ("Mixed: {None} and {null}", TemplateFormat.F_STRING),
        ],
    )
    def test_format_detection(self, template: str, expected: TemplateFormat) -> None:
        detected = detect_template_format(template)
        assert detected == expected, f"Failed for: {template}"


class TestFormatters:
    def test_mustache_formatter(self) -> None:
        formatter = MustacheFormatter()
        template = "Hello {{name}}, welcome to {{place}}"
        variables = {"name": "Alice", "place": "Phoenix"}

        result = formatter.render(template, variables)
        assert result == "Hello Alice, welcome to Phoenix"

        extracted_vars = formatter.extract_variables(template)
        assert set(extracted_vars) == {"name", "place"}

    def test_fstring_formatter(self) -> None:
        formatter = FStringFormatter()
        template = "Hello {name}, welcome to {place}"
        variables = {"name": "Alice", "place": "Phoenix"}

        result = formatter.render(template, variables)
        assert result == "Hello Alice, welcome to Phoenix"

        extracted_vars = formatter.extract_variables(template)
        assert set(extracted_vars) == {"name", "place"}

    def test_fstring_formatter_with_json(self) -> None:
        formatter = FStringFormatter()
        template = 'Config: {{"debug": true, "timeout": 30}} for {environment} and {user}'
        variables = {"environment": "prod", "user": "alice"}

        result = formatter.render(template, variables)
        expected = 'Config: {"debug": true, "timeout": 30} for prod and alice'
        assert result == expected

        extracted_vars = formatter.extract_variables(template)
        assert set(extracted_vars) == {"environment", "user"}


class TestFormatterFactory:
    def test_create_formatters(self) -> None:
        mustache_formatter = FormatterFactory.create(TemplateFormat.MUSTACHE)
        assert isinstance(mustache_formatter, MustacheFormatter)

        fstring_formatter = FormatterFactory.create(TemplateFormat.F_STRING)
        assert isinstance(fstring_formatter, FStringFormatter)

    def test_auto_detect_and_create(self) -> None:
        mustache_formatter = FormatterFactory.auto_detect_and_create("Hello {{name}}")
        assert isinstance(mustache_formatter, MustacheFormatter)

        fstring_formatter = FormatterFactory.auto_detect_and_create("Hello {name}")
        assert isinstance(fstring_formatter, FStringFormatter)


class TestTemplate:
    @pytest.mark.parametrize(
        "template_str,format_type,expected_format,expected_vars",
        [
            ("Classify: {{text}}", None, TemplateFormat.MUSTACHE, ["text"]),
            ("Classify: {text}", None, TemplateFormat.F_STRING, ["text"]),
            (
                'Analyze: {{"config": true}} for {user_id}',
                None,
                TemplateFormat.F_STRING,
                ["user_id"],
            ),
            ("Classify: {{text}}", TemplateFormat.MUSTACHE, TemplateFormat.MUSTACHE, ["text"]),
            ("Classify: {text}", TemplateFormat.F_STRING, TemplateFormat.F_STRING, ["text"]),
        ],
    )
    def test_template_creation(
        self,
        template_str: str,
        format_type: Optional[TemplateFormat],
        expected_format: TemplateFormat,
        expected_vars: List[str],
    ) -> None:
        if format_type is None:
            template = Template(template=template_str)
        else:
            template = Template(template=template_str, template_format=format_type)

        assert template.template_format == expected_format
        assert template.variables == expected_vars

    @pytest.mark.parametrize(
        "template_str,format_type,variables,expected",
        [
            ("Hello {{name}}", TemplateFormat.MUSTACHE, {"name": "Alice"}, "Hello Alice"),
            (
                "{{user}}: {{message}}",
                TemplateFormat.MUSTACHE,
                {"user": "Bob", "message": "Hi"},
                "Bob: Hi",
            ),
            ("Hello {name}", TemplateFormat.F_STRING, {"name": "Alice"}, "Hello Alice"),
            (
                "{user}: {message}",
                TemplateFormat.F_STRING,
                {"user": "Bob", "message": "Hi"},
                "Bob: Hi",
            ),
            (
                'Config: {{"debug": true}} for {env}',
                TemplateFormat.F_STRING,
                {"env": "prod"},
                'Config: {"debug": true} for prod',
            ),
        ],
    )
    def test_template_rendering(
        self,
        template_str: str,
        format_type: TemplateFormat,
        variables: Dict[str, str],
        expected: str,
    ) -> None:
        template = Template(template=template_str, template_format=format_type)
        result = template.render(variables)
        assert result == expected

    def test_template_validation(self) -> None:
        with pytest.raises(ValueError, match="Template cannot be empty"):
            Template(template="")

        template = Template(template="Hello {name}", template_format=TemplateFormat.F_STRING)
        with pytest.raises(TypeError, match="Variables must be a dictionary"):
            template.render("invalid")  # type: ignore

    def test_ambiguous_template_handling(self) -> None:
        ambiguous_template = 'Config: {{"debug": true}} for analysis'

        template_fstring = Template(
            template=ambiguous_template,
            template_format=TemplateFormat.F_STRING,
        )
        result_fstring = template_fstring.render({})
        assert result_fstring == 'Config: {"debug": true} for analysis'

        template_mustache = Template(
            template=ambiguous_template,
            template_format=TemplateFormat.MUSTACHE,
        )
        result_mustache = template_mustache.render({'"debug": true': "REPLACED"})
        assert result_mustache == "Config: REPLACED for analysis"

    def test_complex_real_world_template(self) -> None:
        template = Template(
            template="""
Given this configuration:
{{
    "model_settings": {{
        "temperature": 0.3,
        "max_tokens": 150,
        "response_format": {{"type": "json_object"}}
    }},
    "evaluation_criteria": ["accuracy", "relevance", "coherence"]
}}

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
        assert '"temperature": 0.3' in result
        assert '"response_format": {"type": "json_object"}' in result
