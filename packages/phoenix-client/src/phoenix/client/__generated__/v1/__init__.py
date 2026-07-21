"""Do not edit"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Mapping, Optional, Sequence, TypedDict, Union

from typing_extensions import NotRequired


class AgentSpanContext(TypedDict):
    type: Literal["span"]
    projectNodeId: NotRequired[str]
    spanNodeId: NotRequired[str]
    otelSpanId: NotRequired[str]


class AnnotationResult(TypedDict):
    label: NotRequired[str]
    score: NotRequired[float]
    explanation: NotRequired[str]


class AnonymousUser(TypedDict):
    auth_method: Literal["ANONYMOUS"]


class ApiKey(TypedDict):
    id: str
    name: str
    created_at: str
    description: NotRequired[str]
    expires_at: NotRequired[str]


class ApiKeyData(TypedDict):
    name: str
    description: NotRequired[str]
    expires_at: NotRequired[str]


class ApiKeyUser(TypedDict):
    id: str
    username: str
    email: Optional[str]


class AppContext(TypedDict):
    type: Literal["app"]
    currentDateTime: str
    timeZone: str


class AssistantMessageMetadataTraceIds(TypedDict):
    traceId: str
    rootSpanId: str


class AssistantMessageMetadataUsageTokenDetails(TypedDict):
    cacheRead: int
    cacheWrite: int


class AssistantMessageMetadataUsageTokens(TypedDict):
    prompt: int
    completion: int
    total: int


class CategoricalAnnotationValue(TypedDict):
    label: str
    score: NotRequired[float]


class CodeEvaluatorContext(TypedDict):
    type: Literal["code_evaluator"]
    evaluatorNodeId: NotRequired[str]


class CreateApiKeyRequestBody(TypedDict):
    data: ApiKeyData


class CreateDatasetLabelRequestBody(TypedDict):
    name: str
    color: str
    description: NotRequired[str]


class CreateExperimentRequestBody(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]
    version_id: NotRequired[str]
    splits: NotRequired[Sequence[str]]
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


class CreateSpansResponseBody(TypedDict):
    total_received: int
    total_queued: int


class CreatedApiKey(TypedDict):
    id: str
    name: str
    created_at: str
    key: str
    description: NotRequired[str]
    expires_at: NotRequired[str]


class CustomProviderModelSelection(TypedDict):
    providerId: str
    modelName: str
    providerType: Literal["custom"]


class DataUIPart(TypedDict):
    type: str
    data: Any
    id: NotRequired[str]


class Dataset(TypedDict):
    id: str
    name: str
    description: Optional[str]
    metadata: Mapping[str, Any]
    created_at: str
    updated_at: str
    example_count: int


class DatasetContext(TypedDict):
    type: Literal["dataset"]
    datasetNodeId: str
    datasetVersionNodeId: NotRequired[str]


class DatasetExample(TypedDict):
    id: str
    node_id: str
    input: Mapping[str, Any]
    output: Mapping[str, Any]
    metadata: Mapping[str, Any]
    updated_at: str


class DatasetLabel(TypedDict):
    id: str
    name: str
    description: Optional[str]
    color: str


class DatasetVersion(TypedDict):
    version_id: str
    description: Optional[str]
    metadata: Mapping[str, Any]
    created_at: datetime


class DatasetWithExampleCount(TypedDict):
    id: str
    name: str
    description: Optional[str]
    metadata: Mapping[str, Any]
    created_at: str
    updated_at: str
    example_count: int


class DeleteSessionsRequestBody(TypedDict):
    session_identifiers: Sequence[str]


class Experiment(TypedDict):
    id: str
    dataset_id: str
    dataset_version_id: str
    name: str
    description: Optional[str]
    repetitions: int
    metadata: Mapping[str, Any]
    project_name: Optional[str]
    created_at: str
    updated_at: str
    example_count: int
    successful_run_count: int
    failed_run_count: int
    missing_run_count: int


class ExperimentEvaluationResult(TypedDict):
    label: NotRequired[str]
    score: NotRequired[float]
    explanation: NotRequired[str]


class ExperimentRun(TypedDict):
    dataset_example_id: str
    output: Any
    repetition_number: int
    start_time: str
    end_time: str
    id: str
    experiment_id: str
    trace_id: NotRequired[str]
    error: NotRequired[str]


class FileUIPart(TypedDict):
    type: Literal["file"]
    mediaType: str
    url: str
    filename: NotRequired[str]
    providerMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]


class GetApiKeysResponseBody(TypedDict):
    data: Sequence[ApiKey]


class GetDatasetLabelResponseBody(TypedDict):
    data: DatasetLabel


class GetDatasetLabelsResponseBody(TypedDict):
    data: Sequence[DatasetLabel]
    next_cursor: Optional[str]


class GetDatasetResponseBody(TypedDict):
    data: DatasetWithExampleCount


class GetExperimentResponseBody(TypedDict):
    data: Experiment


class GraphQLContext(TypedDict):
    type: Literal["graphql"]
    mutationsEnabled: bool


class IncompleteExperimentEvaluation(TypedDict):
    experiment_run: ExperimentRun
    dataset_example: DatasetExample
    evaluation_names: Sequence[str]


class IncompleteExperimentRun(TypedDict):
    dataset_example: DatasetExample
    repetition_numbers: Sequence[int]


class InsertedSessionAnnotation(TypedDict):
    id: str


class InsertedSpanAnnotation(TypedDict):
    id: str


class InsertedSpanDocumentAnnotation(TypedDict):
    id: str


class InsertedTraceAnnotation(TypedDict):
    id: str


class LDAPUser(TypedDict):
    id: str
    created_at: str
    updated_at: str
    email: str
    username: str
    role: Literal["SYSTEM", "ADMIN", "MEMBER", "VIEWER"]
    auth_method: Literal["LDAP"]


class LDAPUserData(TypedDict):
    email: str
    username: str
    role: Literal["SYSTEM", "ADMIN", "MEMBER", "VIEWER"]
    auth_method: Literal["LDAP"]


class ListDatasetExamplesData(TypedDict):
    dataset_id: str
    version_id: str
    examples: Sequence[DatasetExample]
    filtered_splits: NotRequired[Sequence[str]]


class ListDatasetExamplesResponseBody(TypedDict):
    data: ListDatasetExamplesData


class ListDatasetLabelsForDatasetResponseBody(TypedDict):
    data: Sequence[DatasetLabel]


class ListDatasetVersionsResponseBody(TypedDict):
    data: Sequence[DatasetVersion]
    next_cursor: Optional[str]


class ListDatasetsResponseBody(TypedDict):
    data: Sequence[Dataset]
    next_cursor: Optional[str]


class ListExperimentRunsResponseBody(TypedDict):
    data: Sequence[ExperimentRun]
    next_cursor: Optional[str]


class ListExperimentsResponseBody(TypedDict):
    data: Sequence[Experiment]
    next_cursor: Optional[str]


class LlmEvaluatorContext(TypedDict):
    type: Literal["llm_evaluator"]
    evaluatorNodeId: NotRequired[str]


class LocalUserData(TypedDict):
    email: str
    username: str
    role: Literal["SYSTEM", "ADMIN", "MEMBER", "VIEWER"]
    auth_method: Literal["LOCAL"]
    password: NotRequired[str]


class LocalUser(LocalUserData):
    id: str
    created_at: str
    updated_at: str
    password_needs_reset: bool


class OAuth2UserData(TypedDict):
    email: str
    username: str
    role: Literal["SYSTEM", "ADMIN", "MEMBER", "VIEWER"]
    auth_method: Literal["OAUTH2"]
    oauth2_client_id: NotRequired[str]
    oauth2_user_id: NotRequired[str]


class OAuth2User(OAuth2UserData):
    id: str
    created_at: str
    updated_at: str
    profile_picture_url: NotRequired[str]


class OtlpStatus(TypedDict):
    code: NotRequired[int]
    message: NotRequired[str]


class PlaygroundBuiltinModelContext(TypedDict):
    type: Literal["builtin"]
    provider: str
    modelName: str


class PlaygroundCustomProviderModelContext(TypedDict):
    type: Literal["custom"]
    customProviderId: str
    customProviderName: str
    provider: str
    modelName: str


class PlaygroundEvaluatorContext(TypedDict):
    datasetEvaluatorId: str
    name: str
    kind: Literal["LLM", "CODE", "BUILTIN"]
    isBuiltin: bool
    isApplied: bool


class PlaygroundExperimentScaffoldContext(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    hasMetadata: NotRequired[bool]


class PlaygroundInstanceContext(TypedDict):
    instanceId: int
    model: NotRequired[Union[PlaygroundBuiltinModelContext, PlaygroundCustomProviderModelContext]]
    experimentId: NotRequired[str]


class Project(TypedDict):
    name: str
    id: str
    description: NotRequired[str]


class ProjectContext(TypedDict):
    type: Literal["project"]
    projectNodeId: str
    spanFilter: NotRequired[str]
    rootSpansOnly: NotRequired[bool]


class PromptData(TypedDict):
    name: str
    description: NotRequired[str]
    source_prompt_id: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]


class Prompt(PromptData):
    id: str


class PromptAnthropicOutputConfig(TypedDict):
    effort: NotRequired[Literal["low", "medium", "high", "xhigh", "max"]]


class PromptAnthropicThinkingConfigAdaptive(TypedDict):
    type: Literal["adaptive"]
    display: NotRequired[Literal["summarized", "omitted"]]


class PromptAnthropicThinkingConfigDisabled(TypedDict):
    type: Literal["disabled"]


class PromptAnthropicThinkingConfigEnabled(TypedDict):
    type: Literal["enabled"]
    budget_tokens: int
    display: NotRequired[Literal["summarized", "omitted"]]


class PromptAwsInvocationParametersContent(TypedDict):
    max_tokens: NotRequired[int]
    temperature: NotRequired[float]
    top_p: NotRequired[float]
    stop_sequences: NotRequired[Sequence[str]]


class PromptAzureOpenAIInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptCerebrasInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptContext(TypedDict):
    type: Literal["prompt"]
    promptNodeId: str


class PromptDeepSeekInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptFireworksInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptGoogleThinkingConfig(TypedDict):
    thinking_budget: NotRequired[int]
    thinking_level: NotRequired[Literal["minimal", "low", "medium", "high"]]
    include_thoughts: NotRequired[bool]


class PromptGroqInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptMoonshotInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptOllamaInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptOpenAIInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptPerplexityInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptResponseFormatJSONSchemaDefinition(TypedDict):
    name: str
    description: NotRequired[str]
    schema: NotRequired[Mapping[str, Any]]
    strict: NotRequired[bool]


class PromptStringTemplate(TypedDict):
    type: Literal["string"]
    template: str


class PromptTogetherInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


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


class PromptToolRaw(TypedDict):
    type: Literal["raw"]
    raw: Mapping[str, Any]


class PromptVersionContext(TypedDict):
    type: Literal["prompt_version"]
    promptNodeId: str
    promptVersionNodeId: str


class PromptVersionTag(TypedDict):
    name: str
    id: str
    description: NotRequired[str]


class PromptVersionTagData(TypedDict):
    name: str
    description: NotRequired[str]


class PromptXAIInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_tokens: NotRequired[int]
    max_completion_tokens: NotRequired[int]
    frequency_penalty: NotRequired[float]
    presence_penalty: NotRequired[float]
    top_p: NotRequired[float]
    seed: NotRequired[int]
    stop: NotRequired[Sequence[str]]
    reasoning_effort: NotRequired[Literal["none", "minimal", "low", "medium", "high", "xhigh"]]
    extra_body: NotRequired[Mapping[str, Any]]


class ReasoningUIPart(TypedDict):
    type: Literal["reasoning"]
    text: str
    state: NotRequired[Literal["streaming", "done"]]
    providerMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]


class SecretKeyValue(TypedDict):
    key: str
    value: Optional[str]


class SessionAnnotation(TypedDict):
    id: str
    created_at: str
    updated_at: str
    source: Literal["API", "APP"]
    user_id: Optional[str]
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    session_id: str
    result: NotRequired[AnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]
    identifier: NotRequired[str]


class SessionAnnotationData(TypedDict):
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    session_id: str
    result: NotRequired[AnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]
    identifier: NotRequired[str]


class SessionAnnotationsResponseBody(TypedDict):
    data: Sequence[SessionAnnotation]
    next_cursor: Optional[str]


class SessionContext(TypedDict):
    type: Literal["session"]
    projectNodeId: str
    sessionNodeId: str


class SessionNoteData(TypedDict):
    session_id: str
    note: str
    identifier: NotRequired[str]


class SessionTraceData(TypedDict):
    id: str
    trace_id: str
    start_time: str
    end_time: str


class SetDatasetLabelsForDatasetResponseBody(TypedDict):
    data: Sequence[DatasetLabel]


class SetDatasetLabelsRequestBody(TypedDict):
    dataset_label_ids: NotRequired[Sequence[str]]


class SetProjectAnnotationConfigsRequestBody(TypedDict):
    annotation_config_ids: Sequence[str]


class SourceDocumentUIPart(TypedDict):
    type: Literal["source-document"]
    sourceId: str
    mediaType: str
    title: str
    filename: NotRequired[str]
    providerMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]


class SourceUrlUIPart(TypedDict):
    type: Literal["source-url"]
    sourceId: str
    url: str
    title: NotRequired[str]
    providerMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]


class SpanAnnotationData(TypedDict):
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    span_id: str
    result: NotRequired[AnnotationResult]
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


class SpanContext(TypedDict):
    trace_id: str
    span_id: str


class SpanDocumentAnnotationData(TypedDict):
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    span_id: str
    document_position: int
    result: NotRequired[AnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]
    identifier: NotRequired[str]


class SpanEvent(TypedDict):
    name: str
    timestamp: str
    attributes: NotRequired[Mapping[str, Any]]


class SpanNoteData(TypedDict):
    span_id: str
    note: str
    identifier: NotRequired[str]


class StepStartUIPart(TypedDict):
    type: Literal["step-start"]


class SubagentsContext(TypedDict):
    type: Literal["subagents"]
    enabled: bool


class TextContentPart(TypedDict):
    type: Literal["text"]
    text: str


class TextUIPart(TypedDict):
    type: Literal["text"]
    text: str
    state: NotRequired[Literal["streaming", "done"]]
    providerMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]


class ToolApprovalRequested(TypedDict):
    id: str


class ToolApprovalResponded(TypedDict):
    id: str
    approved: bool
    reason: NotRequired[str]


class ToolApprovalRespondedPart(TypedDict):
    type: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolCallFunction(TypedDict):
    type: Literal["function"]
    name: str
    arguments: str


class ToolInputAvailablePart(TypedDict):
    type: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolInputStreamingPart(TypedDict):
    type: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolOutputAvailablePart(TypedDict):
    type: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    output: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    preliminary: NotRequired[bool]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolOutputDeniedPart(TypedDict):
    type: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolOutputErrorPart(TypedDict):
    type: str
    toolCallId: str
    errorText: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    rawInput: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolResultContentPart(TypedDict):
    type: Literal["tool_result"]
    tool_call_id: str
    tool_result: Optional[Union[bool, int, float, str, Mapping[str, Any], Sequence[Any]]]


class TraceAnnotation(TypedDict):
    id: str
    created_at: str
    updated_at: str
    source: Literal["API", "APP"]
    user_id: Optional[str]
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    trace_id: str
    result: NotRequired[AnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]
    identifier: NotRequired[str]


class TraceAnnotationData(TypedDict):
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    trace_id: str
    result: NotRequired[AnnotationResult]
    metadata: NotRequired[Mapping[str, Any]]
    identifier: NotRequired[str]


class TraceAnnotationsResponseBody(TypedDict):
    data: Sequence[TraceAnnotation]
    next_cursor: Optional[str]


class TraceContext(TypedDict):
    type: Literal["trace"]
    projectNodeId: str
    otelTraceId: str


class TraceNoteData(TypedDict):
    trace_id: str
    note: str
    identifier: NotRequired[str]


class TraceSpanData(TypedDict):
    id: str
    span_id: str
    parent_id: Optional[str]
    name: str
    span_kind: str
    status_code: str
    start_time: str
    end_time: str


class TurnTraceContext(TypedDict):
    traceId: str
    rootSpanId: str
    startedAt: str


class UpdateDatasetLabelRequestBody(TypedDict):
    name: NotRequired[str]
    color: NotRequired[str]
    description: NotRequired[str]


class UpdateDatasetLabelResponseBody(TypedDict):
    data: DatasetLabel


class UpdateExperimentRequestBody(TypedDict):
    name: NotRequired[str]
    description: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]


class UpdateExperimentResponseBody(TypedDict):
    data: Experiment


class UpdateProjectRequestBody(TypedDict):
    description: NotRequired[str]


class UpdateProjectResponseBody(TypedDict):
    data: Project


class UploadDatasetData(TypedDict):
    dataset_id: str
    version_id: str
    num_created_examples: int
    num_updated_examples: int
    num_deleted_examples: int


class UploadDatasetResponseBody(TypedDict):
    data: UploadDatasetData


class UpsertExperimentEvaluationRequestBody(TypedDict):
    experiment_run_id: str
    name: str
    annotator_kind: Literal["LLM", "CODE", "HUMAN"]
    start_time: str
    end_time: str
    result: NotRequired[ExperimentEvaluationResult]
    error: NotRequired[str]
    metadata: NotRequired[Mapping[str, Any]]
    trace_id: NotRequired[str]


class UpsertExperimentEvaluationResponseBodyData(TypedDict):
    id: str


class UpsertOrDeleteSecretsRequest(TypedDict):
    secrets: Sequence[SecretKeyValue]


class UpsertOrDeleteSecretsResult(TypedDict):
    upserted_keys: Sequence[str]
    deleted_keys: Sequence[str]


class UserApiKey(TypedDict):
    id: str
    name: str
    created_at: str
    user: ApiKeyUser
    description: NotRequired[str]
    expires_at: NotRequired[str]


class UserMessageMetadata(TypedDict):
    type: Literal["user"]
    currentDateTime: str
    timeZone: str


class ValidationError(TypedDict):
    loc: Sequence[Union[str, int]]
    msg: str
    type: str
    input: NotRequired[Any]
    ctx: NotRequired[Mapping[str, Any]]


class WebAccessContext(TypedDict):
    type: Literal["web_access"]
    enabled: bool


class SessionSummaryChunk(TypedDict):
    type: Literal["data-session-summary"]
    data: str
    id: NotRequired[str]
    transient: NotRequired[bool]


class ToolCallCallbackProviderMetadata(TypedDict):
    toolExecutionEnvironment: Literal["client", "server"]
    toolInputEmittedAt: NotRequired[str]
    clientStartedAt: NotRequired[str]
    clientEndedAt: NotRequired[str]


class ToolCallProviderMetadata(TypedDict):
    toolExecutionEnvironment: Literal["client", "server"]
    toolInputEmittedAt: NotRequired[str]


class TranscriptPersistedData(TypedDict):
    messageId: str


class AddDatasetLabelToDatasetResponseBody(TypedDict):
    data: DatasetLabel


class AnnotateSessionsRequestBody(TypedDict):
    data: Sequence[SessionAnnotationData]


class AnnotateSessionsResponseBody(TypedDict):
    data: Sequence[InsertedSessionAnnotation]


class AnnotateSpanDocumentsRequestBody(TypedDict):
    data: Sequence[SpanDocumentAnnotationData]


class AnnotateSpanDocumentsResponseBody(TypedDict):
    data: Sequence[InsertedSpanDocumentAnnotation]


class AnnotateSpansRequestBody(TypedDict):
    data: Sequence[SpanAnnotationData]


class AnnotateSpansResponseBody(TypedDict):
    data: Sequence[InsertedSpanAnnotation]


class AnnotateTracesRequestBody(TypedDict):
    data: Sequence[TraceAnnotationData]


class AnnotateTracesResponseBody(TypedDict):
    data: Sequence[InsertedTraceAnnotation]


class AssistantMessageMetadataUsage(TypedDict):
    tokens: AssistantMessageMetadataUsageTokens
    promptDetails: NotRequired[AssistantMessageMetadataUsageTokenDetails]


class BuiltInProviderModelSelection(TypedDict):
    provider: Literal[
        "OPENAI",
        "AZURE_OPENAI",
        "ANTHROPIC",
        "GOOGLE",
        "DEEPSEEK",
        "XAI",
        "OLLAMA",
        "AWS",
        "CEREBRAS",
        "FIREWORKS",
        "GROQ",
        "MOONSHOT",
        "PERPLEXITY",
        "TOGETHER",
    ]
    modelName: str
    providerType: Literal["builtin"]
    openaiApiType: NotRequired[Literal["chat_completions", "responses"]]


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


class CreateApiKeyResponseBody(TypedDict):
    data: CreatedApiKey


class CreateDatasetLabelResponseBody(TypedDict):
    data: DatasetLabel


class CreateExperimentResponseBody(TypedDict):
    data: Experiment


class CreateExperimentRunResponseBody(TypedDict):
    data: CreateExperimentRunResponseBodyData


class CreateProjectResponseBody(TypedDict):
    data: Project


class CreateSessionNoteRequestBody(TypedDict):
    data: SessionNoteData


class CreateSessionNoteResponseBody(TypedDict):
    data: InsertedSessionAnnotation


class CreateSpanNoteRequestBody(TypedDict):
    data: SpanNoteData


class CreateSpanNoteResponseBody(TypedDict):
    data: InsertedSpanAnnotation


class CreateTraceNoteRequestBody(TypedDict):
    data: TraceNoteData


class CreateTraceNoteResponseBody(TypedDict):
    data: InsertedTraceAnnotation


class CreateUserRequestBody(TypedDict):
    user: Union[LocalUserData, OAuth2UserData, LDAPUserData]
    send_welcome_email: NotRequired[bool]


class CreateUserResponseBody(TypedDict):
    data: Union[LocalUser, OAuth2User, LDAPUser]


class DynamicToolApprovalRequestedPart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    input: Any
    title: NotRequired[str]
    state: NotRequired[str]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class DynamicToolApprovalRespondedPart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    input: Any
    title: NotRequired[str]
    state: NotRequired[str]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class DynamicToolInputAvailablePart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    input: Any
    title: NotRequired[str]
    state: NotRequired[str]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class DynamicToolInputStreamingPart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class DynamicToolOutputAvailablePart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    input: Any
    output: Any
    title: NotRequired[str]
    state: NotRequired[str]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    preliminary: NotRequired[bool]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class DynamicToolOutputDeniedPart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    input: Any
    title: NotRequired[str]
    state: NotRequired[str]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class DynamicToolOutputErrorPart(TypedDict):
    type: Literal["dynamic-tool"]
    toolName: str
    toolCallId: str
    input: Any
    errorText: str
    title: NotRequired[str]
    state: NotRequired[str]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class FreeformAnnotationConfig(TypedDict):
    type: Literal["FREEFORM"]
    name: str
    id: str
    description: NotRequired[str]
    optimization_direction: NotRequired[Literal["MINIMIZE", "MAXIMIZE", "NONE"]]
    threshold: NotRequired[float]
    lower_bound: NotRequired[float]
    upper_bound: NotRequired[float]


class FreeformAnnotationConfigData(TypedDict):
    type: Literal["FREEFORM"]
    name: str
    description: NotRequired[str]
    optimization_direction: NotRequired[Literal["MINIMIZE", "MAXIMIZE", "NONE"]]
    threshold: NotRequired[float]
    lower_bound: NotRequired[float]
    upper_bound: NotRequired[float]


class GetAllUserApiKeysResponseBody(TypedDict):
    data: Sequence[UserApiKey]
    next_cursor: Optional[str]


class GetAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class GetAnnotationConfigsResponseBody(TypedDict):
    data: Sequence[
        Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]
    ]
    next_cursor: Optional[str]


class GetIncompleteEvaluationsResponseBody(TypedDict):
    data: Sequence[IncompleteExperimentEvaluation]
    next_cursor: Optional[str]


class GetIncompleteExperimentRunsResponseBody(TypedDict):
    data: Sequence[IncompleteExperimentRun]
    next_cursor: Optional[str]


class GetProjectAnnotationConfigsResponseBody(TypedDict):
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


class GetUsersResponseBody(TypedDict):
    data: Sequence[Union[LocalUser, OAuth2User, LDAPUser]]
    next_cursor: Optional[str]


class GetViewerResponseBody(TypedDict):
    data: Union[LocalUser, OAuth2User, LDAPUser, AnonymousUser]


class HTTPValidationError(TypedDict):
    detail: NotRequired[Sequence[ValidationError]]


class PlaygroundContext(TypedDict):
    type: Literal["playground"]
    recordExperiments: NotRequired[bool]
    repetitions: NotRequired[int]
    nextExperimentScaffold: NotRequired[PlaygroundExperimentScaffoldContext]
    instances: NotRequired[Sequence[PlaygroundInstanceContext]]
    evaluators: NotRequired[Sequence[PlaygroundEvaluatorContext]]


class PromptAnthropicInvocationParametersContent(TypedDict):
    max_tokens: int
    temperature: NotRequired[float]
    top_p: NotRequired[float]
    stop_sequences: NotRequired[Sequence[str]]
    output_config: NotRequired[PromptAnthropicOutputConfig]
    thinking: NotRequired[
        Union[
            PromptAnthropicThinkingConfigDisabled,
            PromptAnthropicThinkingConfigEnabled,
            PromptAnthropicThinkingConfigAdaptive,
        ]
    ]
    extra_body: NotRequired[Mapping[str, Any]]


class PromptAwsInvocationParameters(TypedDict):
    type: Literal["aws"]
    aws: PromptAwsInvocationParametersContent


class PromptAzureOpenAIInvocationParameters(TypedDict):
    type: Literal["azure_openai"]
    azure_openai: PromptAzureOpenAIInvocationParametersContent


class PromptCerebrasInvocationParameters(TypedDict):
    type: Literal["cerebras"]
    cerebras: PromptCerebrasInvocationParametersContent


class PromptDeepSeekInvocationParameters(TypedDict):
    type: Literal["deepseek"]
    deepseek: PromptDeepSeekInvocationParametersContent


class PromptFireworksInvocationParameters(TypedDict):
    type: Literal["fireworks"]
    fireworks: PromptFireworksInvocationParametersContent


class PromptGoogleInvocationParametersContent(TypedDict):
    temperature: NotRequired[float]
    max_output_tokens: NotRequired[int]
    stop_sequences: NotRequired[Sequence[str]]
    presence_penalty: NotRequired[float]
    frequency_penalty: NotRequired[float]
    top_p: NotRequired[float]
    top_k: NotRequired[int]
    thinking_config: NotRequired[PromptGoogleThinkingConfig]


class PromptGroqInvocationParameters(TypedDict):
    type: Literal["groq"]
    groq: PromptGroqInvocationParametersContent


class PromptMoonshotInvocationParameters(TypedDict):
    type: Literal["moonshot"]
    moonshot: PromptMoonshotInvocationParametersContent


class PromptOllamaInvocationParameters(TypedDict):
    type: Literal["ollama"]
    ollama: PromptOllamaInvocationParametersContent


class PromptOpenAIInvocationParameters(TypedDict):
    type: Literal["openai"]
    openai: PromptOpenAIInvocationParametersContent


class PromptPerplexityInvocationParameters(TypedDict):
    type: Literal["perplexity"]
    perplexity: PromptPerplexityInvocationParametersContent


class PromptResponseFormatJSONSchema(TypedDict):
    type: Literal["json_schema"]
    json_schema: PromptResponseFormatJSONSchemaDefinition


class PromptTogetherInvocationParameters(TypedDict):
    type: Literal["together"]
    together: PromptTogetherInvocationParametersContent


class PromptToolFunction(TypedDict):
    type: Literal["function"]
    function: PromptToolFunctionDefinition


class PromptTools(TypedDict):
    type: Literal["tools"]
    tools: Sequence[Union[PromptToolFunction, PromptToolRaw]]
    tool_choice: NotRequired[
        Union[
            PromptToolChoiceNone,
            PromptToolChoiceZeroOrMore,
            PromptToolChoiceOneOrMore,
            PromptToolChoiceSpecificFunctionTool,
        ]
    ]
    disable_parallel_tool_calls: NotRequired[bool]


class PromptXAIInvocationParameters(TypedDict):
    type: Literal["xai"]
    xai: PromptXAIInvocationParametersContent


class ResponseBodyUpsertOrDeleteSecretsResult(TypedDict):
    data: UpsertOrDeleteSecretsResult


class SessionData(TypedDict):
    id: str
    session_id: str
    project_id: str
    start_time: str
    end_time: str
    traces: Sequence[SessionTraceData]
    token_count_prompt: NotRequired[int]
    token_count_completion: NotRequired[int]
    token_count_total: NotRequired[int]


class SetProjectAnnotationConfigsResponseBody(TypedDict):
    data: Sequence[
        Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]
    ]
    next_cursor: Optional[str]


class Span(TypedDict):
    name: str
    context: SpanContext
    span_kind: str
    start_time: str
    end_time: str
    status_code: str
    id: NotRequired[str]
    parent_id: NotRequired[str]
    status_message: NotRequired[str]
    attributes: NotRequired[Mapping[str, Any]]
    events: NotRequired[Sequence[SpanEvent]]


class SpansResponseBody(TypedDict):
    data: Sequence[Span]
    next_cursor: Optional[str]


class ToolApprovalRequestedPart(TypedDict):
    type: str
    toolCallId: str
    title: NotRequired[str]
    state: NotRequired[str]
    input: NotRequired[Any]
    providerExecuted: NotRequired[bool]
    callProviderMetadata: NotRequired[Mapping[str, Mapping[str, Any]]]
    approval: NotRequired[Union[ToolApprovalRequested, ToolApprovalResponded]]


class ToolCallContentPart(TypedDict):
    type: Literal["tool_call"]
    tool_call_id: str
    tool_call: ToolCallFunction


class TraceData(TypedDict):
    id: str
    trace_id: str
    project_id: str
    start_time: str
    end_time: str
    token_count_prompt: NotRequired[int]
    token_count_completion: NotRequired[int]
    token_count_total: NotRequired[int]
    spans: NotRequired[Sequence[TraceSpanData]]


class UpdateAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class UpsertExperimentEvaluationResponseBody(TypedDict):
    data: UpsertExperimentEvaluationResponseBodyData


class TranscriptPersistedChunk(TypedDict):
    type: Literal["data-transcript-persisted"]
    data: TranscriptPersistedData
    id: NotRequired[str]
    transient: NotRequired[bool]


class AssignAnnotationConfigToProjectResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class AssistantMessageMetadata(TypedDict):
    type: Literal["assistant"]
    sessionId: str
    trace: NotRequired[AssistantMessageMetadataTraceIds]
    turnTraceContext: NotRequired[TurnTraceContext]
    usage: NotRequired[AssistantMessageMetadataUsage]


class CreateAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class CreateSpansRequestBody(TypedDict):
    data: Sequence[Span]


class DeleteAnnotationConfigResponseBody(TypedDict):
    data: Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig]


class GetSessionResponseBody(TypedDict):
    data: SessionData


class GetSessionsResponseBody(TypedDict):
    data: Sequence[SessionData]
    next_cursor: Optional[str]


class GetTracesResponseBody(TypedDict):
    data: Sequence[TraceData]
    next_cursor: Optional[str]


class LegacyAssistantMetadataUIMessage(TypedDict):
    id: str
    role: Literal["system", "user", "assistant"]
    parts: Sequence[
        Union[
            TextUIPart,
            ReasoningUIPart,
            ToolInputStreamingPart,
            ToolInputAvailablePart,
            ToolOutputAvailablePart,
            ToolOutputErrorPart,
            ToolApprovalRequestedPart,
            ToolApprovalRespondedPart,
            ToolOutputDeniedPart,
            DynamicToolInputStreamingPart,
            DynamicToolInputAvailablePart,
            DynamicToolOutputAvailablePart,
            DynamicToolOutputErrorPart,
            DynamicToolApprovalRequestedPart,
            DynamicToolApprovalRespondedPart,
            DynamicToolOutputDeniedPart,
            SourceUrlUIPart,
            SourceDocumentUIPart,
            FileUIPart,
            DataUIPart,
            StepStartUIPart,
        ]
    ]
    metadata: NotRequired[AssistantMessageMetadata]


class LegacyChatRegenerateMessage(TypedDict):
    id: str
    messages: Sequence[LegacyAssistantMetadataUIMessage]
    model: Union[CustomProviderModelSelection, BuiltInProviderModelSelection]
    trigger: Literal["regenerate-message"]
    messageId: NotRequired[str]
    ingestTraces: NotRequired[bool]
    exportRemoteTraces: NotRequired[bool]
    attachUserId: NotRequired[bool]
    contexts: NotRequired[
        Sequence[
            Union[
                AppContext,
                ProjectContext,
                TraceContext,
                SessionContext,
                PromptContext,
                PromptVersionContext,
                AgentSpanContext,
                PlaygroundContext,
                CodeEvaluatorContext,
                LlmEvaluatorContext,
                DatasetContext,
                GraphQLContext,
                WebAccessContext,
                SubagentsContext,
            ]
        ]
    ]
    editPermission: NotRequired[Literal["manual", "bypass"]]
    requestedSkills: NotRequired[Sequence[str]]


class LegacyChatSubmitMessage(TypedDict):
    id: str
    messages: Sequence[LegacyAssistantMetadataUIMessage]
    model: Union[CustomProviderModelSelection, BuiltInProviderModelSelection]
    trigger: Literal["submit-message"]
    ingestTraces: NotRequired[bool]
    exportRemoteTraces: NotRequired[bool]
    attachUserId: NotRequired[bool]
    contexts: NotRequired[
        Sequence[
            Union[
                AppContext,
                ProjectContext,
                TraceContext,
                SessionContext,
                PromptContext,
                PromptVersionContext,
                AgentSpanContext,
                PlaygroundContext,
                CodeEvaluatorContext,
                LlmEvaluatorContext,
                DatasetContext,
                GraphQLContext,
                WebAccessContext,
                SubagentsContext,
            ]
        ]
    ]
    editPermission: NotRequired[Literal["manual", "bypass"]]
    requestedSkills: NotRequired[Sequence[str]]


class PhoenixUIMessage(TypedDict):
    id: str
    role: Literal["system", "user", "assistant"]
    parts: Sequence[
        Union[
            TextUIPart,
            ReasoningUIPart,
            ToolInputStreamingPart,
            ToolInputAvailablePart,
            ToolOutputAvailablePart,
            ToolOutputErrorPart,
            ToolApprovalRequestedPart,
            ToolApprovalRespondedPart,
            ToolOutputDeniedPart,
            DynamicToolInputStreamingPart,
            DynamicToolInputAvailablePart,
            DynamicToolOutputAvailablePart,
            DynamicToolOutputErrorPart,
            DynamicToolApprovalRequestedPart,
            DynamicToolApprovalRespondedPart,
            DynamicToolOutputDeniedPart,
            SourceUrlUIPart,
            SourceDocumentUIPart,
            FileUIPart,
            DataUIPart,
            StepStartUIPart,
        ]
    ]
    metadata: NotRequired[Union[AssistantMessageMetadata, UserMessageMetadata]]


class PromptAnthropicInvocationParameters(TypedDict):
    type: Literal["anthropic"]
    anthropic: PromptAnthropicInvocationParametersContent


class PromptGoogleInvocationParameters(TypedDict):
    type: Literal["google"]
    google: PromptGoogleInvocationParametersContent


class PromptMessage(TypedDict):
    role: Literal["user", "assistant", "model", "ai", "tool", "system", "developer"]
    content: Union[
        str, Sequence[Union[TextContentPart, ToolCallContentPart, ToolResultContentPart]]
    ]


class ChatRequest(TypedDict):
    model: Union[CustomProviderModelSelection, BuiltInProviderModelSelection]
    id: str
    message: PhoenixUIMessage
    ingestTraces: NotRequired[bool]
    exportRemoteTraces: NotRequired[bool]
    attachUserId: NotRequired[bool]
    contexts: NotRequired[
        Sequence[
            Union[
                AppContext,
                ProjectContext,
                TraceContext,
                SessionContext,
                PromptContext,
                PromptVersionContext,
                AgentSpanContext,
                PlaygroundContext,
                CodeEvaluatorContext,
                LlmEvaluatorContext,
                DatasetContext,
                GraphQLContext,
                WebAccessContext,
                SubagentsContext,
            ]
        ]
    ]
    editPermission: NotRequired[Literal["manual", "bypass"]]
    requestedSkills: NotRequired[Sequence[str]]
    turnTraceContext: NotRequired[TurnTraceContext]
    trigger: NotRequired[str]


class PromptChatTemplate(TypedDict):
    type: Literal["chat"]
    messages: Sequence[PromptMessage]


class PromptVersionData(TypedDict):
    model_provider: Literal[
        "OPENAI",
        "AZURE_OPENAI",
        "ANTHROPIC",
        "GOOGLE",
        "DEEPSEEK",
        "XAI",
        "OLLAMA",
        "AWS",
        "CEREBRAS",
        "FIREWORKS",
        "GROQ",
        "MOONSHOT",
        "PERPLEXITY",
        "TOGETHER",
    ]
    model_name: str
    template: Union[PromptChatTemplate, PromptStringTemplate]
    template_type: Literal["STR", "CHAT"]
    template_format: Literal["MUSTACHE", "F_STRING", "NONE"]
    invocation_parameters: Union[
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


class OtlpAnyValue(TypedDict):
    array_value: NotRequired[OtlpArrayValue]
    bool_value: NotRequired[bool]
    bytes_value: NotRequired[str]
    double_value: NotRequired[Union[float, str, Literal["Infinity", "-Infinity", "NaN"]]]
    int_value: NotRequired[Union[int, str]]
    kvlist_value: NotRequired[None]
    string_value: NotRequired[str]


class OtlpArrayValue(TypedDict):
    values: NotRequired[Sequence[OtlpAnyValue]]


class OtlpEvent(TypedDict):
    attributes: NotRequired[Sequence[OtlpKeyValue]]
    dropped_attributes_count: NotRequired[int]
    name: NotRequired[str]
    time_unix_nano: NotRequired[Union[int, str]]


class OtlpKeyValue(TypedDict):
    key: NotRequired[str]
    value: NotRequired[OtlpAnyValue]


class OtlpSpan(TypedDict):
    attributes: NotRequired[Sequence[OtlpKeyValue]]
    dropped_attributes_count: NotRequired[int]
    dropped_events_count: NotRequired[int]
    dropped_links_count: NotRequired[int]
    end_time_unix_nano: NotRequired[Union[int, str]]
    events: NotRequired[Sequence[OtlpEvent]]
    flags: NotRequired[int]
    kind: NotRequired[
        Union[
            int,
            Literal[
                "SPAN_KIND_UNSPECIFIED",
                "SPAN_KIND_INTERNAL",
                "SPAN_KIND_SERVER",
                "SPAN_KIND_CLIENT",
                "SPAN_KIND_PRODUCER",
                "SPAN_KIND_CONSUMER",
            ],
        ]
    ]
    links: NotRequired[None]
    name: NotRequired[str]
    parent_span_id: NotRequired[str]
    span_id: NotRequired[str]
    start_time_unix_nano: NotRequired[Union[int, str]]
    status: NotRequired[OtlpStatus]
    trace_id: NotRequired[str]
    trace_state: NotRequired[str]


class OtlpSpansResponseBody(TypedDict):
    data: Sequence[OtlpSpan]
    next_cursor: Optional[str]
