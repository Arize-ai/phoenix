from typing import Any, Dict, List, Optional

import pytest

from phoenix.evals.llm.prompts import (
    FormatterFactory,
    FStringFormatter,
    MustacheFormatter,
    PromptTemplate,
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


class TestPromptTemplate:
    """Tests for the unified PromptTemplate class."""

    def test_string_template_creation(self) -> None:
        """Test creating PromptTemplate with a string."""
        template = PromptTemplate(template="Hello {name}")
        assert template.template == "Hello {name}"
        assert template.variables == ["name"]
        # template_format is None when auto-detected (delegated to content parts)
        assert template.template_format is None

    def test_message_list_template_creation(self) -> None:
        """Test creating PromptTemplate with a message list."""
        messages = [
            {"role": "system", "content": "You are {role}"},
            {"role": "user", "content": "Analyze {text}"},
        ]
        template = PromptTemplate(template=messages)
        assert template.template == messages
        assert set(template.variables) == {"role", "text"}

    def test_string_template_rendering(self) -> None:
        """Test rendering a string template."""
        template = PromptTemplate(template="Hello {name}, welcome to {place}")
        result = template.render({"name": "Alice", "place": "Phoenix"})
        # String templates now return List[Message] with single user message
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["role"].value == "user"  # MessageRole enum
        assert result[0]["content"] == "Hello Alice, welcome to Phoenix"

    def test_message_list_rendering(self) -> None:
        """Test rendering a message list template."""
        messages = [
            {"role": "system", "content": "You are {role}"},
            {"role": "user", "content": "Score this: {text}"},
        ]
        template = PromptTemplate(template=messages)
        result = template.render({"role": "a helpful assistant", "text": "hello world"})

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["role"].value == "system"
        assert result[0]["content"] == "You are a helpful assistant"
        assert result[1]["role"].value == "user"
        assert result[1]["content"] == "Score this: hello world"

    def test_mustache_string_template(self) -> None:
        """Test PromptTemplate with mustache format."""
        template = PromptTemplate(
            template="Hello {{name}}", template_format=TemplateFormat.MUSTACHE
        )
        assert template.template_format == TemplateFormat.MUSTACHE
        assert template.variables == ["name"]
        result = template.render({"name": "Bob"})
        # String templates now return List[Message]
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["content"] == "Hello Bob"

    def test_mustache_message_list(self) -> None:
        """Test PromptTemplate with mustache format in messages."""
        messages = [{"role": "user", "content": "Hello {{name}}, rate {{text}}"}]
        template = PromptTemplate(template=messages, template_format=TemplateFormat.MUSTACHE)
        result = template.render({"name": "Alice", "text": "document"})

        assert isinstance(result, list)
        assert result[0]["content"] == "Hello Alice, rate document"

    def test_message_list_preserves_extra_fields(self) -> None:
        """Test that extra fields in messages are NOT preserved (Message TypedDict has only role and content)."""
        messages = [
            {"role": "user", "content": "Hello {name}", "id": 123, "metadata": {"key": "value"}}
        ]
        template = PromptTemplate(template=messages)
        result = template.render({"name": "Alice"})

        assert isinstance(result, list)
        assert result[0]["role"].value == "user"
        assert result[0]["content"] == "Hello Alice"
        # Extra fields are not preserved - Message TypedDict only has role and content
        assert "id" not in result[0]
        assert "metadata" not in result[0]

    def test_empty_string_raises_error(self) -> None:
        """Test that empty string template raises ValueError."""
        with pytest.raises(ValueError, match="Template cannot be empty"):
            PromptTemplate(template="")

    def test_invalid_variables_type_raises_error(self) -> None:
        """Test that invalid variables type raises TypeError."""
        template = PromptTemplate(template="Hello {name}")
        with pytest.raises(TypeError, match="Variables must be a dictionary"):
            template.render("invalid")  # type: ignore

    def test_message_without_content(self) -> None:
        """Test handling messages without content field - should raise error."""
        messages = [{"role": "user"}]
        # Messages without content should raise an error
        with pytest.raises(ValueError, match="must have a 'content' field"):
            PromptTemplate(template=messages)

    def test_mixed_variables_in_multiple_messages(self) -> None:
        """Test extracting variables from multiple messages with different variables."""
        messages = [
            {"role": "system", "content": "You are {role}"},
            {"role": "user", "content": "Analyze {text} for {user_id}"},
            {"role": "assistant", "content": "I will analyze the {text}"},
        ]
        template = PromptTemplate(template=messages)

        # All unique variables should be extracted
        assert set(template.variables) == {"role", "text", "user_id"}

    def test_auto_format_detection_for_messages(self) -> None:
        """Test that format detection works for individual messages."""
        messages = [{"role": "user", "content": "Hello {{name}}"}]
        template = PromptTemplate(template=messages)  # Auto-detect format

        result = template.render({"name": "Alice"})
        assert isinstance(result, list)
        assert result[0]["content"] == "Hello Alice"

    def test_invalid_template_type(self) -> None:
        """Test that invalid template type raises TypeError."""
        with pytest.raises(TypeError, match="Template must be str or list"):
            PromptTemplate(template=123)  # type: ignore

    @pytest.mark.parametrize(
        "template_input,expected_variables,render_vars,expected_content",
        [
            (
                "Hello {name}",
                ["name"],
                {"name": "Alice"},
                "Hello Alice",
            ),
            (
                [{"role": "user", "content": "Analyze {text}"}],
                ["text"],
                {"text": "hello world"},
                "Analyze hello world",
            ),
        ],
    )
    def test_prompt_template_accepts_prompt_template_instance(
        self,
        template_input: Any,
        expected_variables: List[str],
        render_vars: Dict[str, str],
        expected_content: str,
    ) -> None:
        """Test that PromptTemplate can accept another PromptTemplate instance."""
        original = PromptTemplate(template=template_input)
        copied = PromptTemplate(template=original)  # type: ignore[arg-type]

        assert copied.template == original.template
        assert copied.variables == expected_variables

        result = copied.render(render_vars)
        assert result[0]["content"] == expected_content

    def test_prompt_template_copying_preserves_format_override(self) -> None:
        """Test that template_format can be overridden when copying."""
        original = PromptTemplate(
            template="Hello {{name}}", template_format=TemplateFormat.MUSTACHE
        )
        copied = PromptTemplate(template=original, template_format=TemplateFormat.F_STRING)  # type: ignore[arg-type]

        assert copied.template_format == TemplateFormat.F_STRING
        assert copied.template == original.template

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
    def test_string_template_rendering_with_formats(
        self,
        template_str: str,
        format_type: TemplateFormat,
        variables: Dict[str, str],
        expected: str,
    ) -> None:
        """Test rendering string templates with explicit format types."""
        template = PromptTemplate(template=template_str, template_format=format_type)
        result = template.render(variables)
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["content"] == expected

    def test_ambiguous_template_handling(self) -> None:
        """Test handling of ambiguous templates with explicit format specification."""
        ambiguous_template = 'Config: {{"debug": true}} for analysis'

        template_fstring = PromptTemplate(
            template=ambiguous_template,
            template_format=TemplateFormat.F_STRING,
        )
        result_fstring = template_fstring.render({})
        assert isinstance(result_fstring, list)
        assert result_fstring[0]["content"] == 'Config: {"debug": true} for analysis'

        template_mustache = PromptTemplate(
            template=ambiguous_template,
            template_format=TemplateFormat.MUSTACHE,
        )
        result_mustache = template_mustache.render({'"debug": true': "REPLACED"})
        assert isinstance(result_mustache, list)
        assert result_mustache[0]["content"] == "Config: REPLACED for analysis"

    def test_complex_real_world_template(self) -> None:
        """Test complex real-world template with mixed JSON and variables."""
        template = PromptTemplate(
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

        assert isinstance(result, list)
        assert len(result) == 1
        content = result[0]["content"]
        assert "user_123" in content
        assert "production" in content
        assert "This is a test message" in content
        assert '"temperature": 0.3' in content
        assert '"response_format": {"type": "json_object"}' in content

    def test_dot_delimited_f_string_variables(self) -> None:
        """Test dot-delimited variable names in f-string format."""

        class Hello:
            @property
            def world(self) -> str:
                return "why hello, world"

        template = PromptTemplate(template="{hello.world}")
        assert template.variables == ["hello.world"]

        # Test with dot-delimited key
        result = template.render({"hello.world": "hello! world!"})
        assert isinstance(result, list)
        assert result[0]["content"] == "hello! world!"

        # Test with object access
        result = template.render({"hello": Hello()})
        assert isinstance(result, list)
        assert result[0]["content"] == "why hello, world"

    def test_message_list_with_ambiguous_templates(self) -> None:
        """Test message list templates with ambiguous content."""
        # For F_STRING format, use f-string syntax
        messages_fstring = [
            {"role": "system", "content": 'Config: {{"debug": true}}'},
            {"role": "user", "content": "Analyze {text} in {env}"},
        ]

        # With F_STRING format, JSON should be preserved and f-string vars rendered
        template_fstring = PromptTemplate(
            template=messages_fstring, template_format=TemplateFormat.F_STRING
        )
        result = template_fstring.render({"text": "data", "env": "prod"})
        assert isinstance(result, list)
        assert result[0]["content"] == 'Config: {"debug": true}'
        assert result[1]["content"] == "Analyze data in prod"

        # For MUSTACHE format, use Mustache syntax
        messages_mustache = [
            {"role": "system", "content": 'Config: {{"debug": true}}'},
            {"role": "user", "content": "Analyze {{text}} in {{env}}"},
        ]

        # With MUSTACHE format, JSON becomes a variable and Mustache vars are rendered
        template_mustache = PromptTemplate(
            template=messages_mustache, template_format=TemplateFormat.MUSTACHE
        )
        result = template_mustache.render(
            {'"debug": true': "REPLACED", "text": "data", "env": "prod"}
        )
        assert isinstance(result, list)
        assert result[0]["content"] == "Config: REPLACED"
        assert result[1]["content"] == "Analyze data in prod"
