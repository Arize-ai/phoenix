"""Do not edit"""

from __future__ import annotations

from typing import Any, Literal, Mapping, Optional, Sequence, TypedDict, Union

from typing_extensions import NotRequired


class CategoricalAnnotationValue(TypedDict):
    label: str
    score: NotRequired[float]


class CreateExperimentRequestBody(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]
    version_id: NotRequired[str]
    repetitions: NotRequired[int]


class CreateExperimentRunRequestBody(TypedDict):
    dataset_example_id: str
    output: Any
    repetition_number: int
    start_time: str
    end_time: str
    trace_id: NotRequired[str]
    error: NotRequired[str]


class CreateExperimentRunResponseBodyData(TypedDict):
    id: str


class CreateProjectRequestBody(TypedDict):
    name: str
    description: NotRequired[str]


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


class ExperimentEvaluationResult(TypedDict):
    label: NotRequired[str]
    score: NotRequired[float]
    explanation: NotRequired[str]


class ExperimentRunResponse(TypedDict):
    dataset_example_id: str
    output: Any
    repetition_number: int
    start_time: str
    end_time: str
    id: str
    experiment_id: str
    trace_id: NotRequired[str]
    error: NotRequired[str]


class FreeformAnnotationConfig(TypedDict):
    type: Literal["FREEFORM"]
    name: str
    id: str
    description: NotRequired[str]


class FreeformAnnotationConfigData(TypedDict):
    type: Literal["FREEFORM"]
    name: str
    description: NotRequired[str]


class GetDatasetResponseBody(TypedDict):
    data: DatasetWithExampleCount


class GetExperimentResponseBody(TypedDict):
    data: Experiment


class InsertedSpanAnnotation(TypedDict):
    id: str


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


class ListExperimentRunsResponseBody(TypedDict):
    data: Sequence[ExperimentRunResponse]


class ListExperimentsResponseBody(TypedDict):
    data: Sequence[Experiment]


class Project(TypedDict):
    name: str
    id: str
    description: NotRequired[str]


class PromptData(TypedDict):
    name: str
    description: NotRequired[str]
    source_prompt_id: NotRequired[str]


class Prompt(PromptData):
    id: str


class PromptAnthropicThinkingConfigDisabled(TypedDict):
    type: Literal["disabled"]


class PromptAnthropicThinkingConfigEnabled(TypedDict):
    type: Literal["enabled"]
    budget_tokens: int


class PromptAzureOpenAIInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    reasoning_effort: NotRequired[Literal["low", "medium", "high"]]


class PromptGoogleInvocationParametersContent(TypedDict):
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
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    reasoning_effort: NotRequired[Literal["low", "medium", "high"]]


class PromptResponseFormatJSONSchemaDefinition(TypedDict):
    name: str
    description: NotRequired[str]
    schema: NotRequired[Mapping[str, Any]]
    strict: NotRequired[bool]


class PromptStringTemplate(TypedDict):
    type: Literal["string"]
    template: str


class PromptToolChoiceNone(TypedDict):
    type: Literal["none"]


class PromptToolChoiceOneOrMore(TypedDict):
    type: Literal["one_or_more"]


class PromptToolChoiceSpecificFunctionTool(TypedDict):
    type: Literal["specific_function"]
    function_name: str


class PromptToolChoiceZeroOrMore(TypedDict):
    type: Literal["zero_or_more"]


class PromptToolFunctionDefinition(TypedDict):
    name: str
    description: NotRequired[str]
    parameters: NotRequired[Mapping[str, Any]]
    strict: NotRequired[bool]


class PromptVersionTag(TypedDict):
    name: str
    id: str
    description: NotRequired[str]


class PromptVersionTagData(TypedDict):
    name: str
    description: NotRequired[str]


class SpanAnnotationResult(TypedDict):
    label: NotRequired[str]
    score: NotRequired[float]
    explanation: NotRequired[str]


class TextContentPart(TypedDict):
    type: Literal["text"]
    text: str


class ToolCallFunction(TypedDict):
    type: Literal["function"]
    name: str
    arguments: str


class ToolResultContentPart(TypedDict):
    type: Literal["tool_result"]
    tool_call_id: str
    tool_result: Optional[Union[bool, int, float, str, Mapping[str, Any], Sequence[Any]]]


class UpdateProjectRequestBody(TypedDict):
    description: NotRequired[str]


class UpdateProjectResponseBody(TypedDict):
    data: Project


class UploadDatasetData(TypedDict):
    dataset_id: str


class UploadDatasetResponseBody(TypedDict):
    data: UploadDatasetData


class UpsertExperimentEvaluationRequestBody(TypedDict):
    experiment_run_id: str
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    start_time: str
    end_time: str
    result: ExperimentEvaluationResult
    error: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]
    trace_id: NotRequired[str]


class UpsertExperimentEvaluationResponseBodyData(TypedDict):
    id: str


class ValidationError(TypedDict):
    loc: Sequence[Union[str, int]]
    msg: str
    type: str


class AnnotateSpansResponseBody(TypedDict):
    data: Sequence[InsertedSpanAnnotation]


class CategoricalAnnotationConfig(TypedDict):
    type: Literal["CATEGORICAL"]
    name: str
    optimization_direction: Literal["MINIMIZE", "MAXIMIZE", "NONE"]
    values: Sequence[CategoricalAnnotationValue]
    id: str
    description: NotRequired[str]


class CategoricalAnnotationConfigData(TypedDict):
    type: Literal["CATEGORICAL"]
    name: str
    optimization_direction: Literal["MINIMIZE", "MAXIMIZE", "NONE"]
    values: Sequence[CategoricalAnnotationValue]
    description: NotRequired[str]


