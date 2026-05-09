from enum import Enum
from typing import Any, Literal, Union

from pydantic import Field, RootModel, model_validator
from typing_extensions import Annotated, Self, TypeAlias, TypeGuard, assert_never

from phoenix.db.types.db_helper_types import UNDEFINED, DBBaseModel

JSONSerializable = Union[None, bool, int, float, str, dict[str, Any], list[Any]]


class PromptTemplateType(str, Enum):
    STRING = "STR"
    CHAT = "CHAT"


class PromptMessageRole(str, Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"  # e.g. the OpenAI developer role or an Anthropic system instruction
    AI = "AI"  # E.g. the assistant. Normalize to AI for consistency.
    TOOL = "TOOL"


class PromptTemplateFormat(str, Enum):
    MUSTACHE = "MUSTACHE"
    F_STRING = "F_STRING"
    NONE = "NONE"


class TextContentPart(DBBaseModel):
    type: Literal["text"]
    text: str


class ToolCallFunction(DBBaseModel):
    type: Literal["function"]
    name: str
    arguments: str


class ToolCallContentPart(DBBaseModel):
    type: Literal["tool_call"]
    tool_call_id: str
    tool_call: Annotated[
        ToolCallFunction,
        Field(..., discriminator="type"),
    ]


class ToolResultContentPart(DBBaseModel):
    type: Literal["tool_result"]
    tool_call_id: str
    tool_result: JSONSerializable


ContentPart: TypeAlias = Annotated[
    Union[TextContentPart, ToolCallContentPart, ToolResultContentPart],
    Field(..., discriminator="type"),
]

Role: TypeAlias = Literal["user", "assistant", "model", "ai", "tool", "system", "developer"]


class RoleConversion:
    @staticmethod
    def from_gql(role: PromptMessageRole) -> Role:
        if role is PromptMessageRole.USER:
            return "user"
        if role is PromptMessageRole.AI:
            return "ai"
        if role is PromptMessageRole.TOOL:
            return "tool"
        if role is PromptMessageRole.SYSTEM:
            return "system"
        assert_never(role)

    @staticmethod
    def to_gql(role: Role) -> PromptMessageRole:
        if role == "user":
            return PromptMessageRole.USER
        if role == "assistant":
            return PromptMessageRole.AI
        if role == "model":
            return PromptMessageRole.AI
        if role == "ai":
            return PromptMessageRole.AI
        if role == "tool":
            return PromptMessageRole.TOOL
        if role == "system":
            return PromptMessageRole.SYSTEM
        if role == "developer":
            return PromptMessageRole.SYSTEM
        assert_never(role)


class PromptMessage(DBBaseModel):
    role: Role
    content: Union[str, Annotated[list[ContentPart], Field(..., min_length=1)]]


class PromptChatTemplate(DBBaseModel):
    type: Literal["chat"]
    messages: list[PromptMessage]


class PromptStringTemplate(DBBaseModel):
    type: Literal["string"]
    template: str


PromptTemplate: TypeAlias = Annotated[
    Union[PromptChatTemplate, PromptStringTemplate], Field(..., discriminator="type")
]


def is_prompt_template(value: Any) -> TypeGuard[PromptTemplate]:
    return isinstance(value, (PromptChatTemplate, PromptStringTemplate))


class PromptTemplateRootModel(RootModel[PromptTemplate]):
    root: PromptTemplate


class PromptToolFunctionDefinition(DBBaseModel):
    name: str
    description: str = UNDEFINED
    parameters: dict[str, Any] = UNDEFINED
    strict: bool = UNDEFINED


class PromptToolFunction(DBBaseModel):
    type: Literal["function"]
    function: PromptToolFunctionDefinition


class PromptToolRaw(DBBaseModel):
    type: Literal["raw"]
    raw: dict[str, Any]


PromptTool: TypeAlias = Annotated[
    Union[PromptToolFunction, PromptToolRaw], Field(..., discriminator="type")
]


class PromptToolChoiceNone(DBBaseModel):
    type: Literal["none"]


class PromptToolChoiceZeroOrMore(DBBaseModel):
    type: Literal["zero_or_more"]


class PromptToolChoiceOneOrMore(DBBaseModel):
    type: Literal["one_or_more"]


class PromptToolChoiceSpecificFunctionTool(DBBaseModel):
    type: Literal["specific_function"]
    function_name: str


PromptToolChoice: TypeAlias = Annotated[
    Union[
        PromptToolChoiceNone,
        PromptToolChoiceZeroOrMore,
        PromptToolChoiceOneOrMore,
        PromptToolChoiceSpecificFunctionTool,
    ],
    Field(..., discriminator="type"),
]


class PromptTools(DBBaseModel):
    type: Literal["tools"]
    tools: Annotated[list[PromptTool], Field(..., min_length=1)]
    tool_choice: PromptToolChoice = UNDEFINED
    disable_parallel_tool_calls: bool = UNDEFINED


class PromptResponseFormatJSONSchemaDefinition(DBBaseModel):
    name: str
    description: str = UNDEFINED
    schema_: dict[str, Any] = Field(UNDEFINED, alias="schema")
    strict: bool = UNDEFINED


class PromptResponseFormatJSONSchema(DBBaseModel):
    type: Literal["json_schema"]
    json_schema: PromptResponseFormatJSONSchemaDefinition


PromptResponseFormat: TypeAlias = Annotated[
    Union[PromptResponseFormatJSONSchema], Field(..., discriminator="type")
]


class PromptResponseFormatRootModel(RootModel[PromptResponseFormat]):
    root: PromptResponseFormat


class PromptOpenAIInvocationParametersContent(DBBaseModel):
    temperature: float = UNDEFINED
    max_tokens: int = UNDEFINED
    max_completion_tokens: int = UNDEFINED
    frequency_penalty: float = UNDEFINED
    presence_penalty: float = UNDEFINED
    top_p: float = UNDEFINED
    seed: int = UNDEFINED
    # https://github.com/openai/openai-python/blob/e507a4ebeea4c3f93cd48986014a3e2ca79230c2/src/openai/types/chat/completion_create_params.py#L264  # noqa: E501
    stop: list[str] = UNDEFINED
    # https://github.com/openai/openai-python/blob/e507a4ebeea4c3f93cd48986014a3e2ca79230c2/src/openai/types/chat/completion_create_params.py#L196  # noqa: E501
    reasoning_effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] = UNDEFINED
    extra_body: dict[str, Any] = UNDEFINED


