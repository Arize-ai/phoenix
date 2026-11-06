from typing import Any, Optional

from pydantic import Field

from .base_model import BaseModel
from .enums import (
    AnthropicOutputConfigEffort,
    AnthropicThinkingDisplay,
    GenerativeProviderKey,
    GoogleThinkingLevel,
    Language,
    OpenAIReasoningEffort,
    OptimizationDirection,
    PromptMessageRole,
    PromptTemplateFormat,
)


class AnnotationConfigInput(BaseModel):
    categorical: Optional["CategoricalAnnotationConfigInput"] = None
    continuous: Optional["ContinuousAnnotationConfigInput"] = None
    freeform: Optional["FreeformAnnotationConfigInput"] = None


class AnthropicThinkingAdaptiveInput(BaseModel):
    display: Optional[AnthropicThinkingDisplay] = None


class AnthropicThinkingDisabledMarkerInput(BaseModel):
    disabled: bool = True


class AnthropicThinkingEnabledInput(BaseModel):
    budget_tokens: int = Field(alias="budgetTokens")
    display: Optional[AnthropicThinkingDisplay] = None


class CategoricalAnnotationConfigInput(BaseModel):
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    values: list["CategoricalAnnotationConfigValueInput"]


class CategoricalAnnotationConfigValueInput(BaseModel):
    label: str
    score: Optional[float] = None


class ChatPromptVersionInput(BaseModel):
    description: Optional[str] = None
    metadata: Optional[Any] = None
    template_format: PromptTemplateFormat = Field(alias="templateFormat")
    template: "PromptChatTemplateInput"
    invocation_parameters: "PromptInvocationParametersInput" = Field(
        alias="invocationParameters"
    )
    tools: Optional["PromptToolsInput"] = None
    response_format: Optional["PromptResponseFormatJSONSchemaInput"] = Field(
        alias="responseFormat", default=None
    )
    model_provider: GenerativeProviderKey = Field(alias="modelProvider")
    model_name: str = Field(alias="modelName")
    custom_provider_id: Optional[str] = Field(alias="customProviderId", default=None)


class ContentPartInput(BaseModel):
    text: Optional["TextContentValueInput"] = None
    tool_call: Optional["ToolCallContentValueInput"] = Field(
        alias="toolCall", default=None
    )
    tool_result: Optional["ToolResultContentValueInput"] = Field(
        alias="toolResult", default=None
    )


class ContinuousAnnotationConfigInput(BaseModel):
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    lower_bound: Optional[float] = Field(alias="lowerBound", default=None)
    upper_bound: Optional[float] = Field(alias="upperBound", default=None)


class EvaluatorInputMappingInput(BaseModel):
    literal_mapping: Any = Field(alias="literalMapping")
    path_mapping: Any = Field(alias="pathMapping")


class EvaluatorPreviewInput(BaseModel):
    built_in_evaluator_id: Optional[str] = Field(
        alias="builtInEvaluatorId", default=None
    )
    inline_llm_evaluator: Optional["InlineLLMEvaluatorInput"] = Field(
        alias="inlineLlmEvaluator", default=None
    )
    code_evaluator_id: Optional[str] = Field(alias="codeEvaluatorId", default=None)
    inline_code_evaluator: Optional["InlineCodeEvaluatorInput"] = Field(
        alias="inlineCodeEvaluator", default=None
    )


class EvaluatorPreviewItemInput(BaseModel):
    evaluator: "EvaluatorPreviewInput"
    context: Any
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")


class EvaluatorPreviewsInput(BaseModel):
    previews: list["EvaluatorPreviewItemInput"]
    credentials: Optional[list["GenerativeCredentialInput"]] = None


class FreeformAnnotationConfigInput(BaseModel):
    name: str
    description: Optional[str] = None
    optimization_direction: Optional[OptimizationDirection] = Field(
        alias="optimizationDirection", default=None
    )
    threshold: Optional[float] = None
    lower_bound: Optional[float] = Field(alias="lowerBound", default=None)
    upper_bound: Optional[float] = Field(alias="upperBound", default=None)