class ContinuousAnnotationConfig(TypedDict):
    type: Literal["CONTINUOUS"]
    name: str
    optimization_direction: Literal["MINIMIZE", "MAXIMIZE", "NONE"]
    id: str
    description: NotRequired[str]
    lower_bound: NotRequired[float]
    upper_bound: NotRequired[float]


class ContinuousAnnotationConfigData(TypedDict):
    type: Literal["CONTINUOUS"]
    name: str
    optimization_direction: Literal["MINIMIZE", "MAXIMIZE", "NONE"]
    description: NotRequired[str]
    lower_bound: NotRequired[float]
    upper_bound: NotRequired[float]


class CreateAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class CreateExperimentResponseBody(TypedDict):
    data: Experiment


class CreateExperimentRunResponseBody(TypedDict):
    data: CreateExperimentRunResponseBodyData


class CreateProjectResponseBody(TypedDict):
    data: Project


class DeleteAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class GetAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class GetAnnotationConfigsResponseBody(TypedDict):
    data: Sequence[
        Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]
    ]
    next_cursor: Optional[str]


class GetProjectResponseBody(TypedDict):
    data: Project


class GetProjectsResponseBody(TypedDict):
    data: Sequence[Project]
    next_cursor: Optional[str]


class GetPromptVersionTagsResponseBody(TypedDict):
    data: Sequence[PromptVersionTag]
    next_cursor: Optional[str]


class GetPromptsResponseBody(TypedDict):
    data: Sequence[Prompt]
    next_cursor: Optional[str]


class HTTPValidationError(TypedDict):
    detail: NotRequired[Sequence[ValidationError]]


class PromptAnthropicInvocationParametersContent(TypedDict):
    max_tokens: int
    temperature: NotRequired[float]
    top_p: NotRequired[float]
    stop_sequences: NotRequired[Sequence[str]]
    thinking: NotRequired[
        Union[PromptAnthropicThinkingConfigDisabled, PromptAnthropicThinkingConfigEnabled]
    ]


class PromptAzureOpenAIInvocationParameters(TypedDict):
    type: Literal["azure_openai"]
    azure_openai: PromptAzureOpenAIInvocationParametersContent


class PromptGoogleInvocationParameters(TypedDict):
    type: Literal["google"]
    google: PromptGoogleInvocationParametersContent


class PromptOpenAIInvocationParameters(TypedDict):
    type: Literal["openai"]
    openai: PromptOpenAIInvocationParametersContent


class PromptResponseFormatJSONSchema(TypedDict):
    type: Literal["json_schema"]
    json_schema: PromptResponseFormatJSONSchemaDefinition


class PromptToolFunction(TypedDict):
    type: Literal["function"]
    function: PromptToolFunctionDefinition


class PromptTools(TypedDict):
    type: Literal["tools"]
    tools: Sequence[PromptToolFunction]
    tool_choice: NotRequired[
        Union[
            PromptToolChoiceNone,
            PromptToolChoiceZeroOrMore,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
        ]
    ]
    disable_parallel_tool_calls: NotRequired[bool]


class SpanAnnotationData(TypedDict):
    span_id: str
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    result: NotRequired[SpanAnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]
    identifier: NotRequired[str]


class SpanAnnotation(SpanAnnotationData):
    id: str
    created_at: str
    updated_at: str
    source: Literal["API", "APP"]
    user_id: Optional[str]


class SpanAnnotationsResponseBody(TypedDict):
    data: Sequence[SpanAnnotation]
    next_cursor: Optional[str]


class ToolCallContentPart(TypedDict):
    type: Literal["tool_call"]
    tool_call_id: str
    tool_call: ToolCallFunction


class UpdateAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class UpsertExperimentEvaluationResponseBody(TypedDict):
    data: UpsertExperimentEvaluationResponseBodyData


class AnnotateSpansRequestBody(TypedDict):
    data: Sequence[SpanAnnotationData]


class PromptAnthropicInvocationParameters(TypedDict):
    type: Literal["anthropic"]
    anthropic: PromptAnthropicInvocationParametersContent


class PromptMessage(TypedDict):
    role: Literal["user", "assistant", "model", "ai", "tool", "system", "developer"]
    content: Union[
        str, Sequence[Union[TextContentPart, ToolCallContentPart, ToolResultContentPart]]
    ]


class PromptChatTemplate(TypedDict):
    type: Literal["chat"]
    messages: Sequence[PromptMessage]


class PromptVersionData(TypedDict):
    model_provider: Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GOOGLE"]
    model_name: str
    template: Union[PromptChatTemplate, PromptStringTemplate]
    template_type: Literal["STR", "CHAT"]
    template_format: Literal["MUSTACHE", "F_STRING", "NONE"]
    invocation_parameters: Union[
        PromptOpenAIInvocationParameters,
        PromptAzureOpenAIInvocationParameters,
        PromptAnthropicInvocationParameters,
        PromptGoogleInvocationParameters,
    ]
    description: NotRequired[str]
    tools: NotRequired[PromptTools]
    response_format: NotRequired[PromptResponseFormatJSONSchema]


class PromptVersion(PromptVersionData):
    id: str


class CreatePromptRequestBody(TypedDict):
    prompt: PromptData
    version: PromptVersionData


class CreatePromptResponseBody(TypedDict):
    data: PromptVersion


class GetPromptResponseBody(TypedDict):
    data: PromptVersion


class GetPromptVersionsResponseBody(TypedDict):
    data: Sequence[PromptVersion]
    next_cursor: Optional[str]
