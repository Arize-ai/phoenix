# pyright: reportUnusedImport=false
"""Do not edit"""

from __future__ import annotations

from typing import Any, Literal, Mapping, Optional, Sequence, TypedDict, Union

from typing_extensions import NotRequired


class CreateExperimentRequestBody(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]
    version_id: NotRequired[str]
    repetitions: NotRequired[int]


class Dataset(TypedDict):
    id: str
    name: str
    description: Optional[str]
    metadata: Mapping[str, Any]
    created_at: str
    updated_at: str


class DatasetExample(TypedDict):
    id: str
    input: Mapping[str, Any]
    output: Mapping[str, Any]
    metadata: Mapping[str, Any]
    updated_at: str


class DatasetVersion(TypedDict):
    version_id: str
    description: Optional[str]
    metadata: Mapping[str, Any]
    created_at: str


class DatasetWithExampleCount(TypedDict):
    id: str
    name: str
    description: Optional[str]
    metadata: Mapping[str, Any]
    created_at: str
    updated_at: str
    example_count: int


class Experiment(TypedDict):
    id: str
    dataset_id: str
    dataset_version_id: str
    repetitions: int
    metadata: Mapping[str, Any]
    project_name: Optional[str]
    created_at: str
    updated_at: str


class GetDatasetResponseBody(TypedDict):
    data: DatasetWithExampleCount


class GetExperimentResponseBody(TypedDict):
    data: Experiment


class InsertedSpanAnnotation(TypedDict):
    id: str


class JSONSchemaDraft7ObjectSchema(TypedDict):
    json: Mapping[str, Any]
    type: Literal["json-schema-draft-7-object-schema"]


class ListDatasetExamplesData(TypedDict):
    dataset_id: str
    version_id: str
    examples: Sequence[DatasetExample]


class ListDatasetExamplesResponseBody(TypedDict):
    data: ListDatasetExamplesData


class ListDatasetVersionsResponseBody(TypedDict):
    data: Sequence[DatasetVersion]
    next_cursor: Optional[str]


class ListDatasetsResponseBody(TypedDict):
    data: Sequence[Dataset]
    next_cursor: Optional[str]


class ListExperimentsResponseBody(TypedDict):
    data: Sequence[Experiment]


class Prompt(TypedDict):
    id: str
    source_prompt_id: Optional[str]
    name: str
    description: Optional[str]


class PromptAnthropicInvocationParametersContent(TypedDict):
    max_tokens: int
    temperature: NotRequired[float]
    top_p: NotRequired[float]
    stop_sequences: NotRequired[Sequence[str]]


class PromptAzureOpenAIInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    reasoning_effort: NotRequired[Literal["low", "medium", "high"]]


class PromptFunctionTool(TypedDict):
    name: str
    type: Literal["function-tool"]
    description: NotRequired[str]
    schema: NotRequired[JSONSchemaDraft7ObjectSchema]
    extra_parameters: NotRequired[Mapping[str, Any]]


class PromptGeminiInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_output_tokens: NotRequired[int]
    stop_sequences: NotRequired[Sequence[str]]
    presence_penalty: NotRequired[float]
    frequency_penalty: NotRequired[float]
    top_p: NotRequired[float]
    top_k: NotRequired[int]


class PromptOpenAIInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    reasoning_effort: NotRequired[Literal["low", "medium", "high"]]


class PromptResponseFormatJSONSchema(TypedDict):
    name: str
    schema: JSONSchemaDraft7ObjectSchema
    extra_parameters: Mapping[str, Any]
    type: Literal["response-format-json-schema"]
    description: NotRequired[str]


class PromptStringTemplate(TypedDict):
    template: str
    type: Literal["string"]


class PromptToolChoiceNone(TypedDict):
    type: Literal["none"]


class PromptToolChoiceOneOrMore(TypedDict):
    type: Literal["one-or-more"]


class PromptToolChoiceSpecificFunctionTool(TypedDict):
    function_name: str
    type: Literal["specific-function-tool"]