class GenerativeCredentialInput(BaseModel):
    env_var_name: str = Field(alias="envVarName")
    value: Any


class InlineCodeEvaluatorInput(BaseModel):
    name: str
    language: Language
    source_code: str = Field(alias="sourceCode")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    sandbox_config_id: Optional[str] = Field(alias="sandboxConfigId", default=None)
    description: Optional[str] = None


class InlineLLMEvaluatorInput(BaseModel):
    name: str
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    description: Optional[str] = None


class PromptAnthropicInvocationParametersInput(BaseModel):
    max_tokens: int = Field(alias="maxTokens")
    temperature: Optional[float] = None
    top_p: Optional[float] = Field(alias="topP", default=None)
    stop_sequences: Optional[list[str]] = Field(alias="stopSequences", default=None)
    output_config: Optional["PromptAnthropicOutputConfigInput"] = Field(
        alias="outputConfig", default=None
    )
    thinking: Optional["PromptAnthropicThinkingConfigInput"] = None
    extra_body: Optional[Any] = Field(alias="extraBody", default=None)


class PromptAnthropicOutputConfigInput(BaseModel):
    effort: Optional[AnthropicOutputConfigEffort] = None


class PromptAnthropicThinkingConfigInput(BaseModel):
    disabled: Optional["AnthropicThinkingDisabledMarkerInput"] = None
    enabled: Optional["AnthropicThinkingEnabledInput"] = None
    adaptive: Optional["AnthropicThinkingAdaptiveInput"] = None


class PromptAwsInvocationParametersInput(BaseModel):
    max_tokens: Optional[int] = Field(alias="maxTokens", default=None)
    temperature: Optional[float] = None
    top_p: Optional[float] = Field(alias="topP", default=None)
    stop_sequences: Optional[list[str]] = Field(alias="stopSequences", default=None)


class PromptChatTemplateInput(BaseModel):
    messages: list["PromptMessageInput"]


class PromptGoogleInvocationParametersInput(BaseModel):
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = Field(alias="maxOutputTokens", default=None)
    stop_sequences: Optional[list[str]] = Field(alias="stopSequences", default=None)
    presence_penalty: Optional[float] = Field(alias="presencePenalty", default=None)
    frequency_penalty: Optional[float] = Field(alias="frequencyPenalty", default=None)
    top_p: Optional[float] = Field(alias="topP", default=None)
    top_k: Optional[int] = Field(alias="topK", default=None)
    thinking_config: Optional["PromptGoogleThinkingConfigInput"] = Field(
        alias="thinkingConfig", default=None
    )


class PromptGoogleThinkingConfigInput(BaseModel):
    thinking_budget: Optional[int] = Field(alias="thinkingBudget", default=None)
    thinking_level: Optional[GoogleThinkingLevel] = Field(
        alias="thinkingLevel", default=None
    )
    include_thoughts: Optional[bool] = Field(alias="includeThoughts", default=None)


class PromptInvocationParametersInput(BaseModel):
    openai: Optional["PromptOpenAIInvocationParametersInput"] = None
    anthropic: Optional["PromptAnthropicInvocationParametersInput"] = None
    google: Optional["PromptGoogleInvocationParametersInput"] = None
    aws: Optional["PromptAwsInvocationParametersInput"] = None


class PromptMessageInput(BaseModel):
    role: PromptMessageRole
    content: list["ContentPartInput"]


