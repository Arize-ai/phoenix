from enum import Enum
from typing import TYPE_CHECKING, Any, Optional, TypeVar, Union

import strawberry
from pydantic import BaseModel, ConfigDict, ValidationError
from typing_extensions import assert_never

if TYPE_CHECKING:
    from phoenix.server.api.types.PromptVersion import PromptTemplateType

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]
PromptModel = TypeVar("PromptModel", bound="BasePromptModel")


@strawberry.enum
class PromptMessageRole(str, Enum):
    USER = "user"
    SYSTEM = "system"  # e.g. the OpenAI developer role or an Anthropic system instruction
    AI = "ai"  # E.g. the assistant. Normalize to AI for consistency.
    TOOL = "tool"


class BasePromptModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",  # disallow extra attributes
    )


class TextPromptMessage(BasePromptModel):
    role: PromptMessageRole
    content: str


class JSONPromptMessage(BasePromptModel):
    role: PromptMessageRole
    content: JSONSerializable


class PromptChatTemplateV1(BasePromptModel):
    _version: str = "messages-v1"
    messages: list[Union[TextPromptMessage, JSONPromptMessage]]


class PromptStringTemplate(BasePromptModel):
    template: str


class PromptToolDefinition(BasePromptModel):
    definition: JSONSerializable


class PromptTools(BasePromptModel):
    _version: str = "tools-v1"
    tools: list[PromptToolDefinition]


def validate_prompt_template(
    input: dict[str, Any], template_type: Union[str, "PromptTemplateType"]
) -> tuple[bool, Optional[str]]:
    """
    Returns a tuple of (is_valid, error_message) where is_valid is a boolean
    indicating whether the input is a valid prompt template and error_message is
    a string describing the error if the input is not valid.
    """
    from phoenix.server.api.types.PromptVersion import PromptTemplateType

    template_type = PromptTemplateType(template_type)
    base_error_message = "Invalid prompt template:\n"
    if template_type == PromptTemplateType.CHAT:
        is_valid, error_message = validate_input(input, PromptChatTemplateV1)
    elif template_type == PromptTemplateType.STRING:
        is_valid, error_message = validate_input(input, PromptStringTemplate)
    else:
        assert_never(template_type)
    return is_valid, base_error_message + error_message if error_message is not None else None


def validate_input(
    input: dict[str, Any], model: type[BasePromptModel]
) -> tuple[bool, Optional[str]]:
    """
    Validates an input against a Pydantic model, returning a tuple of (is_valid,
    error_message), where is_valid specifies whether the input is valid and
    error_message contains the error message if one exists.
    """
    try:
        marshal_input(input, model)
        return True, None
    except PromptValidationError as error:
        return False, str(error)


def marshal_input(input: dict[str, Any], model: type[PromptModel]) -> PromptModel:
    """
    Marshals an input into a Pydantic model, raising a PromptValidationError if
    the input is invalid.
    """
    try:
        return model.model_validate(input)
    except ValidationError as error:
        raise PromptValidationError.from_validation_error(error)


class PromptValidationError(Exception):
    @classmethod
    def from_validation_error(cls, error: ValidationError) -> "PromptValidationError":
        """
        Creates a PromptValidationError from a pydantic.ValidationError,
        formatting the error message to exclude Pydantic-specific URLs.
        """
        error_messages = []
        for error_detail in error.errors(include_url=False):
            error_message = "  - "
            location = ".".join(map(str, error_detail["loc"]))
            if location:
                error_message += f"Error at key '{location}': "
            error_message += error_detail["msg"]
            error_messages.append(error_message)
        return cls("\n".join(error_messages))