class PromptOpenAIInvocationParameters(DBBaseModel):
    type: Literal["openai"]
    openai: PromptOpenAIInvocationParametersContent


class PromptAzureOpenAIInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptDeepSeekInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptXAIInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptOllamaInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptCerebrasInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptFireworksInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptGroqInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptMoonshotInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptPerplexityInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptTogetherInvocationParametersContent(PromptOpenAIInvocationParametersContent):
    pass


class PromptAzureOpenAIInvocationParameters(DBBaseModel):
    type: Literal["azure_openai"]
    azure_openai: PromptAzureOpenAIInvocationParametersContent


class PromptDeepSeekInvocationParameters(DBBaseModel):
    type: Literal["deepseek"]
    deepseek: PromptDeepSeekInvocationParametersContent


class PromptXAIInvocationParameters(DBBaseModel):
    type: Literal["xai"]
    xai: PromptXAIInvocationParametersContent


class PromptOllamaInvocationParameters(DBBaseModel):
    type: Literal["ollama"]
    ollama: PromptOllamaInvocationParametersContent


class PromptCerebrasInvocationParameters(DBBaseModel):
    type: Literal["cerebras"]
    cerebras: PromptCerebrasInvocationParametersContent


class PromptFireworksInvocationParameters(DBBaseModel):
    type: Literal["fireworks"]
    fireworks: PromptFireworksInvocationParametersContent


class PromptGroqInvocationParameters(DBBaseModel):
    type: Literal["groq"]
    groq: PromptGroqInvocationParametersContent


class PromptMoonshotInvocationParameters(DBBaseModel):
    type: Literal["moonshot"]
    moonshot: PromptMoonshotInvocationParametersContent


class PromptPerplexityInvocationParameters(DBBaseModel):
    type: Literal["perplexity"]
    perplexity: PromptPerplexityInvocationParametersContent


