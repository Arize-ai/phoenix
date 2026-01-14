"""Do not edit"""

from __future__ import annotations
from typing import Literal, Union, Any
from pydantic import BaseModel, ConfigDict, Field, RootModel
from typing_extensions import TypeAliasType
Boolean = TypeAliasType('Boolean', bool)
CronExpression = TypeAliasType('CronExpression', str)
DateTime = TypeAliasType('DateTime', str)
Float = TypeAliasType('Float', float)
ID = TypeAliasType('ID', str)
Identifier = TypeAliasType('Identifier', str)
Int = TypeAliasType('Int', int)
JSON = TypeAliasType('JSON', str)
SecretString = TypeAliasType('SecretString', str)
String = TypeAliasType('String', str)

class InferencesRole(RootModel[Literal['primary', 'reference']]):
    model_config = ConfigDict(frozen=True)
    root: Literal['primary', 'reference']

class ScalarDriftMetric(RootModel[Literal['jsDistance', 'klDivergence', 'psi']]):
    model_config = ConfigDict(frozen=True)
    root: Literal['jsDistance', 'klDivergence', 'psi']

class VectorDriftMetric(RootModel[Literal['euclideanDistance']]):
    model_config = ConfigDict(frozen=True)
    root: Literal['euclideanDistance']

