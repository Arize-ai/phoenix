from typing import Dict, List, Optional

import pytest

from phoenix.evals.templating import (
    FormatterFactory,
    FStringFormatter,
    MustacheFormatter,
    Template,
    TemplateFormat,
    detect_template_format,
    render_template,
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


def test_dot_delimited_f_string_variables() -> None:
    class Hello:
        @property
        def world(self) -> str:
            return "why hello, world"

    template = Template(template="{hello.world}")
    assert isinstance(template._formatter, FStringFormatter)
    assert template.render({"hello.world": "hello! world!"}) == "hello! world!"
    assert template.render({"hello": Hello()}) == "why hello, world"
    assert template.variables == ["hello.world"]


class TestRenderTemplate:
    """Tests for render_template function with message lists."""

    def test_render_string_template(self) -> None:
        """Test that string templates are rendered correctly."""
        template = "Hello {name}, welcome to {place}"
        variables = {"name": "Alice", "place": "Phoenix"}
        result = render_template(template, variables)
        assert result == "Hello Alice, welcome to Phoenix"

    def test_render_single_message_fstring(self) -> None:
        """Test rendering a single message with f-string variables."""
        template = [{"role": "user", "content": "Score this text: {text}"}]
        variables = {"text": "hello world"}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Score this text: hello world"

    def test_render_multiple_messages_fstring(self) -> None:
        """Test rendering multiple messages with f-string variables."""
        template = [
            {"role": "system", "content": "You are {role}"},
            {"role": "user", "content": "Analyze this: {text}"},
        ]
        variables = {"role": "a helpful assistant", "text": "sample text"}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["role"] == "system"
        assert result[0]["content"] == "You are a helpful assistant"
        assert result[1]["role"] == "user"
        assert result[1]["content"] == "Analyze this: sample text"

    def test_render_messages_with_mustache(self) -> None:
        """Test rendering messages with mustache variables."""
        template = [{"role": "user", "content": "Hello {{name}}, score {{text}}"}]
        variables = {"name": "Alice", "text": "document"}
        result = render_template(template, variables, template_format=TemplateFormat.MUSTACHE)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["content"] == "Hello Alice, score document"

    def test_render_messages_no_variables(self) -> None:
        """Test rendering messages without variables."""
        template = [
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": "Hello"},
        ]
        variables = {}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["content"] == "You are a helpful assistant"
        assert result[1]["content"] == "Hello"

    def test_render_messages_preserves_extra_fields(self) -> None:
        """Test that extra message fields are preserved."""
        template = [{"role": "user", "content": "Hello {name}", "name": "ChatBot", "id": 123}]
        variables = {"name": "Alice"}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello Alice"
        assert result[0]["name"] == "ChatBot"
        assert result[0]["id"] == 123

    def test_render_messages_without_content_field(self) -> None:
        """Test handling messages without content field."""
        template = [{"role": "user"}]
        variables = {}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert "content" not in result[0]

    def test_render_empty_message_list(self) -> None:
        """Test rendering an empty message list."""
        template: List[Dict[str, str]] = []
        variables = {}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert len(result) == 0

    def test_render_template_invalid_type(self) -> None:
        """Test that invalid template types raise TypeError."""
        with pytest.raises(TypeError, match="Template must be a string or list"):
            render_template(123, {})  # type: ignore

    def test_render_messages_multiple_variables_in_content(self) -> None:
        """Test rendering messages with multiple variables in content."""
        template = [{"role": "user", "content": "{name} scored {score} on {task}"}]
        variables = {"name": "Alice", "score": "95", "task": "math test"}
        result = render_template(template, variables)

        assert isinstance(result, list)
        assert result[0]["content"] == "Alice scored 95 on math test"