class PromptOpenAIInvocationParametersInput(BaseModel):
    temperature: Optional[float] = None
    max_tokens: Optional[int] = Field(alias="maxTokens", default=None)
    max_completion_tokens: Optional[int] = Field(
        alias="maxCompletionTokens", default=None
    )
    frequency_penalty: Optional[float] = Field(alias="frequencyPenalty", default=None)
    presence_penalty: Optional[float] = Field(alias="presencePenalty", default=None)
    top_p: Optional[float] = Field(alias="topP", default=None)
    seed: Optional[int] = None
    stop: Optional[list[str]] = None
    reasoning_effort: Optional[OpenAIReasoningEffort] = Field(
        alias="reasoningEffort", default=None
    )
    extra_body: Optional[Any] = Field(alias="extraBody", default=None)


class PromptResponseFormatJSONSchemaDefinitionInput(BaseModel):
    name: str
    description: Optional[str] = None
    schema_: Optional[Any] = Field(alias="schema", default=None)
    strict: Optional[bool] = None


class PromptResponseFormatJSONSchemaInput(BaseModel):
    type_: str = Field(alias="type")
    json_schema: "PromptResponseFormatJSONSchemaDefinitionInput" = Field(
        alias="jsonSchema"
    )


class PromptToolChoiceInput(BaseModel):
    none: Optional[bool] = None
    zero_or_more: Optional[bool] = Field(alias="zeroOrMore", default=None)
    one_or_more: Optional[bool] = Field(alias="oneOrMore", default=None)
    function_name: Optional[str] = Field(alias="functionName", default=None)


class PromptToolFunctionDefinitionInput(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: Optional[Any] = None
    strict: Optional[bool] = None


class PromptToolInput(BaseModel):
    """A single tool on a prompt — set exactly one of `function` or `raw`. `function` is a normalized JSON-Schema-typed function tool that Phoenix converts to each provider's native format. `raw` is a vendor passthrough tool: an opaque JSON object forwarded to the provider SDK as-is (e.g. OpenAI Responses `web_search`, Anthropic `computer_use`)."""

    function: Optional["PromptToolFunctionDefinitionInput"] = None
    "Normalized function tool — provider-agnostic, converted at request time."
    raw: Optional[Any] = None
    "Vendor passthrough tool — opaque JSON forwarded to the provider SDK."


class PromptToolsInput(BaseModel):
    tools: list["PromptToolInput"]
    tool_choice: Optional["PromptToolChoiceInput"] = Field(
        alias="toolChoice", default=None
    )
    disable_parallel_tool_calls: Optional[bool] = Field(
        alias="disableParallelToolCalls", default=None
    )


class TextContentValueInput(BaseModel):
    text: str


class ToolCallContentValueInput(BaseModel):
    tool_call_id: str = Field(alias="toolCallId")
    tool_call: "ToolCallFunctionInput" = Field(alias="toolCall")


class ToolCallFunctionInput(BaseModel):
    type_: Optional[str] = Field(alias="type", default="function")
    name: str
    arguments: str


class ToolResultContentValueInput(BaseModel):
    tool_call_id: str = Field(alias="toolCallId")
    result: Any


AnnotationConfigInput.model_rebuild()
CategoricalAnnotationConfigInput.model_rebuild()
ChatPromptVersionInput.model_rebuild()
ContentPartInput.model_rebuild()
EvaluatorPreviewInput.model_rebuild()
EvaluatorPreviewItemInput.model_rebuild()
EvaluatorPreviewsInput.model_rebuild()
InlineCodeEvaluatorInput.model_rebuild()
InlineLLMEvaluatorInput.model_rebuild()
PromptAnthropicInvocationParametersInput.model_rebuild()
PromptAnthropicThinkingConfigInput.model_rebuild()
PromptChatTemplateInput.model_rebuild()
PromptGoogleInvocationParametersInput.model_rebuild()
PromptInvocationParametersInput.model_rebuild()
PromptMessageInput.model_rebuild()
PromptResponseFormatJSONSchemaInput.model_rebuild()
PromptToolInput.model_rebuild()
PromptToolsInput.model_rebuild()
ToolCallContentValueInput.model_rebuild()