class AnnotationConfigBase(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal['CATEGORICAL', 'CONTINUOUS', 'FREEFORM']
    description: String | None = None
    name: String

class ApiKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime = Field(...)
    description: String | None = Field(default=None)
    expiresAt: DateTime | None = Field(default=None)
    name: String = Field(...)

class ChatCompletionSubscriptionPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    repetitionNumber: Int | None = None

class ExampleRevision(BaseModel):
    model_config = ConfigDict(frozen=True)
    input: JSON
    metadata: JSON
    output: JSON

class InvocationParameterBase(BaseModel):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    invocationName: String
    label: String
    required: Boolean

class ModelInterface(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: String
    providerKey: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI'] | None = None

class Node(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: ID = Field(...)

class AWSBedrockAuthenticationMethod(BaseModel):
    model_config = ConfigDict(frozen=True)
    awsAccessKeyId: String
    awsSecretAccessKey: String
    awsSessionToken: String | None = None

class AWSBedrockClientKwargs(BaseModel):
    model_config = ConfigDict(frozen=True)
    endpointUrl: String | None = None
    regionName: String

class AWSBedrockCustomProviderConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    awsBedrockAuthenticationMethod: AWSBedrockAuthenticationMethod
    awsBedrockClientInterface: Literal['CONVERSE']
    awsBedrockClientKwargs: AWSBedrockClientKwargs
    supportsStreaming: Boolean

class AnthropicAuthenticationMethod(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String | None = None

class AnthropicClientKwargs(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    defaultHeaders: JSON | None = None

class AnthropicCustomProviderConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    anthropicAuthenticationMethod: AnthropicAuthenticationMethod
    anthropicClientInterface: Literal['CHAT']
    anthropicClientKwargs: AnthropicClientKwargs | None = None
    supportsStreaming: Boolean

class AzureADTokenProvider(BaseModel):
    model_config = ConfigDict(frozen=True)
    azureClientId: String
    azureClientSecret: String
    azureTenantId: String
    scope: String

class AzureOpenAIAuthenticationMethod(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String | None = None
    azureAdTokenProvider: AzureADTokenProvider | None = None

class AzureOpenAIClientKwargs(BaseModel):
    model_config = ConfigDict(frozen=True)
    azureEndpoint: String
    defaultHeaders: JSON | None = None

class AzureOpenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    azureOpenaiAuthenticationMethod: AzureOpenAIAuthenticationMethod
    azureOpenaiClientInterface: Literal['CHAT']
    azureOpenaiClientKwargs: AzureOpenAIClientKwargs
    supportsStreaming: Boolean

class BooleanInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: Boolean | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    required: Boolean

class BoundedFloatInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: Float | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    maxValue: Float
    minValue: Float
    required: Boolean

class CategoricalAnnotationValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: String
    score: Float | None = None

class ChatCompletionFunctionCall(BaseModel):
    model_config = ConfigDict(frozen=True)
    arguments: String
    name: String

class ChatCompletionSubscriptionError(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    message: String
    repetitionNumber: Int | None = None

class ChatCompletionToolCall(BaseModel):
    model_config = ConfigDict(frozen=True)
    function: ChatCompletionFunctionCall
    id: String

class ContinuousAnnotationConfig(AnnotationConfigBase, Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal['CATEGORICAL', 'CONTINUOUS', 'FREEFORM']
    description: String | None = None
    id: ID = Field(...)
    lowerBound: Float | None = None
    name: String
    optimizationDirection: Literal['MAXIMIZE', 'MINIMIZE', 'NONE']
    upperBound: Float | None = None

class CostBreakdown(BaseModel):
    model_config = ConfigDict(frozen=True)
    cost: Float | None = None
    tokens: Float | None = Field(default=None)

class DatasetExampleRevision(ExampleRevision):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    input: JSON
    metadata: JSON
    output: JSON
    revisionKind: Literal['CREATE', 'DELETE', 'PATCH']

class DatasetExperimentAnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: String
    maxScore: Float | None = None
    minScore: Float | None = None

class DatasetLabel(Node):
    model_config = ConfigDict(frozen=True)
    color: String
    description: String | None = None
    id: ID = Field(...)
    name: String

class DatasetLabelEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: DatasetLabel = Field(...)

class DatasetSplit(Node):
    model_config = ConfigDict(frozen=True)
    color: String
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    metadata: JSON
    name: String
    updatedAt: DateTime

class DatasetSplitEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: DatasetSplit = Field(...)

class DatasetSplitMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplit: DatasetSplit

class DatasetValues(BaseModel):
    model_config = ConfigDict(frozen=True)
    primaryValue: Float | None = None
    referenceValue: Float | None = None

class DatasetVersion(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    metadata: JSON

class DatasetVersionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: DatasetVersion = Field(...)

class DbTableStats(BaseModel):
    model_config = ConfigDict(frozen=True)
    numBytes: Float
    tableName: String

class DecryptedSecret(BaseModel):
    model_config = ConfigDict(frozen=True)
    value: String

class DeleteApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKeyId: ID

class DeleteDatasetLabelsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabels: list[DatasetLabel]

class DeleteDatasetSplitsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplits: list[DatasetSplit]

class DeleteEvaluatorsPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluatorIds: list[ID]

class DeleteGenerativeModelCustomProviderMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: ID

class DeletePromptMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)

class DeleteUsersPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    userIds: list[ID]

class DocumentEvaluationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    averageNdcg: Float | None = None
    averagePrecision: Float | None = None
    countHit: Int
    countNdcg: Int
    countPrecision: Int
    countReciprocalRank: Int
    evaluationName: String
    hitRate: Float | None = None
    meanReciprocalRank: Float | None = None

class DocumentRetrievalMetrics(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluationName: String
    hit: Float | None = Field(default=None)
    ndcg: Float | None = Field(default=None)
    precision: Float | None = Field(default=None)
    reciprocalRank: Float | None = Field(default=None)

class EmbeddingMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)
    linkToData: String | None = None
    predictionId: String | None = None
    rawData: String | None = None

class EvaluationError(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluatorName: String
    message: String

class EvaluationErrorChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    evaluatorName: String
    message: String
    repetitionNumber: Int | None = None

class EvaluatorInputMapping(BaseModel):
    model_config = ConfigDict(frozen=True)
    literalMapping: JSON
    pathMapping: JSON

class EventMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)
    actualLabel: String | None = None
    actualScore: Float | None = None
    predictionId: String | None = None
    predictionLabel: String | None = None
    predictionScore: Float | None = None

class ExperimentAnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: String
    count: Int
    errorCount: Int
    maxScore: Float | None = None
    meanScore: Float | None = None
    minScore: Float | None = None

class ExperimentRepeatedRunGroupAnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: String
    meanScore: Float | None = None

class ExperimentRunMetricComparison(BaseModel):
    model_config = ConfigDict(frozen=True)
    numRunsEqual: Int = Field(...)
    numRunsImproved: Int = Field(...)
    numRunsRegressed: Int = Field(...)
    numRunsWithoutComparison: Int = Field(...)

class ExperimentRunMetricComparisons(BaseModel):
    model_config = ConfigDict(frozen=True)
    completionCost: ExperimentRunMetricComparison
    completionTokenCount: ExperimentRunMetricComparison
    latency: ExperimentRunMetricComparison
    promptCost: ExperimentRunMetricComparison
    promptTokenCount: ExperimentRunMetricComparison
    totalCost: ExperimentRunMetricComparison
    totalTokenCount: ExperimentRunMetricComparison

class ExportedFile(BaseModel):
    model_config = ConfigDict(frozen=True)
    fileName: String = Field(...)

class FloatInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: Float | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    required: Boolean

class FreeformAnnotationConfig(AnnotationConfigBase, Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal['CATEGORICAL', 'CONTINUOUS', 'FREEFORM']
    description: String | None = None
    id: ID = Field(...)
    name: String

class FunctionCallChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    arguments: String
    datasetExampleId: ID | None = None
    name: String
    repetitionNumber: Int | None = None

class Functionality(BaseModel):
    model_config = ConfigDict(frozen=True)
    modelInferences: Boolean = Field(...)

class GenerativeProviderCredentialConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    envVarName: String
    isRequired: Boolean

class GoogleGenAIAuthenticationMethod(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String | None = None

class GoogleGenAIHttpOptions(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    headers: JSON | None = None

class IntInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: Int | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    required: Boolean

class JSONInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: JSON | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    required: Boolean

class LabelFraction(BaseModel):
    model_config = ConfigDict(frozen=True)
    fraction: Float
    label: String

class MissingValueBin(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: String | None = None

class NominalBin(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: String

class NumericRange(BaseModel):
    model_config = ConfigDict(frozen=True)
    end: Float
    start: Float

class OpenAIAuthenticationMethod(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String | None = None

class OpenAIClientKwargs(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    defaultHeaders: JSON | None = None
    organization: String | None = None
    project: String | None = None

class OpenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    openaiAuthenticationMethod: OpenAIAuthenticationMethod
    openaiClientInterface: Literal['CHAT']
    openaiClientKwargs: OpenAIClientKwargs | None = None
    supportsStreaming: Boolean

class PageInfo(BaseModel):
    model_config = ConfigDict(frozen=True)
    endCursor: String | None = Field(default=None)
    hasNextPage: Boolean = Field(...)
    hasPreviousPage: Boolean = Field(...)
    startCursor: String | None = Field(default=None)

class PlaygroundModel(ModelInterface):
    model_config = ConfigDict(frozen=True)
    name: String
    providerKey: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI']

class Point2D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: Float
    y: Float

class Point3D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: Float
    y: Float
    z: Float

class PromptLabel(Node):
    model_config = ConfigDict(frozen=True)
    color: String | None = None
    description: String | None = None
    id: ID = Field(...)
    name: Identifier

class PromptLabelAssociationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)

class PromptLabelDeleteMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    deletedPromptLabelIds: list[ID]

class PromptLabelEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: PromptLabel = Field(...)

class PromptLabelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptLabels: list[PromptLabel]

class PromptResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    prompt: String | None = Field(default=None)
    response: String | None = Field(default=None)

class PromptStringTemplate(BaseModel):
    model_config = ConfigDict(frozen=True)
    template: String

class ResponseFormat(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: JSON

class Retrieval(BaseModel):
    model_config = ConfigDict(frozen=True)
    documentId: ID
    queryId: ID
    relevance: Float | None = None

class ServerStatus(BaseModel):
    model_config = ConfigDict(frozen=True)
    insufficientStorage: Boolean

class SpanAnnotationScoreWithLabel(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: String
    score: Float

class SpanAsExampleRevision(ExampleRevision):
    model_config = ConfigDict(frozen=True)
    input: JSON
    metadata: JSON
    output: JSON

class SpanContext(BaseModel):
    model_config = ConfigDict(frozen=True)
    spanId: ID
    traceId: ID

class SpanCostDetailSummaryEntry(BaseModel):
    model_config = ConfigDict(frozen=True)
    isPrompt: Boolean
    tokenType: String
    value: CostBreakdown

class SpanCostSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    completion: CostBreakdown
    prompt: CostBreakdown
    total: CostBreakdown

class SpanCountTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    errorCount: Int | None = None
    okCount: Int | None = None
    timestamp: DateTime
    totalCount: Int | None = None
    unsetCount: Int | None = None

class SpanEvent(BaseModel):
    model_config = ConfigDict(frozen=True)
    message: String
    name: String
    timestamp: DateTime

class SpanIOValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    mimeType: Literal['json', 'text']
    truncatedValue: String = Field(...)
    value: String

class StringInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: String | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    required: Boolean

class StringListInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    defaultValue: list[String] | None = None
    invocationInputField: Literal['value_bool', 'value_boolean', 'value_float', 'value_int', 'value_json', 'value_string', 'value_string_list']
    invocationName: String
    label: String
    required: Boolean

class Subscription(BaseModel):
    model_config = ConfigDict(frozen=True)
    chatCompletion: ChatCompletionSubscriptionPayload
    chatCompletionOverDataset: ChatCompletionSubscriptionPayload

class SystemApiKey(ApiKey, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime = Field(...)
    description: String | None = Field(default=None)
    expiresAt: DateTime | None = Field(default=None)
    id: ID = Field(...)
    name: String = Field(...)

class TestGenerativeModelCustomProviderCredentialsResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    error: String | None = None

class TextChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    content: String
    datasetExampleId: ID | None = None
    repetitionNumber: Int | None = None

class TextContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: String

class TimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    timestamp: DateTime
    value: Float | None = None

class TokenCountPromptDetails(BaseModel):
    model_config = ConfigDict(frozen=True)
    audio: Int | None = None
    cacheRead: Int | None = None
    cacheWrite: Int | None = None

class TokenPrice(BaseModel):
    model_config = ConfigDict(frozen=True)
    costPerMillionTokens: Float
    costPerToken: Float
    kind: Literal['COMPLETION', 'PROMPT']
    tokenType: String

class TokenUsage(BaseModel):
    model_config = ConfigDict(frozen=True)
    completion: Float
    prompt: Float
    total: Float

class ToolCallChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    function: FunctionCallChunk
    id: String
    repetitionNumber: Int | None = None

class ToolCallFunction(BaseModel):
    model_config = ConfigDict(frozen=True)
    arguments: String
    name: String

class ToolDefinition(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: JSON

class ToolResultContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    result: JSON
    toolCallId: String

class TraceCountByStatusTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    errorCount: Int
    okCount: Int
    timestamp: DateTime
    totalCount: Int

class TraceLatencyMsPercentileTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    max: Float | None = None
    p50: Float | None = None
    p75: Float | None = None
    p90: Float | None = None
    p95: Float | None = None
    p99: Float | None = None
    p999: Float | None = None
    timestamp: DateTime

class TraceLatencyPercentileTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceLatencyMsPercentileTimeSeriesDataPoint]

class TraceRetentionRuleMaxCount(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: Int

class TraceRetentionRuleMaxDays(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxDays: Float

class TraceRetentionRuleMaxDaysOrCount(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: Int
    maxDays: Float

class TraceTokenCostTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    completionCost: Float | None = None
    promptCost: Float | None = None
    timestamp: DateTime
    totalCost: Float | None = None

class TraceTokenCountTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    completionTokenCount: Float | None = None
    promptTokenCount: Float | None = None
    timestamp: DateTime
    totalTokenCount: Float | None = None

class UnparsableConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    parseError: String

class UnparsableSecret(BaseModel):
    model_config = ConfigDict(frozen=True)
    parseError: String

class UserRole(Node):
    model_config = ConfigDict(frozen=True)
    id: ID = Field(...)
    name: String

class ValidationResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    errorMessage: String | None = None
    isValid: Boolean

class AWSBedrockAuthenticationMethodInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    awsAccessKeyId: String
    awsSecretAccessKey: String
    awsSessionToken: String | None = None

class AWSBedrockClientKwargsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    endpointUrl: String | None = None
    regionName: String

class AWSBedrockCustomProviderConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    awsBedrockAuthenticationMethod: AWSBedrockAuthenticationMethodInput
    awsBedrockClientKwargs: AWSBedrockClientKwargsInput

class AddAnnotationConfigToProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfigId: ID
    projectId: ID

class AddSpansToDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    datasetVersionDescription: String | None = None
    datasetVersionMetadata: JSON | None = None
    spanIds: list[ID]

class AnnotationFilterCondition(BaseModel):
    model_config = ConfigDict(frozen=True)
    names: list[String] | None = None
    sources: list[AnnotationSource] | None = None
    userIds: list[ID | None] | None = None

class AnthropicAuthenticationMethodInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String

class AnthropicClientKwargsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    defaultHeaders: JSON | None = None

class AnthropicCustomProviderConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    anthropicAuthenticationMethod: AnthropicAuthenticationMethodInput
    anthropicClientKwargs: AnthropicClientKwargsInput | None = None

class AzureOpenAIADTokenProviderInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    azureClientId: String
    azureClientSecret: String
    azureTenantId: String
    scope: String | None = None

class AzureOpenAIAuthenticationMethodInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String | None = None
    azureAdTokenProvider: AzureOpenAIADTokenProviderInput | None = None

class AzureOpenAIClientKwargsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    azureEndpoint: String
    defaultHeaders: JSON | None = None

class AzureOpenAICustomProviderConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    azureOpenaiAuthenticationMethod: AzureOpenAIAuthenticationMethodInput
    azureOpenaiClientKwargs: AzureOpenAIClientKwargsInput

class CategoricalAnnotationConfigValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: String
    score: Float | None = None

class ChatCompletionMessageInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: JSON = Field(...)
    role: Literal['AI', 'SYSTEM', 'TOOL', 'USER']
    toolCallId: String | None = Field(default=None)
    toolCalls: list[JSON] | None = Field(default=None)

class ClearProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    endTime: DateTime | None = Field(default=None)
    id: ID

class ClonePromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    metadata: JSON | None = None
    name: Identifier
    promptId: ID

class ClusterInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    eventIds: list[ID]
    id: ID | None = None

class ContinuousAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    lowerBound: Float | None = None
    name: String
    optimizationDirection: Literal['MAXIMIZE', 'MINIMIZE', 'NONE']
    upperBound: Float | None = None

class CreateApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    expiresAt: DateTime | None = None
    name: String

class CreateCodeEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID | None = None
    description: String | None = None
    name: Identifier

class CreateDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    metadata: JSON | None = None
    name: String

class CreateDatasetLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: String
    datasetIds: list[ID] | None = None
    description: String | None = None
    name: String

class CreateDatasetSplitInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: String
    description: String | None = None
    metadata: JSON | None = None
    name: String

class CreateDatasetSplitWithExamplesInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: String
    description: String | None = None
    exampleIds: list[ID]
    metadata: JSON | None = None
    name: String

class CreateProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    gradientEndColor: String | None = None
    gradientStartColor: String | None = None
    name: String

class CreateProjectSessionAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM']
    explanation: String | None = None
    identifier: String | None = None
    label: String | None = None
    metadata: JSON
    name: String
    projectSessionId: ID
    score: Float | None = None
    source: Literal['API', 'APP']

class CreatePromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: String
    description: String | None = None
    name: String

class CreateSpanAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM']
    explanation: String | None = None
    identifier: String | None = None
    label: String | None = None
    metadata: JSON
    name: String
    score: Float | None = None
    source: Literal['API', 'APP']
    spanId: ID

class CreateSpanNoteInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    note: String
    spanId: ID

class CreateTraceAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM']
    explanation: String | None = None
    identifier: String | None = None
    label: String | None = None
    metadata: JSON
    name: String
    score: Float | None = None
    source: Literal['API', 'APP']
    traceId: ID

class CreateUserApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    expiresAt: DateTime | None = None
    name: String

class CreateUserInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    authMethod: Literal['LDAP', 'LOCAL', 'OAUTH2'] | None = 'LOCAL'
    email: String
    password: String | None = None
    role: Literal['ADMIN', 'MEMBER', 'VIEWER']
    sendWelcomeEmail: Boolean | None = False
    username: String

class DataQualityMetricInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    columnName: String | None = None
    metric: Literal['cardinality', 'count', 'max', 'mean', 'min', 'p01', 'p25', 'p50', 'p75', 'p99', 'percentEmpty', 'sum']

class DatasetEvaluatorFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['display_name']
    value: String

class DatasetEvaluatorSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['createdAt', 'displayName', 'kind', 'updatedAt']
    dir: Literal['asc', 'desc']

class DatasetExampleInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    input: JSON
    metadata: JSON
    output: JSON
    spanId: ID | None = None

class DatasetExamplePatch(BaseModel):
    model_config = ConfigDict(frozen=True)
    exampleId: ID
    input: JSON | None = None
    metadata: JSON | None = None
    output: JSON | None = None

class DatasetFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['name'] | None = None
    filterLabels: list[String] | None = None
    value: String | None = None

class DatasetSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['createdAt', 'name']
    dir: Literal['asc', 'desc']

class DatasetVersionSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['createdAt']
    dir: Literal['asc', 'desc']

class DeleteAnnotationConfigsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    ids: list[ID]

class DeleteAnnotationsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationIds: list[ID]

class DeleteApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: ID

class DeleteDatasetExamplesInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetVersionDescription: String | None = None
    datasetVersionMetadata: JSON | None = None
    exampleIds: list[ID]

class DeleteDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID

class DeleteDatasetLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabelIds: list[ID]

class DeleteDatasetSplitInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplitIds: list[ID]

class DeleteEvaluatorsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluatorIds: list[ID]

class DeleteExperimentsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    experimentIds: list[ID]

class DeleteGenerativeModelCustomProviderMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: ID

class DeleteModelMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: ID

class DeleteProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: ID

class DeletePromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: ID

class DeletePromptLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptLabelIds: list[ID]

class DeletePromptVersionTagInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptVersionTagId: ID

class DeleteUsersInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    userIds: list[ID]

class DimensionFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataTypes: list[DimensionDataType] | None = None
    shapes: list[DimensionShape] | None = None
    types: list[DimensionType] | None = None

class DimensionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: String
    type: Literal['actual', 'feature', 'prediction', 'tag']

class EvalResultKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    attr: Literal['label', 'score']
    name: String

class EvaluatorFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['name']
    value: String

class EvaluatorInputMappingInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    literalMapping: JSON
    pathMapping: JSON

class EvaluatorSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['createdAt', 'kind', 'name', 'updatedAt']
    dir: Literal['asc', 'desc']

class ExperimentRunColumn(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: String | None = None
    metric: Literal['latencyMs'] | None = None

class ExperimentRunSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: ExperimentRunColumn
    dir: Literal['asc', 'desc']

class FreeformAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    name: String

class GenerativeCredentialInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    envVarName: String
    value: SecretString

class GenerativeModelBuiltinProviderInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    credentials: list[GenerativeCredentialInput] | None = None
    customHeaders: JSON | None = None
    endpoint: String | None = None
    name: String
    providerKey: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI']
    region: String | None = None

class GenerativeModelCustomProviderInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    extraHeaders: JSON | None = None
    modelName: String
    providerId: ID

class GenerativeModelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    builtin: GenerativeModelBuiltinProviderInput | None = None
    custom: GenerativeModelCustomProviderInput | None = None

class GoogleGenAIAuthenticationMethodInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String

class GoogleGenAIHttpOptionsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    headers: JSON | None = None

class Granularity(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluationWindowMinutes: Int = Field(...)
    samplingIntervalMinutes: Int = Field(...)

class InputCoordinate2D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: Float
    y: Float

class InputCoordinate3D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: Float
    y: Float
    z: Float

class InvocationParameterInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    canonicalName: Literal['ANTHROPIC_EXTENDED_THINKING', 'MAX_COMPLETION_TOKENS', 'RANDOM_SEED', 'REASONING_EFFORT', 'RESPONSE_FORMAT', 'STOP_SEQUENCES', 'TEMPERATURE', 'TOOL_CHOICE', 'TOP_P'] | None = None
    invocationName: String
    valueBool: Boolean | None = None
    valueBoolean: Boolean | None = None
    valueFloat: Float | None = None
    valueInt: Int | None = None
    valueJson: JSON | None = None
    valueString: String | None = None
    valueStringList: list[String] | None = None

class ModelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    modelName: String | None = None
    providerKey: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI'] | None = None

class OpenAIAuthenticationMethodInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: String

class OpenAIClientKwargsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    baseUrl: String | None = None
    defaultHeaders: JSON | None = None
    organization: String | None = None
    project: String | None = None

class OpenAICustomProviderConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    openaiAuthenticationMethod: OpenAIAuthenticationMethodInput
    openaiClientKwargs: OpenAIClientKwargsInput | None = None

class PatchAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationId: ID
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] | None = None
    explanation: String | None = None
    identifier: String | None = None
    label: String | None = None
    metadata: JSON | None = None
    name: String | None = None
    score: Float | None = None
    source: Literal['API', 'APP'] | None = None

class PatchDatasetExamplesInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    patches: list[DatasetExamplePatch]
    versionDescription: String | None = None
    versionMetadata: JSON | None = None

class PatchDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    description: String | None = None
    metadata: JSON | None = None
    name: String | None = None

class PatchDatasetSplitInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: String | None = None
    datasetSplitId: ID
    description: String | None = None
    metadata: JSON | None = None
    name: String | None = None

class PatchPromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    metadata: JSON | None = None
    promptId: ID

class PatchPromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    name: String | None = None
    promptLabelId: ID

class PatchUserInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    newPassword: String | None = None
    newRole: Literal['ADMIN', 'MEMBER', 'VIEWER'] | None = None
    newUsername: String | None = None
    userId: ID

class PatchViewerInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    currentPassword: String | None = None
    newPassword: String | None = None
    newUsername: String | None = None

class PerformanceMetricInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    metric: Literal['accuracyScore']

class ProjectFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['name']
    value: String

class ProjectSessionAnnoResultKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    attr: Literal['label', 'score']
    name: String

class ProjectSessionSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    annoResultKey: ProjectSessionAnnoResultKey | None = None
    col: Literal['costTotal', 'endTime', 'numTraces', 'startTime', 'tokenCountTotal'] | None = None
    dir: Literal['asc', 'desc']

class ProjectSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['endTime', 'name']
    dir: Literal['asc', 'desc']

class ProjectTraceRetentionRuleMaxCountInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: Int

class ProjectTraceRetentionRuleMaxDaysInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxDays: Float

class ProjectTraceRetentionRuleMaxDaysOrCountInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: Int
    maxDays: Float

class PromptFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['name']
    value: String

class PromptTemplateOptions(BaseModel):
    model_config = ConfigDict(frozen=True)
    format: Literal['F_STRING', 'JSON_PATH', 'MUSTACHE', 'NONE']
    variables: JSON

class RemoveAnnotationConfigFromProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfigId: ID
    projectId: ID

class ResponseFormatInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: JSON

class SecretKeyValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    key: String
    value: String | None = Field(default=None)

class SetDatasetExampleSplitsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplitIds: list[ID]
    exampleId: ID

class SetDatasetLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    datasetLabelIds: list[ID]

class SetPromptLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: ID
    promptLabelIds: list[ID]

class SetPromptVersionTagInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    name: Identifier
    promptVersionId: ID

class SpanAnnotationSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['createdAt', 'name']
    dir: Literal['asc', 'desc']

class SpanSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['cumulativeTokenCostTotal', 'cumulativeTokenCountCompletion', 'cumulativeTokenCountPrompt', 'cumulativeTokenCountTotal', 'endTime', 'latencyMs', 'startTime', 'tokenCostTotal', 'tokenCountCompletion', 'tokenCountPrompt', 'tokenCountTotal'] | None = None
    dir: Literal['asc', 'desc']
    evalResultKey: EvalResultKey | None = None

class TextContentValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: String

class TimeBinConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    scale: Literal['DAY', 'HOUR', 'MINUTE', 'MONTH', 'WEEK', 'YEAR'] = Field(...)
    utcOffsetMinutes: Int = Field(...)

class TimeRange(BaseModel):
    model_config = ConfigDict(frozen=True)
    end: DateTime | None = Field(default=None)
    start: DateTime | None = Field(default=None)

class TokenPriceInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    costPerMillionTokens: Float
    kind: Literal['COMPLETION', 'PROMPT']
    tokenType: String

class ToolCallFunctionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    arguments: String
    name: String
    type: String | None = 'function'

class ToolDefinitionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: JSON

class ToolResultContentValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    result: JSON
    toolCallId: String

class TraceAnnotationSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal['createdAt', 'name']
    dir: Literal['asc', 'desc']

class UnsetPromptLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: ID
    promptLabelIds: list[ID]

class UpdateAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM']
    explanation: String | None = None
    id: ID
    label: String | None = None
    metadata: JSON
    name: String
    score: Float | None = None
    source: Literal['API', 'APP']

class UpdateDatasetBuiltinEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetEvaluatorId: ID
    displayName: Identifier
    inputMapping: EvaluatorInputMappingInput | None = None

class UpdateModelMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    costs: list[TokenPriceInput]
    id: ID
    name: String
    namePattern: String
    provider: String | None = None
    startTime: DateTime | None = None

class UpsertOrDeleteSecretsMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    secrets: list[SecretKeyValueInput] = Field(...)
AnnotationConfig = TypeAliasType('AnnotationConfig', Union['CategoricalAnnotationConfig', 'ContinuousAnnotationConfig', 'FreeformAnnotationConfig'])
Bin = TypeAliasType('Bin', Union['IntervalBin', 'MissingValueBin', 'NominalBin'])
ContentPart = TypeAliasType('ContentPart', Union['TextContentPart', 'ToolCallContentPart', 'ToolResultContentPart'])
CustomProviderConfig = TypeAliasType('CustomProviderConfig', Union['AWSBedrockCustomProviderConfig', 'AnthropicCustomProviderConfig', 'AzureOpenAICustomProviderConfig', 'GoogleGenAICustomProviderConfig', 'OpenAICustomProviderConfig', 'UnparsableConfig'])
EvaluationResultUnion = TypeAliasType('EvaluationResultUnion', Union['EvaluationError', 'EvaluationSuccess'])
InvocationParameter = TypeAliasType('InvocationParameter', Union['BooleanInvocationParameter', 'BoundedFloatInvocationParameter', 'FloatInvocationParameter', 'IntInvocationParameter', 'JSONInvocationParameter', 'StringInvocationParameter', 'StringListInvocationParameter'])
Point2DPoint3D = TypeAliasType('Point2DPoint3D', Union['Point2D', 'Point3D'])
PromptTemplate = TypeAliasType('PromptTemplate', Union['PromptChatTemplate', 'PromptStringTemplate'])
ResolvedSecret = TypeAliasType('ResolvedSecret', Union['DecryptedSecret', 'UnparsableSecret'])
TraceRetentionRule = TypeAliasType('TraceRetentionRule', Union['TraceRetentionRuleMaxCount', 'TraceRetentionRuleMaxDays', 'TraceRetentionRuleMaxDaysOrCount'])

class Evaluator(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    inputSchema: JSON | None = None
    isBuiltin: Boolean
    kind: Literal['CODE', 'LLM']
    metadata: JSON
    name: Identifier
    updatedAt: DateTime

class TimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]

class AnnotationConfigEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: AnnotationConfig = Field(...)

class AnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    count: Int
    labelCount: Int
    labelFractions: list[LabelFraction]
    labels: list[String]
    meanScore: Float | None = None
    name: String
    scoreCount: Int

class CategoricalAnnotationConfig(AnnotationConfigBase, Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal['CATEGORICAL', 'CONTINUOUS', 'FREEFORM']
    description: String | None = None
    id: ID = Field(...)
    name: String
    optimizationDirection: Literal['MAXIMIZE', 'MINIMIZE', 'NONE']
    values: list[CategoricalAnnotationValue]

class Cluster(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataQualityMetric: DatasetValues = Field(...)
    driftRatio: Float | None = Field(default=None)
    eventIds: list[ID] = Field(...)
    id: ID = Field(...)
    performanceMetric: DatasetValues = Field(...)
    primaryToCorpusRatio: Float | None = Field(default=None)

class CreateAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: AnnotationConfig

class CreateSystemApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: SystemApiKey
    jwt: String

class DataQualityTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]

class DatasetLabelConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetLabelEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class DatasetSplitConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetSplitEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class DatasetVersionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetVersionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class DeleteAnnotationConfigsPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfigs: list[AnnotationConfig]

class DriftTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]

class EvaluatorEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Evaluator = Field(...)

class EvaluatorPreviewsPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    results: list[EvaluationResultUnion]

class GenerativeModel(ModelInterface, Node):
    model_config = ConfigDict(frozen=True)
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    createdAt: DateTime
    id: ID = Field(...)
    kind: Literal['BUILT_IN', 'CUSTOM']
    lastUsedAt: DateTime | None = None
    name: String
    namePattern: String
    provider: String | None = None
    providerKey: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI'] | None = None
    startTime: DateTime | None = None
    tokenPrices: list[TokenPrice]
    updatedAt: DateTime

class GenerativeModelEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: GenerativeModel = Field(...)

class GenerativeProvider(BaseModel):
    model_config = ConfigDict(frozen=True)
    credentialRequirements: list[GenerativeProviderCredentialConfig] = Field(...)
    credentialsSet: Boolean = Field(...)
    dependencies: list[String]
    dependenciesInstalled: Boolean
    key: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI']
    name: String

class GoogleGenAIClientKwargs(BaseModel):
    model_config = ConfigDict(frozen=True)
    httpOptions: GoogleGenAIHttpOptions | None = None

class GoogleGenAICustomProviderConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    googleGenaiAuthenticationMethod: GoogleGenAIAuthenticationMethod
    googleGenaiClientInterface: Literal['CHAT']
    googleGenaiClientKwargs: GoogleGenAIClientKwargs | None = None
    supportsStreaming: Boolean

class IntervalBin(BaseModel):
    model_config = ConfigDict(frozen=True)
    range: NumericRange

class PerformanceTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]

class PromptLabelConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptLabelEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class PromptMessage(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: list[ContentPart]
    role: Literal['AI', 'SYSTEM', 'TOOL', 'USER']

class Segment(BaseModel):
    model_config = ConfigDict(frozen=True)
    bin: Bin
    counts: DatasetValues

class Segments(BaseModel):
    model_config = ConfigDict(frozen=True)
    segments: list[Segment]
    totalCounts: DatasetValues

class SpanAnnotationScoreTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    scoresWithLabels: list[SpanAnnotationScoreWithLabel]
    timestamp: DateTime

class SpanCountTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[SpanCountTimeSeriesDataPoint]

class TextContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: TextContentValue

class ToolCallContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolCall: ToolCallFunction
    toolCallId: String

class ToolResultContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolResult: ToolResultContentValue

class TraceCountByStatusTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceCountByStatusTimeSeriesDataPoint]

class TraceCountTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]

class TraceTokenCostTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceTokenCostTimeSeriesDataPoint]

class TraceTokenCountTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceTokenCountTimeSeriesDataPoint]

class UMAPPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    coordinates: Point2DPoint3D
    embeddingMetadata: EmbeddingMetadata
    eventId: ID = Field(...)
    eventMetadata: EventMetadata
    id: ID

class UMAPPoints(BaseModel):
    model_config = ConfigDict(frozen=True)
    clusters: list[Cluster]
    contextRetrievals: list[Retrieval]
    corpusData: list[UMAPPoint]
    data: list[UMAPPoint]
    referenceData: list[UMAPPoint]

class UpdateAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: AnnotationConfig

class UpdateModelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: GenerativeModel

class AddExamplesToDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    datasetVersionDescription: String | None = None
    datasetVersionMetadata: JSON | None = None
    examples: list[DatasetExampleInput]

class AnnotationFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    exclude: AnnotationFilterCondition | None = None
    include: AnnotationFilterCondition | None = None

class CategoricalAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    name: String
    optimizationDirection: Literal['MAXIMIZE', 'MINIMIZE', 'NONE']
    values: list[CategoricalAnnotationConfigValueInput]

class CategoricalAnnotationConfigOverrideInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    optimizationDirection: Literal['MAXIMIZE', 'MINIMIZE', 'NONE'] | None = None
    values: list[CategoricalAnnotationConfigValueInput] | None = None

class CreateDatasetBuiltinEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    displayName: Identifier
    evaluatorId: ID
    inputMapping: EvaluatorInputMappingInput | None = None

class CreateModelMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    costs: list[TokenPriceInput]
    name: String
    namePattern: String
    provider: String | None = None
    startTime: DateTime | None = None

class GoogleGenAIClientKwargsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    httpOptions: GoogleGenAIHttpOptionsInput | None = None

class GoogleGenAICustomProviderConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    googleGenaiAuthenticationMethod: GoogleGenAIAuthenticationMethodInput
    googleGenaiClientKwargs: GoogleGenAIClientKwargsInput | None = None

class PlaygroundEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    displayName: Identifier
    id: ID
    inputMapping: EvaluatorInputMappingInput = Field(default_factory=lambda: EvaluatorInputMappingInput.model_validate({'literalMapping': {}, 'pathMapping': {}}))
    outputConfig: CategoricalAnnotationConfigOverrideInput | None = None

class ProjectTraceRetentionRuleInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: ProjectTraceRetentionRuleMaxCountInput | None = None
    maxDays: ProjectTraceRetentionRuleMaxDaysInput | None = None
    maxDaysOrCount: ProjectTraceRetentionRuleMaxDaysOrCountInput | None = None

class ToolCallContentValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolCall: ToolCallFunctionInput
    toolCallId: String

class AnnotationConfigConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[AnnotationConfigEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ClassificationEvaluatorConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    choices: JSON
    description: String | None = None
    messages: list[PromptMessage]
    name: String
    optimizationDirection: Literal['MAXIMIZE', 'MINIMIZE', 'NONE']

class CreateModelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: GenerativeModel

class DeleteModelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: GenerativeModel

class Dimension(Node):
    model_config = ConfigDict(frozen=True)
    categories: list[String] = Field(...)
    dataQualityMetric: Float | None = None
    dataQualityTimeSeries: DataQualityTimeSeries = Field(...)
    dataType: Literal['categorical', 'numeric'] = Field(...)
    driftMetric: Float | None = None
    driftTimeSeries: DriftTimeSeries = Field(...)
    id: ID = Field(...)
    name: String = Field(...)
    segmentsComparison: Segments = Field(...)
    shape: Literal['continuous', 'discrete'] = Field(...)
    type: Literal['actual', 'feature', 'prediction', 'tag'] = Field(...)

class DimensionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Dimension = Field(...)

class DimensionWithValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    dimension: Dimension
    value: String | None = Field(default=None)

class EmbeddingDimension(Node):
    model_config = ConfigDict(frozen=True)
    UMAPPoints_1: UMAPPoints = Field(..., alias='UMAPPoints')
    dataQualityTimeSeries: DataQualityTimeSeries = Field(...)
    driftMetric: Float | None = Field(default=None)
    driftTimeSeries: DriftTimeSeries = Field(...)
    id: ID = Field(...)
    name: String
    retrievalMetric: Float | None = Field(default=None)
    retrievalMetricTimeSeries: DriftTimeSeries = Field(...)

class EmbeddingDimensionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: EmbeddingDimension = Field(...)

class EvaluatorConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[EvaluatorEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class Event(BaseModel):
    model_config = ConfigDict(frozen=True)
    dimensions: list[DimensionWithValue]
    documentText: String | None = Field(default=None)
    eventMetadata: EventMetadata
    id: ID
    promptAndResponse: PromptResponse | None = Field(default=None)

class GenerativeModelConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[GenerativeModelEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class Inferences(BaseModel):
    model_config = ConfigDict(frozen=True)
    endTime: DateTime = Field(...)
    events: list[Event]
    name: String = Field(...)
    recordCount: Int = Field(...)
    startTime: DateTime = Field(...)

class PromptChatTemplate(BaseModel):
    model_config = ConfigDict(frozen=True)
    messages: list[PromptMessage]

class SpanAnnotationScoreTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[SpanAnnotationScoreTimeSeriesDataPoint]
    names: list[String]

class ToolCallContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolCall: ToolCallContentValue

class AnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    categorical: CategoricalAnnotationConfigInput | None = None
    continuous: ContinuousAnnotationConfigInput | None = None
    freeform: FreeformAnnotationConfigInput | None = None

class ChatCompletionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluators: list[PlaygroundEvaluatorInput] = Field(default_factory=list)
    invocationParameters: list[InvocationParameterInput] = Field(default_factory=list)
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    promptName: Identifier | None = None
    repetitions: Int
    template: PromptTemplateOptions | None = None
    tools: list[JSON] | None = None

class ChatCompletionOverDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    appendedMessagesPath: String | None = Field(default=None)
    datasetId: ID
    datasetVersionId: ID | None = None
    evaluators: list[PlaygroundEvaluatorInput] = Field(default_factory=list)
    experimentDescription: String | None = None
    experimentMetadata: JSON | None = {}
    experimentName: String | None = None
    invocationParameters: list[InvocationParameterInput] = Field(default_factory=list)
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    promptName: Identifier | None = None
    repetitions: Int
    splitIds: list[ID] | None = None
    templateFormat: Literal['F_STRING', 'JSON_PATH', 'MUSTACHE', 'NONE']
    templateVariablesPath: String | None = Field(default='input')
    tools: list[JSON] | None = None

class ContentPartInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: TextContentValueInput | None = None
    toolCall: ToolCallContentValueInput | None = None
    toolResult: ToolResultContentValueInput | None = None

class CreateAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: AnnotationConfigInput

class CreateProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    addProjects: list[ID] | None = None
    cronExpression: CronExpression
    name: String
    rule: ProjectTraceRetentionRuleInput

class GenerativeModelCustomerProviderConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    anthropic: AnthropicCustomProviderConfigInput | None = None
    awsBedrock: AWSBedrockCustomProviderConfigInput | None = None
    azureOpenai: AzureOpenAICustomProviderConfigInput | None = None
    googleGenai: GoogleGenAICustomProviderConfigInput | None = None
    openai: OpenAICustomProviderConfigInput | None = None

class PatchGenerativeModelCustomProviderMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    clientConfig: GenerativeModelCustomerProviderConfigInput | None = None
    description: String | None = None
    id: ID
    name: String | None = None
    provider: String | None = None

class PatchProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    addProjects: list[ID] | None = None
    cronExpression: CronExpression | None = None
    id: ID
    name: String | None = None
    removeProjects: list[ID] | None = None
    rule: ProjectTraceRetentionRuleInput | None = None

class PromptMessageInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: list[ContentPartInput]
    role: String

class UpdateAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: AnnotationConfigInput
    id: ID

class DimensionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DimensionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class EmbeddingDimensionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[EmbeddingDimensionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class InferenceModel(BaseModel):
    model_config = ConfigDict(frozen=True)
    corpusInferences: Inferences | None = None
    dimensions: DimensionConnection
    embeddingDimensions: EmbeddingDimensionConnection
    exportedFiles: list[ExportedFile] = Field(...)
    performanceMetric: Float | None = None
    performanceTimeSeries: PerformanceTimeSeries = Field(...)
    primaryInferences: Inferences
    referenceInferences: Inferences | None = None

class CreateGenerativeModelCustomProviderMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    clientConfig: GenerativeModelCustomerProviderConfigInput
    description: String | None = None
    name: String
    provider: String

class PromptChatTemplateInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    messages: list[PromptMessageInput]

class ChatPromptVersionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    invocationParameters: JSON
    modelName: String
    modelProvider: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI']
    responseFormat: ResponseFormatInput | None = None
    template: PromptChatTemplateInput
    templateFormat: Literal['F_STRING', 'JSON_PATH', 'MUSTACHE', 'NONE']
    tools: list[ToolDefinitionInput] = Field(default_factory=list)

class CreateChatPromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    metadata: JSON | None = None
    name: Identifier
    promptVersion: ChatPromptVersionInput

class CreateChatPromptVersionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: ID
    promptVersion: ChatPromptVersionInput
    tags: list[SetPromptVersionTagInput] | None = None

class CreateDatasetLLMEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    description: String | None = None
    inputMapping: EvaluatorInputMappingInput | None = None
    name: Identifier
    outputConfig: CategoricalAnnotationConfigInput
    promptVersion: ChatPromptVersionInput
    promptVersionId: ID | None = None

class InlineLLMEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    outputConfig: CategoricalAnnotationConfigInput
    promptVersion: ChatPromptVersionInput

class UpdateDatasetLLMEvaluatorInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetEvaluatorId: ID
    datasetId: ID
    description: String | None = None
    inputMapping: EvaluatorInputMappingInput | None = None
    name: Identifier
    outputConfig: CategoricalAnnotationConfigInput
    promptVersion: ChatPromptVersionInput
    promptVersionId: ID | None = None

class EvaluatorPreviewInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    builtInEvaluatorId: ID | None = None
    inlineLlmEvaluator: InlineLLMEvaluatorInput | None = None

class EvaluatorPreviewItemInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    context: JSON
    evaluator: EvaluatorPreviewInput
    inputMapping: EvaluatorInputMappingInput = Field(default_factory=lambda: EvaluatorInputMappingInput.model_validate({'literalMapping': {}, 'pathMapping': {}}))

class EvaluatorPreviewsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    previews: list[EvaluatorPreviewItemInput]

class Annotation(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] = Field(...)
    createdAt: DateTime = Field(...)
    explanation: String | None = Field(default=None)
    identifier: String = Field(...)
    label: String | None = Field(default=None)
    metadata: JSON = Field(...)
    name: String = Field(...)
    score: Float | None = Field(default=None)
    source: Literal['API', 'APP'] = Field(...)
    updatedAt: DateTime = Field(...)
    user: User | None = Field(default=None)

class AddAnnotationConfigToProjectPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project

class BuiltInEvaluator(Evaluator, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    inputSchema: JSON | None = None
    isBuiltin: Boolean
    kind: Literal['CODE', 'LLM']
    metadata: JSON
    name: Identifier
    updatedAt: DateTime
    user: User | None = None

class ChatCompletionMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    repetitions: list[ChatCompletionRepetition]

class ChatCompletionOverDatasetMutationExamplePayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID
    experimentRunId: ID
    repetition: ChatCompletionRepetition
    repetitionNumber: Int

class ChatCompletionOverDatasetMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: ID
    datasetVersionId: ID
    examples: list[ChatCompletionOverDatasetMutationExamplePayload]
    experimentId: ID

class ChatCompletionRepetition(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: String | None = None
    errorMessage: String | None = None
    evaluations: list[EvaluationResultUnion]
    repetitionNumber: Int
    span: Span | None = None
    toolCalls: list[ChatCompletionToolCall]

class ChatCompletionSubscriptionExperiment(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    experiment: Experiment
    repetitionNumber: Int | None = None

class ChatCompletionSubscriptionResult(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    experimentRun: ExperimentRun | None = None
    repetitionNumber: Int | None = None
    span: Span | None = None

class CodeEvaluator(Evaluator, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    inputSchema: JSON | None = None
    isBuiltin: Boolean
    kind: Literal['CODE', 'LLM']
    metadata: JSON
    name: Identifier
    updatedAt: DateTime
    user: User | None = None

class CodeEvaluatorMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluator: CodeEvaluator

class CreateDatasetLabelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabel: DatasetLabel
    datasets: list[Dataset]

class CreateGenerativeModelCustomProviderMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    provider: GenerativeModelCustomProvider

class CreateUserApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: UserApiKey
    jwt: String

class Dataset(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    datasetEvaluator: DatasetEvaluator
    datasetEvaluators: DatasetEvaluatorConnection
    description: String | None = None
    evaluatorCount: Int = Field(...)
    exampleCount: Int = Field(...)
    examples: DatasetExampleConnection
    experimentAnnotationSummaries: list[DatasetExperimentAnnotationSummary]
    experimentCount: Int = Field(...)
    experiments: ExperimentConnection
    id: ID = Field(...)
    labels: list[DatasetLabel]
    lastUpdatedAt: DateTime | None = None
    metadata: JSON
    name: String
    splits: list[DatasetSplit]
    updatedAt: DateTime
    versions: DatasetVersionConnection

class DatasetConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class DatasetEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Dataset = Field(...)

class DatasetEvaluator(Node):
    model_config = ConfigDict(frozen=True)
    dataset: Dataset
    description: String | None = None
    displayName: Identifier
    evaluator: Evaluator
    id: ID = Field(...)
    inputMapping: EvaluatorInputMapping
    outputConfig: CategoricalAnnotationConfig | None = None
    updatedAt: DateTime

class DatasetEvaluatorConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetEvaluatorEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class DatasetEvaluatorEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: DatasetEvaluator = Field(...)

class DatasetEvaluatorMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluator: DatasetEvaluator

class DatasetExample(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    datasetSplits: list[DatasetSplit]
    experimentRepeatedRunGroups: list[ExperimentRepeatedRunGroup]
    experimentRuns: ExperimentRunConnection
    id: ID = Field(...)
    revision: DatasetExampleRevision
    span: Span | None = None

class DatasetExampleConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetExampleEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class DatasetExampleEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: DatasetExample = Field(...)

class DatasetMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataset: Dataset

class DatasetSplitMutationPayloadWithExamples(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplit: DatasetSplit
    examples: list[DatasetExample]

class EvaluationChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: ID | None = None
    experimentRunEvaluation: ExperimentRunAnnotation | None = None
    repetitionNumber: Int | None = None
    spanEvaluation: SpanAnnotation | None = None

class EvaluationSuccess(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotation: ExperimentRunAnnotation

class Experiment(Node):
    model_config = ConfigDict(frozen=True)
    annotationSummaries: list[ExperimentAnnotationSummary]
    averageRunLatencyMs: Float | None = None
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    createdAt: DateTime
    datasetSplits: DatasetSplitConnection
    datasetVersionId: ID
    description: String | None = None
    errorRate: Float | None = None
    id: ID = Field(...)
    lastUpdatedAt: DateTime | None = None
    metadata: JSON
    name: String
    project: Project | None = None
    projectName: String | None = None
    repetitions: Int
    runCount: Int
    runs: ExperimentRunConnection
    sequenceNumber: Int = Field(...)
    updatedAt: DateTime
    user: User | None = Field(default=None)

class ExperimentComparison(Node):
    model_config = ConfigDict(frozen=True)
    example: DatasetExample
    id: ID = Field(...)
    repeatedRunGroups: list[ExperimentRepeatedRunGroup]

class ExperimentComparisonConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentComparisonEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ExperimentComparisonEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: ExperimentComparison = Field(...)

class ExperimentConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ExperimentEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Experiment = Field(...)

class ExperimentMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    experiments: list[Experiment]

class ExperimentRepeatedRunGroup(Node):
    model_config = ConfigDict(frozen=True)
    annotationSummaries: list[ExperimentRepeatedRunGroupAnnotationSummary]
    averageLatencyMs: Float | None = None
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    experimentId: ID
    id: ID = Field(...)
    runs: list[ExperimentRun]

class ExperimentRun(Node):
    model_config = ConfigDict(frozen=True)
    annotations: ExperimentRunAnnotationConnection
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    endTime: DateTime
    error: String | None = None
    example: DatasetExample
    experimentId: ID
    id: ID = Field(...)
    latencyMs: Float
    output: JSON | None = None
    repetitionNumber: Int
    startTime: DateTime
    trace: Trace | None = None
    traceId: String | None = None

class ExperimentRunAnnotation(Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] = Field(...)
    endTime: DateTime = Field(...)
    error: String | None = Field(default=None)
    explanation: String | None = Field(default=None)
    id: ID = Field(...)
    label: String | None = Field(default=None)
    metadata: JSON = Field(...)
    name: String = Field(...)
    score: Float | None = Field(default=None)
    startTime: DateTime = Field(...)
    trace: Trace | None = Field(default=None)
    traceId: ID | None = Field(default=None)

class ExperimentRunAnnotationConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentRunAnnotationEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ExperimentRunAnnotationEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: ExperimentRunAnnotation = Field(...)

class ExperimentRunConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentRunEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ExperimentRunEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: ExperimentRun = Field(...)

class GenerativeModelCustomProvider(Node):
    model_config = ConfigDict(frozen=True)
    config: CustomProviderConfig = Field(...)
    createdAt: DateTime = Field(...)
    description: String | None = Field(default=None)
    id: ID = Field(...)
    modelNames: list[String] = Field(...)
    name: String = Field(...)
    provider: String = Field(...)
    sdk: Literal['ANTHROPIC', 'AWS_BEDROCK', 'AZURE_OPENAI', 'GOOGLE_GENAI', 'OPENAI'] = Field(...)
    updatedAt: DateTime = Field(...)
    user: User | None = Field(default=None)

class GenerativeModelCustomProviderConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[GenerativeModelCustomProviderEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class GenerativeModelCustomProviderEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: GenerativeModelCustomProvider = Field(...)

class LLMEvaluator(Evaluator, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    inputSchema: JSON | None = None
    isBuiltin: Boolean
    kind: Literal['CODE', 'LLM']
    metadata: JSON
    name: Identifier
    outputConfig: CategoricalAnnotationConfig
    prompt: Prompt
    promptVersion: PromptVersion
    promptVersionTag: PromptVersionTag | None = None
    updatedAt: DateTime
    user: User | None = None

class PatchGenerativeModelCustomProviderMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    provider: GenerativeModelCustomProvider

class Project(Node):
    model_config = ConfigDict(frozen=True)
    annotationConfigs: AnnotationConfigConnection
    costSummary: SpanCostSummary
    createdAt: DateTime
    documentEvaluationNames: list[String] = Field(...)
    documentEvaluationSummary: DocumentEvaluationSummary | None = None
    endTime: DateTime | None = None
    gradientEndColor: String
    gradientStartColor: String
    id: ID = Field(...)
    latencyMsQuantile: Float | None = None
    name: String
    recordCount: Int
    sessionAnnotationNames: list[String] = Field(...)
    sessions: ProjectSessionConnection
    spanAnnotationNames: list[String] = Field(...)
    spanAnnotationScoreTimeSeries: SpanAnnotationScoreTimeSeries
    spanAnnotationSummary: AnnotationSummary | None = None
    spanCountTimeSeries: SpanCountTimeSeries
    spanLatencyMsQuantile: Float | None = None
    spans: SpanConnection
    startTime: DateTime | None = None
    streamingLastUpdatedAt: DateTime | None = None
    tokenCountCompletion: Float
    tokenCountPrompt: Float
    tokenCountTotal: Float
    topModelsByCost: list[GenerativeModel]
    topModelsByTokenCount: list[GenerativeModel]
    trace: Trace | None = None
    traceAnnotationSummary: AnnotationSummary | None = None
    traceAnnotationsNames: list[String] = Field(...)
    traceCount: Int
    traceCountByStatusTimeSeries: TraceCountByStatusTimeSeries
    traceCountTimeSeries: TraceCountTimeSeries
    traceLatencyMsPercentileTimeSeries: TraceLatencyPercentileTimeSeries
    traceRetentionPolicy: ProjectTraceRetentionPolicy
    traceTokenCostTimeSeries: TraceTokenCostTimeSeries
    traceTokenCountTimeSeries: TraceTokenCountTimeSeries
    updatedAt: DateTime
    validateSpanFilterCondition: ValidationResult

class ProjectConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ProjectEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Project = Field(...)

class ProjectMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project

class ProjectSession(Node):
    model_config = ConfigDict(frozen=True)
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    endTime: DateTime
    firstInput: SpanIOValue | None = None
    id: ID = Field(...)
    lastOutput: SpanIOValue | None = None
    numTraces: Int
    numTracesWithError: Int
    project: Project
    sessionAnnotationSummaries: list[AnnotationSummary] = Field(...)
    sessionAnnotations: list[ProjectSessionAnnotation]
    sessionId: String
    startTime: DateTime
    tokenUsage: TokenUsage
    traceLatencyMsQuantile: Float | None = None
    traces: TraceConnection

class ProjectSessionAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    projectSessionAnnotation: ProjectSessionAnnotation

class ProjectSessionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectSessionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ProjectSessionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: ProjectSession = Field(...)

class ProjectTraceRetentionPolicy(Node):
    model_config = ConfigDict(frozen=True)
    cronExpression: CronExpression
    id: ID = Field(...)
    name: String
    projects: ProjectConnection
    rule: TraceRetentionRule

class ProjectTraceRetentionPolicyConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectTraceRetentionPolicyEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class ProjectTraceRetentionPolicyEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: ProjectTraceRetentionPolicy = Field(...)

class ProjectTraceRetentionPolicyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    node: ProjectTraceRetentionPolicy

class Prompt(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    labels: list[PromptLabel]
    metadata: JSON
    name: Identifier
    promptVersions: PromptVersionConnection
    sourcePrompt: Prompt | None = None
    sourcePromptId: ID | None = None
    version: PromptVersion
    versionTags: list[PromptVersionTag]

class PromptConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class PromptEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Prompt = Field(...)

class PromptVersion(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime
    description: String | None = None
    id: ID = Field(...)
    invocationParameters: JSON | None = None
    isLatest: Boolean
    metadata: JSON
    modelName: String
    modelProvider: Literal['ANTHROPIC', 'AWS', 'AZURE_OPENAI', 'DEEPSEEK', 'GOOGLE', 'OLLAMA', 'OPENAI', 'XAI']
    previousVersion: PromptVersion | None = None
    responseFormat: ResponseFormat | None = None
    sequenceNumber: Int = Field(...)
    tags: list[PromptVersionTag]
    template: PromptTemplate
    templateFormat: Literal['F_STRING', 'JSON_PATH', 'MUSTACHE', 'NONE']
    templateType: Literal['CHAT', 'STRING']
    tools: list[ToolDefinition]
    user: User | None = None

class PromptVersionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptVersionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class PromptVersionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: PromptVersion = Field(...)

class PromptVersionTag(Node):
    model_config = ConfigDict(frozen=True)
    description: String | None = None
    id: ID = Field(...)
    name: Identifier
    promptVersionId: ID
    user: User | None = None

class PromptVersionTagMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    prompt: Prompt
    promptVersionTag: PromptVersionTag | None = None

class RemoveAnnotationConfigFromProjectPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project

class Secret(Node):
    model_config = ConfigDict(frozen=True)
    id: ID = Field(...)
    key: String
    updatedAt: DateTime
    user: User | None = None
    value: ResolvedSecret

class SecretConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[SecretEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class SecretEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Secret = Field(...)

class SetDatasetExampleSplitsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    example: DatasetExample

class SetDatasetLabelsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataset: Dataset

class Span(Node):
    model_config = ConfigDict(frozen=True)
    asExampleRevision: SpanAsExampleRevision = Field(...)
    attributes: String = Field(...)
    containedInDataset: Boolean = Field(...)
    context: SpanContext
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary | None = None
    cumulativeTokenCountCompletion: Float | None = Field(default=None)
    cumulativeTokenCountPrompt: Float | None = Field(default=None)
    cumulativeTokenCountTotal: Float | None = Field(default=None)
    descendants: SpanConnection = Field(...)
    documentEvaluations: list[DocumentAnnotation] = Field(...)
    documentRetrievalMetrics: list[DocumentRetrievalMetrics] = Field(...)
    endTime: DateTime | None = None
    events: list[SpanEvent]
    id: ID = Field(...)
    input: SpanIOValue | None = None
    invocationParameters: list[InvocationParameter] = Field(...)
    latencyMs: Float | None = None
    metadata: String | None = Field(default=None)
    name: String
    numChildSpans: Int
    numDocuments: Int | None = None
    output: SpanIOValue | None = None
    parentId: ID | None = Field(default=None)
    project: Project = Field(...)
    propagatedStatusCode: Literal['ERROR', 'OK', 'UNSET'] = Field(...)
    spanAnnotationSummaries: list[AnnotationSummary] = Field(...)
    spanAnnotations: list[SpanAnnotation] = Field(...)
    spanId: ID
    spanKind: Literal['agent', 'chain', 'embedding', 'evaluator', 'guardrail', 'llm', 'reranker', 'retriever', 'tool', 'unknown']
    spanNotes: list[SpanAnnotation] = Field(...)
    startTime: DateTime
    statusCode: Literal['ERROR', 'OK', 'UNSET']
    statusMessage: String
    tokenCountCompletion: Int | None = None
    tokenCountPrompt: Int | None = None
    tokenCountTotal: Int | None = None
    tokenPromptDetails: TokenCountPromptDetails
    trace: Trace

class SpanAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    spanAnnotations: list[SpanAnnotation]

class SpanConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[SpanEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class SpanEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Span = Field(...)

class Trace(Node):
    model_config = ConfigDict(frozen=True)
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    endTime: DateTime
    id: ID = Field(...)
    latencyMs: Float | None = None
    numSpans: Int
    project: Project
    projectId: ID
    projectSessionId: ID | None = None
    rootSpan: Span | None = None
    session: ProjectSession | None = None
    spans: SpanConnection
    startTime: DateTime
    traceAnnotationSummaries: list[AnnotationSummary] = Field(...)
    traceAnnotations: list[TraceAnnotation] = Field(...)
    traceId: ID

class TraceAnnotation(Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] = Field(...)
    explanation: String | None = Field(default=None)
    id: ID = Field(...)
    identifier: String = Field(...)
    label: String | None = Field(default=None)
    metadata: JSON = Field(...)
    name: String = Field(...)
    score: Float | None = Field(default=None)
    source: Literal['API', 'APP'] = Field(...)
    trace: Trace = Field(...)
    user: User | None = Field(default=None)

class TraceAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    traceAnnotations: list[TraceAnnotation]

class TraceConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[TraceEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class TraceEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: Trace = Field(...)

class UpsertOrDeleteSecretsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    deletedIds: list[ID] = Field(...)
    upsertedSecrets: list[Secret] = Field(...)

class User(Node):
    model_config = ConfigDict(frozen=True)
    apiKeys: list[UserApiKey]
    authMethod: Literal['LDAP', 'LOCAL', 'OAUTH2']
    createdAt: DateTime
    email: String | None = None
    id: ID = Field(...)
    isManagementUser: Boolean
    passwordNeedsReset: Boolean
    profilePictureUrl: String | None = None
    role: UserRole
    username: String

class UserApiKey(ApiKey, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: DateTime = Field(...)
    description: String | None = Field(default=None)
    expiresAt: DateTime | None = Field(default=None)
    id: ID = Field(...)
    name: String = Field(...)
    user: User

class UserConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[UserEdge] = Field(...)
    pageInfo: PageInfo = Field(...)

class UserEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: String = Field(...)
    node: User = Field(...)

class UserMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    user: User

class DocumentAnnotation(Annotation, Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] = Field(...)
    createdAt: DateTime = Field(...)
    documentPosition: Int = Field(...)
    explanation: String | None = Field(default=None)
    id: ID = Field(...)
    identifier: String = Field(...)
    label: String | None = Field(default=None)
    metadata: JSON = Field(...)
    name: String = Field(...)
    score: Float | None = Field(default=None)
    source: Literal['API', 'APP'] = Field(...)
    span: Span = Field(...)
    updatedAt: DateTime = Field(...)
    user: User | None = Field(default=None)

class ProjectSessionAnnotation(Annotation, Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] = Field(...)
    createdAt: DateTime = Field(...)
    explanation: String | None = Field(default=None)
    id: ID = Field(...)
    identifier: String = Field(...)
    label: String | None = Field(default=None)
    metadata: JSON = Field(...)
    name: String = Field(...)
    projectSession: ProjectSession = Field(...)
    projectSessionId: ID = Field(...)
    score: Float | None = Field(default=None)
    source: Literal['API', 'APP'] = Field(...)
    updatedAt: DateTime = Field(...)
    user: User | None = Field(default=None)

class SpanAnnotation(Annotation, Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal['CODE', 'HUMAN', 'LLM'] = Field(...)
    createdAt: DateTime = Field(...)
    explanation: String | None = Field(default=None)
    id: ID = Field(...)
    identifier: String = Field(...)
    label: String | None = Field(default=None)
    metadata: JSON = Field(...)
    name: String = Field(...)
    score: Float | None = Field(default=None)
    source: Literal['API', 'APP'] = Field(...)
    span: Span = Field(...)
    spanId: ID
    updatedAt: DateTime = Field(...)
    user: User | None = Field(default=None)
Annotation.model_rebuild()
AddAnnotationConfigToProjectPayload.model_rebuild()
BuiltInEvaluator.model_rebuild()
ChatCompletionMutationPayload.model_rebuild()
ChatCompletionOverDatasetMutationExamplePayload.model_rebuild()
ChatCompletionRepetition.model_rebuild()
ChatCompletionSubscriptionExperiment.model_rebuild()
ChatCompletionSubscriptionResult.model_rebuild()
CodeEvaluator.model_rebuild()
CreateDatasetLabelMutationPayload.model_rebuild()
CreateGenerativeModelCustomProviderMutationPayload.model_rebuild()
CreateUserApiKeyMutationPayload.model_rebuild()
Dataset.model_rebuild()
DatasetConnection.model_rebuild()
DatasetEvaluatorConnection.model_rebuild()
DatasetExample.model_rebuild()
DatasetExampleConnection.model_rebuild()
EvaluationChunk.model_rebuild()
EvaluationSuccess.model_rebuild()
Experiment.model_rebuild()
ExperimentComparison.model_rebuild()
ExperimentComparisonConnection.model_rebuild()
ExperimentConnection.model_rebuild()
ExperimentRepeatedRunGroup.model_rebuild()
ExperimentRun.model_rebuild()
ExperimentRunAnnotation.model_rebuild()
ExperimentRunAnnotationConnection.model_rebuild()
ExperimentRunConnection.model_rebuild()
GenerativeModelCustomProvider.model_rebuild()
GenerativeModelCustomProviderConnection.model_rebuild()
LLMEvaluator.model_rebuild()
Project.model_rebuild()
ProjectConnection.model_rebuild()
ProjectSession.model_rebuild()
ProjectSessionAnnotationMutationPayload.model_rebuild()
ProjectSessionConnection.model_rebuild()
ProjectTraceRetentionPolicyConnection.model_rebuild()
Prompt.model_rebuild()
PromptConnection.model_rebuild()
PromptVersion.model_rebuild()
PromptVersionConnection.model_rebuild()
PromptVersionTag.model_rebuild()
Secret.model_rebuild()
SecretConnection.model_rebuild()
Span.model_rebuild()
SpanAnnotationMutationPayload.model_rebuild()
SpanConnection.model_rebuild()
Trace.model_rebuild()
TraceAnnotation.model_rebuild()
TraceConnection.model_rebuild()
User.model_rebuild()
UserConnection.model_rebuild()
DocumentAnnotation.model_rebuild()
ProjectSessionAnnotation.model_rebuild()
SpanAnnotation.model_rebuild()