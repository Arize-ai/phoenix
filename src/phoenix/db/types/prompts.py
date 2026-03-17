from enum import Enum
from typing import Any, Literal, Union

from pydantic import Field, RootModel, model_validator
from typing_extensions import Annotated, Self, TypeAlias, TypeGuard, assert_never

from phoenix.db.types.db_helper_types import UNDEFINED, DBBaseModel
from phoenix.db.types.model_provider import ModelProvider

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


PromptTool: TypeAlias = Annotated[Union[PromptToolFunction], Field(..., discriminator="type")]


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
    reasoning_effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] = UNDEFINED


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
    budget_tokens: int = Field(..., ge=1024)


class PromptAnthropicInvocationParametersContent(DBBaseModel):
    max_tokens: int
    temperature: float = UNDEFINED
    top_p: float = UNDEFINED
    stop_sequences: list[str] = UNDEFINED
    thinking: Annotated[
        Union[PromptAnthropicThinkingConfigDisabled, PromptAnthropicThinkingConfigEnabled],
        Field(..., discriminator="type"),
    ] = UNDEFINED

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


class PromptAwsInvocationParameters(DBBaseModel):
    type: Literal["aws"]
    aws: PromptAwsInvocationParametersContent


class PromptGoogleInvocationParametersContent(DBBaseModel):
    temperature: float = UNDEFINED
    max_output_tokens: int = UNDEFINED
    stop_sequences: list[str] = UNDEFINED
    presence_penalty: float = UNDEFINED
    frequency_penalty: float = UNDEFINED
    top_p: float = UNDEFINED
    top_k: int = UNDEFINED


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


def get_raw_invocation_parameters(
    invocation_parameters: PromptInvocationParameters,
) -> dict[str, Any]:
    if isinstance(invocation_parameters, PromptOpenAIInvocationParameters):
        return invocation_parameters.openai.model_dump()
    if isinstance(invocation_parameters, PromptAzureOpenAIInvocationParameters):
        return invocation_parameters.azure_openai.model_dump()
    if isinstance(invocation_parameters, PromptAnthropicInvocationParameters):
        return invocation_parameters.anthropic.model_dump()
    if isinstance(invocation_parameters, PromptGoogleInvocationParameters):
        return invocation_parameters.google.model_dump()
    if isinstance(invocation_parameters, PromptDeepSeekInvocationParameters):
        return invocation_parameters.deepseek.model_dump()
    if isinstance(invocation_parameters, PromptXAIInvocationParameters):
        return invocation_parameters.xai.model_dump()
    if isinstance(invocation_parameters, PromptOllamaInvocationParameters):
        return invocation_parameters.ollama.model_dump()
    if isinstance(invocation_parameters, PromptAwsInvocationParameters):
        return invocation_parameters.aws.model_dump()
    if isinstance(invocation_parameters, PromptCerebrasInvocationParameters):
        return invocation_parameters.cerebras.model_dump()
    if isinstance(invocation_parameters, PromptFireworksInvocationParameters):
        return invocation_parameters.fireworks.model_dump()
    if isinstance(invocation_parameters, PromptGroqInvocationParameters):
        return invocation_parameters.groq.model_dump()
    if isinstance(invocation_parameters, PromptMoonshotInvocationParameters):
        return invocation_parameters.moonshot.model_dump()
    if isinstance(invocation_parameters, PromptPerplexityInvocationParameters):
        return invocation_parameters.perplexity.model_dump()
    if isinstance(invocation_parameters, PromptTogetherInvocationParameters):
        return invocation_parameters.together.model_dump()
    assert_never(invocation_parameters)


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


def validate_invocation_parameters(
    invocation_parameters: dict[str, Any],
    model_provider: ModelProvider,
) -> PromptInvocationParameters:
    if model_provider is ModelProvider.OPENAI:
        return PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.AZURE_OPENAI:
        return PromptAzureOpenAIInvocationParameters(
            type="azure_openai",
            azure_openai=PromptAzureOpenAIInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.DEEPSEEK:
        return PromptDeepSeekInvocationParameters(
            type="deepseek",
            deepseek=PromptDeepSeekInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.ANTHROPIC:
        return PromptAnthropicInvocationParameters(
            type="anthropic",
            anthropic=PromptAnthropicInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.GOOGLE:
        return PromptGoogleInvocationParameters(
            type="google",
            google=PromptGoogleInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.XAI:
        return PromptXAIInvocationParameters(
            type="xai",
            xai=PromptXAIInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.OLLAMA:
        return PromptOllamaInvocationParameters(
            type="ollama",
            ollama=PromptOllamaInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.AWS:
        return PromptAwsInvocationParameters(
            type="aws",
            aws=PromptAwsInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.CEREBRAS:
        return PromptCerebrasInvocationParameters(
            type="cerebras",
            cerebras=PromptCerebrasInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.FIREWORKS:
        return PromptFireworksInvocationParameters(
            type="fireworks",
            fireworks=PromptFireworksInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.GROQ:
        return PromptGroqInvocationParameters(
            type="groq",
            groq=PromptGroqInvocationParametersContent.model_validate(invocation_parameters),
        )
    elif model_provider is ModelProvider.MOONSHOT:
        return PromptMoonshotInvocationParameters(
            type="moonshot",
            moonshot=PromptMoonshotInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.PERPLEXITY:
        return PromptPerplexityInvocationParameters(
            type="perplexity",
            perplexity=PromptPerplexityInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    elif model_provider is ModelProvider.TOGETHER:
        return PromptTogetherInvocationParameters(
            type="together",
            together=PromptTogetherInvocationParametersContent.model_validate(
                invocation_parameters
            ),
        )
    assert_never(model_provider)