class PromptTogetherInvocationParameters(DBBaseModel):
    type: Literal["together"]
    together: PromptTogetherInvocationParametersContent


class PromptAnthropicThinkingConfigDisabled(DBBaseModel):
    type: Literal["disabled"]


class PromptAnthropicThinkingConfigEnabled(DBBaseModel):
    type: Literal["enabled"]
    # https://github.com/anthropics/anthropic-sdk-python/blob/78c73600b714fcb036893768df8ee122f33d4cb3/src/anthropic/types/thinking_config_enabled_param.py#L12  # noqa: E501
    budget_tokens: int = Field(..., ge=1024)
    # https://github.com/anthropics/anthropic-sdk-python/blob/78c73600b714fcb036893768df8ee122f33d4cb3/src/anthropic/types/thinking_config_enabled_param.py#L27  # noqa: E501
    display: Literal["summarized", "omitted"] = UNDEFINED


class PromptAnthropicThinkingConfigAdaptive(DBBaseModel):
    type: Literal["adaptive"]
    # https://github.com/anthropics/anthropic-sdk-python/blob/78c73600b714fcb036893768df8ee122f33d4cb3/src/anthropic/types/thinking_config_adaptive_param.py#L14  # noqa: E501
    display: Literal["summarized", "omitted"] = UNDEFINED


class PromptAnthropicOutputConfig(DBBaseModel):
    # https://github.com/anthropics/anthropic-sdk-python/blob/78c73600b714fcb036893768df8ee122f33d4cb3/src/anthropic/types/output_config_param.py#L14  # noqa: E501
    effort: Literal["low", "medium", "high", "xhigh", "max"] = UNDEFINED


class PromptAnthropicInvocationParametersContent(DBBaseModel):
    max_tokens: int
    temperature: float = UNDEFINED
    top_p: float = UNDEFINED
    stop_sequences: list[str] = UNDEFINED
    # https://github.com/anthropics/anthropic-sdk-python/blob/78c73600b714fcb036893768df8ee122f33d4cb3/src/anthropic/types/message_create_params.py#L138  # noqa: E501
    output_config: PromptAnthropicOutputConfig = UNDEFINED
    # https://github.com/anthropics/anthropic-sdk-python/blob/78c73600b714fcb036893768df8ee122f33d4cb3/src/anthropic/types/message_create_params.py#L181  # noqa: E501
    thinking: Annotated[
        Union[
            PromptAnthropicThinkingConfigDisabled,
            PromptAnthropicThinkingConfigEnabled,
            PromptAnthropicThinkingConfigAdaptive,
        ],
        Field(..., discriminator="type"),
    ] = UNDEFINED
    extra_body: dict[str, Any] = UNDEFINED

    @model_validator(mode="after")
    def check_thinking_budget_tokens_lt_max_tokens(self) -> Self:
        if self.thinking is UNDEFINED:
            return self
        if self.thinking.type == "enabled" and self.thinking.budget_tokens >= self.max_tokens:
            raise ValueError("The thinking budget must be less than max tokens.")
        return self


class PromptAnthropicInvocationParameters(DBBaseModel):
    type: Literal["anthropic"]
    anthropic: PromptAnthropicInvocationParametersContent


class PromptAwsInvocationParametersContent(DBBaseModel):
    max_tokens: int = UNDEFINED
    temperature: float = UNDEFINED
    top_p: float = UNDEFINED
    stop_sequences: list[str] = UNDEFINED


class PromptAwsInvocationParameters(DBBaseModel):
    type: Literal["aws"]
    aws: PromptAwsInvocationParametersContent


class PromptGoogleThinkingConfig(DBBaseModel):
    # https://github.com/googleapis/python-genai/blob/aed41ecf4940f63446fc3e22744663be4d1057a6/google/genai/types.py#L5321  # noqa: E501
    thinking_budget: int = UNDEFINED
    # https://github.com/googleapis/python-genai/blob/aed41ecf4940f63446fc3e22744663be4d1057a6/google/genai/types.py#L316  # noqa: E501
    thinking_level: Literal["minimal", "low", "medium", "high"] = UNDEFINED
    # https://github.com/googleapis/python-genai/blob/aed41ecf4940f63446fc3e22744663be4d1057a6/google/genai/types.py#L5316  # noqa: E501
    include_thoughts: bool = UNDEFINED