class PromptToolChoiceZeroOrMore(TypedDict):
    type: Literal["zero-or-more"]


class PromptTools(TypedDict):
    tools: Sequence[PromptFunctionTool]
    type: Literal["tools"]
    tool_choice: NotRequired[
        Union[
            PromptToolChoiceNone,
            PromptToolChoiceZeroOrMore,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
        ]
    ]
    disable_parallel_tool_calls: NotRequired[bool]


class SpanAnnotationResult(TypedDict):
    label: NotRequired[str]
    score: NotRequired[float]
    explanation: NotRequired[str]


class TextContentValue(TypedDict):
    text: str


class ToolCallFunction(TypedDict):
    name: str
    arguments: str
    type: Literal["function"]


class ToolResultContentValue(TypedDict):
    tool_call_id: str
    result: Optional[Union[bool, int, float, str, Mapping[str, Any], Sequence[Any]]]


class UploadDatasetData(TypedDict):
    dataset_id: str


class UploadDatasetResponseBody(TypedDict):
    data: UploadDatasetData


class ValidationError(TypedDict):
    loc: Sequence[Union[str, int]]
    msg: str
    type: str


class AnnotateSpansResponseBody(TypedDict):
    data: Sequence[InsertedSpanAnnotation]


class CreateExperimentResponseBody(TypedDict):
    data: Experiment


class GetPromptsResponseBody(TypedDict):
    data: Sequence[Prompt]


class HTTPValidationError(TypedDict):
    detail: NotRequired[Sequence[ValidationError]]


class PromptAnthropicInvocationParameters(TypedDict):
    anthropic: PromptAnthropicInvocationParametersContent
    type: Literal["anthropic"]


class PromptAzureOpenAIInvocationParameters(TypedDict):
    azure_openai: PromptAzureOpenAIInvocationParametersContent
    type: Literal["azure_openai"]


class PromptGeminiInvocationParameters(TypedDict):
    gemini: PromptGeminiInvocationParametersContent
    type: Literal["gemini"]


class PromptOpenAIInvocationParameters(TypedDict):
    openai: PromptOpenAIInvocationParametersContent
    type: Literal["openai"]


class SpanAnnotation(TypedDict):
    span_id: str
    name: str
    annotator_kind: Literal["LLM", "HUMAN"]
    result: NotRequired[SpanAnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]


class TextContentPart(TypedDict):
    text: TextContentValue
    type: Literal["text"]


class ToolCallContentValue(TypedDict):
    tool_call_id: str
    tool_call: ToolCallFunction


class ToolResultContentPart(TypedDict):
    tool_result: ToolResultContentValue
    type: Literal["tool_result"]


class AnnotateSpansRequestBody(TypedDict):
    data: Sequence[SpanAnnotation]


class ToolCallContentPart(TypedDict):
    tool_call: ToolCallContentValue
    type: Literal["tool_call"]


class PromptMessage(TypedDict):
    role: Literal["USER", "SYSTEM", "AI", "TOOL"]
    content: Sequence[Union[TextContentPart, ToolCallContentPart, ToolResultContentPart]]


class PromptChatTemplate(TypedDict):
    messages: Sequence[PromptMessage]
    type: Literal["chat"]


class PromptVersion(TypedDict):
    id: str
    description: str
    model_provider: Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GEMINI"]
    model_name: str
    template: Union[PromptChatTemplate, PromptStringTemplate]
    template_type: Literal["STR", "CHAT"]
    template_format: Literal["MUSTACHE", "FSTRING", "NONE"]
    invocation_parameters: Union[
        PromptOpenAIInvocationParameters,
        PromptAzureOpenAIInvocationParameters,
        PromptAnthropicInvocationParameters,
        PromptGeminiInvocationParameters,
    ]
    tools: NotRequired[PromptTools]
    response_format: NotRequired[PromptResponseFormatJSONSchema]


class GetPromptResponseBody(TypedDict):
    data: PromptVersion


class GetPromptVersionsResponseBody(TypedDict):
    data: Sequence[PromptVersion]
