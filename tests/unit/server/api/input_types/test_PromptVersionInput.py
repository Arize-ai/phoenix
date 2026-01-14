import pytest

from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat
from phoenix.server.api.input_types.PromptVersionInput import (
    ChatPromptVersionInput,
    ContentPartInput,
    PromptChatTemplateInput,
    PromptMessageInput,
    TextContentValueInput,
)


@pytest.mark.parametrize(
    "template_format",
    [
        PromptTemplateFormat.MUSTACHE,
        PromptTemplateFormat.F_STRING,
        PromptTemplateFormat.NONE,
        PromptTemplateFormat.JSON_PATH,
    ],
)
def test_chat_prompt_version_input_accepts_all_template_formats(
    template_format: PromptTemplateFormat,
) -> None:
    """Test that ChatPromptVersionInput accepts all PromptTemplateFormat values including JSON_PATH."""
    messages = [
        PromptMessageInput(
            role="USER",
            content=[ContentPartInput(text=TextContentValueInput(text="test message"))],
        )
    ]

    # This should not raise any validation errors
    version_input = ChatPromptVersionInput(
        template_format=template_format,
        template=PromptChatTemplateInput(messages=messages),
        invocation_parameters={},
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4",
    )

    assert version_input.template_format == template_format


def test_chat_prompt_version_input_to_orm_with_json_path() -> None:
    """Test that ChatPromptVersionInput.to_orm_prompt_version() works with JSON_PATH format."""
    messages = [
        PromptMessageInput(
            role="USER",
            content=[ContentPartInput(text=TextContentValueInput(text="Hello {$.user.name}"))],
        )
    ]

    version_input = ChatPromptVersionInput(
        description="Test JSON_PATH template",
        template_format=PromptTemplateFormat.JSON_PATH,
        template=PromptChatTemplateInput(messages=messages),
        invocation_parameters={},
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4",
    )

    # Convert to ORM model
    orm_version = version_input.to_orm_prompt_version(user_id=None)

    # Verify the ORM model has the correct template format
    assert orm_version.template_format == PromptTemplateFormat.JSON_PATH
    assert orm_version.description == "Test JSON_PATH template"
    assert orm_version.model_provider == ModelProvider.OPENAI
    assert orm_version.model_name == "gpt-4"