class PromptGoogleInvocationParametersContent(DBBaseModel):
    temperature: float = UNDEFINED
    max_output_tokens: int = UNDEFINED
    stop_sequences: list[str] = UNDEFINED
    presence_penalty: float = UNDEFINED
    frequency_penalty: float = UNDEFINED
    top_p: float = UNDEFINED
    top_k: int = UNDEFINED
    thinking_config: PromptGoogleThinkingConfig = UNDEFINED


class PromptGoogleInvocationParameters(DBBaseModel):
    type: Literal["google"]
    google: PromptGoogleInvocationParametersContent


PromptInvocationParameters: TypeAlias = Annotated[
    Union[
        PromptOpenAIInvocationParameters,
        PromptAzureOpenAIInvocationParameters,
        PromptAnthropicInvocationParameters,
        PromptGoogleInvocationParameters,
        PromptDeepSeekInvocationParameters,
        PromptXAIInvocationParameters,
        PromptOllamaInvocationParameters,
        PromptAwsInvocationParameters,
        PromptCerebrasInvocationParameters,
        PromptFireworksInvocationParameters,
        PromptGroqInvocationParameters,
        PromptMoonshotInvocationParameters,
        PromptPerplexityInvocationParameters,
        PromptTogetherInvocationParameters,
    ],
    Field(..., discriminator="type"),
]


def openai_family_content_from_invocation_parameters(
    invocation_parameters: PromptInvocationParameters,
) -> PromptOpenAIInvocationParametersContent | None:
    """
    Return the OpenAI-family content object for any persisted OpenAI-compat discriminator.
    """
    if isinstance(invocation_parameters, PromptOpenAIInvocationParameters):
        return invocation_parameters.openai
    if isinstance(invocation_parameters, PromptAzureOpenAIInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.azure_openai.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptDeepSeekInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.deepseek.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptXAIInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.xai.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptOllamaInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.ollama.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptCerebrasInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.cerebras.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptFireworksInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.fireworks.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptGroqInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.groq.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptMoonshotInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.moonshot.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptPerplexityInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.perplexity.model_dump(mode="python")
        )
    if isinstance(invocation_parameters, PromptTogetherInvocationParameters):
        return PromptOpenAIInvocationParametersContent.model_validate(
            invocation_parameters.together.model_dump(mode="python")
        )
    return None


def normalize_invocation_parameters_for_write(
    invocation_parameters: PromptInvocationParameters,
) -> PromptInvocationParameters:
    """
    Coerce OpenAI-family invocation parameters to the single modern discriminator ``openai``.

    Legacy rows may still store ``azure_openai``, ``deepseek``, etc.; new writes through
    REST, GraphQL validation, and clone paths should persist only ``type=\"openai\"`` for
    that family.
    """
    content = openai_family_content_from_invocation_parameters(invocation_parameters)
    if content:
        return PromptOpenAIInvocationParameters(type="openai", openai=content)
    return invocation_parameters


def is_prompt_invocation_parameters(
    invocation_parameters: Any,
) -> TypeGuard[PromptInvocationParameters]:
    return isinstance(
        invocation_parameters,
        (
            PromptOpenAIInvocationParameters,
            PromptAzureOpenAIInvocationParameters,
            PromptAnthropicInvocationParameters,
            PromptGoogleInvocationParameters,
            PromptDeepSeekInvocationParameters,
            PromptXAIInvocationParameters,
            PromptOllamaInvocationParameters,
            PromptAwsInvocationParameters,
            PromptCerebrasInvocationParameters,
            PromptFireworksInvocationParameters,
            PromptGroqInvocationParameters,
            PromptMoonshotInvocationParameters,
            PromptPerplexityInvocationParameters,
            PromptTogetherInvocationParameters,
        ),
    )


class PromptInvocationParametersRootModel(RootModel[PromptInvocationParameters]):
    root: PromptInvocationParameters
