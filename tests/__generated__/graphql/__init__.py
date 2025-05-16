"""Do not edit"""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class Annotation(BaseModel):
    model_config = ConfigDict(frozen=True)
    explanation: Optional[str] = Field(default=None)
    label: Optional[str] = Field(default=None)
    name: str = Field(...)
    score: Optional[float] = Field(default=None)


class ApiKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    createdAt: str = Field(...)
    description: Optional[str] = Field(default=None)
    expiresAt: Optional[str] = Field(default=None)
    name: str = Field(...)


class ChatCompletionSubscriptionPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None


class ExampleRevision(BaseModel):
    model_config = ConfigDict(frozen=True)
    input: dict[str, Any]
    metadata: dict[str, Any]
    output: dict[str, Any]


class InvocationParameterBase(BaseModel):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    invocationName: str
    label: str
    required: bool


class Node(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str = Field(...)


class TimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class AddAnnotationConfigToProjectPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project


class AnnotationConfigConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[AnnotationConfigEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class AnnotationConfigEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Union[
        "CategoricalAnnotationConfig", "ContinuousAnnotationConfig", "FreeformAnnotationConfig"
    ] = Field(...)


class AnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    count: int
    labelCount: int
    labelFractions: list[LabelFraction]
    labels: list[str]
    meanScore: Optional[float] = None
    scoreCount: int


class BooleanInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[bool] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    required: bool


class BoundedFloatInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[float] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    maxValue: float
    minValue: float
    required: bool


class CategoricalAnnotationConfig(Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
    description: Optional[str] = None
    id: str = Field(...)
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE"]
    values: list[CategoricalAnnotationValue]


class CategoricalAnnotationValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: str
    score: Optional[float] = None


class ChatCompletionFunctionCall(BaseModel):
    model_config = ConfigDict(frozen=True)
    arguments: str
    name: str


class ChatCompletionMutationError(BaseModel):
    model_config = ConfigDict(frozen=True)
    message: str


class ChatCompletionMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: Optional[str] = None
    errorMessage: Optional[str] = None
    span: Span
    toolCalls: list[ChatCompletionToolCall]


class ChatCompletionOverDatasetMutationExamplePayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: str
    experimentRunId: str
    result: Union["ChatCompletionMutationError", "ChatCompletionMutationPayload"]


class ChatCompletionOverDatasetMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: str
    datasetVersionId: str
    examples: list[ChatCompletionOverDatasetMutationExamplePayload]
    experimentId: str


class ChatCompletionSubscriptionError(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    message: str


class ChatCompletionSubscriptionExperiment(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    experiment: Experiment


class ChatCompletionSubscriptionResult(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    experimentRun: Optional[ExperimentRun] = None
    span: Optional[Span] = None


class ChatCompletionToolCall(BaseModel):
    model_config = ConfigDict(frozen=True)
    function: ChatCompletionFunctionCall
    id: str


class Cluster(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataQualityMetric: DatasetValues = Field(...)
    driftRatio: Optional[float] = Field(default=None)
    eventIds: list[str] = Field(...)
    id: str = Field(...)
    performanceMetric: DatasetValues = Field(...)
    primaryToCorpusRatio: Optional[float] = Field(default=None)


class ContinuousAnnotationConfig(Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
    description: Optional[str] = None
    id: str = Field(...)
    lowerBound: Optional[float] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE"]
    upperBound: Optional[float] = None


class CreateCategoricalAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: CategoricalAnnotationConfig


class CreateContinuousAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: ContinuousAnnotationConfig


class CreateFreeformAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: FreeformAnnotationConfig


class CreateSystemApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: SystemApiKey
    jwt: str


class CreateUserApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: UserApiKey
    jwt: str


class DataQualityTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class Dataset(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str
    description: Optional[str] = None
    exampleCount: int = Field(...)
    examples: DatasetExampleConnection
    experimentAnnotationSummaries: list[ExperimentAnnotationSummary]
    experimentCount: int = Field(...)
    experiments: ExperimentConnection
    id: str = Field(...)
    lastUpdatedAt: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    updatedAt: str
    versions: DatasetVersionConnection


class DatasetConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class DatasetEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Dataset = Field(...)


class DatasetExample(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str
    experimentRuns: ExperimentRunConnection
    id: str = Field(...)
    revision: DatasetExampleRevision
    span: Optional[Span] = None


class DatasetExampleConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetExampleEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class DatasetExampleEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: DatasetExample = Field(...)


class DatasetExampleRevision(ExampleRevision):
    model_config = ConfigDict(frozen=True)
    createdAt: str
    input: dict[str, Any]
    metadata: dict[str, Any]
    output: dict[str, Any]
    revisionKind: Literal["CREATE", "DELETE", "PATCH"]


class DatasetMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataset: Dataset


class DatasetValues(BaseModel):
    model_config = ConfigDict(frozen=True)
    primaryValue: Optional[float] = None
    referenceValue: Optional[float] = None


class DatasetVersion(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str
    description: Optional[str] = None
    id: str = Field(...)
    metadata: dict[str, Any]


class DatasetVersionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetVersionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class DatasetVersionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: DatasetVersion = Field(...)


class DbTableStats(BaseModel):
    model_config = ConfigDict(frozen=True)
    numBytes: float
    tableName: str


class DeleteAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: Union[
        "CategoricalAnnotationConfig", "ContinuousAnnotationConfig", "FreeformAnnotationConfig"
    ]


class DeleteApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKeyId: str


class DeletePromptMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)


class Dimension(Node):
    model_config = ConfigDict(frozen=True)
    categories: list[str] = Field(...)
    dataQualityMetric: Optional[float] = None
    dataQualityTimeSeries: DataQualityTimeSeries = Field(...)
    dataType: Literal["categorical", "numeric"] = Field(...)
    driftMetric: Optional[float] = None
    driftTimeSeries: DriftTimeSeries = Field(...)
    id: str = Field(...)
    name: str = Field(...)
    segmentsComparison: Segments = Field(...)
    shape: Literal["continuous", "discrete"] = Field(...)
    type: Literal["actual", "feature", "prediction", "tag"] = Field(...)


class DimensionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DimensionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class DimensionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Dimension = Field(...)


class DimensionWithValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    dimension: Dimension
    value: Optional[str] = Field(default=None)


class DocumentEvaluation(Annotation):
    model_config = ConfigDict(frozen=True)
    documentPosition: int = Field(...)
    explanation: Optional[str] = Field(default=None)
    label: Optional[str] = Field(default=None)
    name: str = Field(...)
    score: Optional[float] = Field(default=None)


class DocumentEvaluationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    averageNdcg: Optional[float] = None
    averagePrecision: Optional[float] = None
    countHit: int
    countNdcg: int
    countPrecision: int
    countReciprocalRank: int
    evaluationName: str
    hitRate: Optional[float] = None
    meanReciprocalRank: Optional[float] = None


class DocumentRetrievalMetrics(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluationName: str
    hit: Optional[float] = Field(default=None)
    ndcg: Optional[float] = Field(default=None)
    precision: Optional[float] = Field(default=None)
    reciprocalRank: Optional[float] = Field(default=None)


class DriftTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class EmbeddingDimension(Node):
    model_config = ConfigDict(frozen=True)
    UMAPPoints: UMAPPoints
    dataQualityTimeSeries: DataQualityTimeSeries = Field(...)
    driftMetric: Optional[float] = Field(default=None)
    driftTimeSeries: DriftTimeSeries = Field(...)
    id: str = Field(...)
    name: str
    retrievalMetric: Optional[float] = Field(default=None)
    retrievalMetricTimeSeries: DriftTimeSeries = Field(...)


class EmbeddingDimensionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[EmbeddingDimensionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class EmbeddingDimensionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: EmbeddingDimension = Field(...)


class EmbeddingMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)
    linkToData: Optional[str] = None
    predictionId: Optional[str] = None
    rawData: Optional[str] = None


class Event(BaseModel):
    model_config = ConfigDict(frozen=True)
    dimensions: list[DimensionWithValue]
    documentText: Optional[str] = Field(default=None)
    eventMetadata: EventMetadata
    id: str
    promptAndResponse: Optional[PromptResponse] = Field(default=None)


class EventMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)
    actualLabel: Optional[str] = None
    actualScore: Optional[float] = None
    predictionId: Optional[str] = None
    predictionLabel: Optional[str] = None
    predictionScore: Optional[float] = None


class Experiment(Node):
    model_config = ConfigDict(frozen=True)
    annotationSummaries: list[ExperimentAnnotationSummary]
    averageRunLatencyMs: Optional[float] = None
    createdAt: str
    description: Optional[str] = None
    errorRate: Optional[float] = None
    id: str = Field(...)
    lastUpdatedAt: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    project: Optional[Project] = None
    projectName: Optional[str] = None
    runCount: int
    runs: ExperimentRunConnection
    sequenceNumber: int = Field(...)
    updatedAt: str


class ExperimentAnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: str
    count: int
    errorCount: int
    maxScore: Optional[float] = None
    meanScore: Optional[float] = None
    minScore: Optional[float] = None


class ExperimentComparison(BaseModel):
    model_config = ConfigDict(frozen=True)
    example: DatasetExample
    runComparisonItems: list[RunComparisonItem]


class ExperimentConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ExperimentEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Experiment = Field(...)


class ExperimentMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    experiments: list[Experiment]


class ExperimentRun(Node):
    model_config = ConfigDict(frozen=True)
    annotations: ExperimentRunAnnotationConnection
    endTime: str
    error: Optional[str] = None
    example: DatasetExample
    experimentId: str
    id: str = Field(...)
    output: Optional[dict[str, Any]] = None
    startTime: str
    trace: Optional[Trace] = None
    traceId: Optional[str] = None


class ExperimentRunAnnotation(Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    endTime: str
    error: Optional[str] = None
    explanation: Optional[str] = None
    id: str = Field(...)
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    startTime: str
    trace: Optional[Trace] = None
    traceId: Optional[str] = None


class ExperimentRunAnnotationConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentRunAnnotationEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ExperimentRunAnnotationEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: ExperimentRunAnnotation = Field(...)


class ExperimentRunConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentRunEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ExperimentRunEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: ExperimentRun = Field(...)


class ExportedFile(BaseModel):
    model_config = ConfigDict(frozen=True)
    fileName: str = Field(...)


class FloatInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[float] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    required: bool


class FreeformAnnotationConfig(Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
    description: Optional[str] = None
    id: str = Field(...)
    name: str


class FunctionCallChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    arguments: str
    datasetExampleId: Optional[str] = None
    name: str


class Functionality(BaseModel):
    model_config = ConfigDict(frozen=True)
    modelInferences: bool = Field(...)
    tracing: bool = Field(...)


class GenerativeModel(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    providerKey: Literal["ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI"]


class GenerativeProvider(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKeyEnvVar: str = Field(...)
    apiKeySet: bool = Field(...)
    dependencies: list[str]
    dependenciesInstalled: bool
    key: Literal["ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI"]
    name: str


class Inferences(BaseModel):
    model_config = ConfigDict(frozen=True)
    endTime: str = Field(...)
    events: list[Event]
    name: str = Field(...)
    recordCount: int = Field(...)
    startTime: str = Field(...)


class IntInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[int] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    required: bool


class IntervalBin(BaseModel):
    model_config = ConfigDict(frozen=True)
    range: NumericRange


class JSONInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[dict[str, Any]] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    required: bool


class LabelFraction(BaseModel):
    model_config = ConfigDict(frozen=True)
    fraction: float
    label: str


class MissingValueBin(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: Optional[str] = None


class Model(BaseModel):
    model_config = ConfigDict(frozen=True)
    corpusInferences: Optional[Inferences] = None
    dimensions: DimensionConnection
    embeddingDimensions: EmbeddingDimensionConnection
    exportedFiles: list[ExportedFile] = Field(...)
    performanceMetric: Optional[float] = None
    performanceTimeSeries: PerformanceTimeSeries = Field(...)
    primaryInferences: Inferences
    referenceInferences: Optional[Inferences] = None


class NominalBin(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str


class NumericRange(BaseModel):
    model_config = ConfigDict(frozen=True)
    end: float
    start: float


class PageInfo(BaseModel):
    model_config = ConfigDict(frozen=True)
    endCursor: Optional[str] = Field(default=None)
    hasNextPage: bool = Field(...)
    hasPreviousPage: bool = Field(...)
    startCursor: Optional[str] = Field(default=None)


class PerformanceTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class Point2D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: float
    y: float


class Point3D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: float
    y: float
    z: float


class Project(Node):
    model_config = ConfigDict(frozen=True)
    annotationConfigs: AnnotationConfigConnection
    documentEvaluationNames: list[str] = Field(...)
    documentEvaluationSummary: Optional[DocumentEvaluationSummary] = None
    endTime: Optional[str] = None
    gradientEndColor: str
    gradientStartColor: str
    id: str = Field(...)
    latencyMsQuantile: Optional[float] = None
    name: str
    recordCount: int
    sessions: ProjectSessionConnection
    spanAnnotationNames: list[str] = Field(...)
    spanAnnotationSummary: Optional[AnnotationSummary] = None
    spanCountTimeSeries: SpanCountTimeSeries = Field(...)
    spanLatencyMsQuantile: Optional[float] = None
    spans: SpanConnection
    startTime: Optional[str] = None
    streamingLastUpdatedAt: Optional[str] = None
    tokenCountCompletion: int
    tokenCountPrompt: int
    tokenCountTotal: int
    trace: Optional[Trace] = None
    traceAnnotationSummary: Optional[AnnotationSummary] = None
    traceAnnotationsNames: list[str] = Field(...)
    traceCount: int
    traceRetentionPolicy: ProjectTraceRetentionPolicy
    validateSpanFilterCondition: ValidationResult


class ProjectConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ProjectEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Project = Field(...)


class ProjectSession(Node):
    model_config = ConfigDict(frozen=True)
    endTime: str
    firstInput: Optional[SpanIOValue] = None
    id: str = Field(...)
    lastOutput: Optional[SpanIOValue] = None
    numTraces: int
    numTracesWithError: int
    projectId: str
    sessionId: str
    startTime: str
    tokenUsage: TokenUsage
    traceLatencyMsQuantile: Optional[float] = None
    traces: TraceConnection


class ProjectSessionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectSessionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ProjectSessionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: ProjectSession = Field(...)


class ProjectTraceRetentionPolicy(Node):
    model_config = ConfigDict(frozen=True)
    cronExpression: str
    id: str = Field(...)
    name: str
    projects: ProjectConnection
    rule: Union[
        "TraceRetentionRuleMaxCount",
        "TraceRetentionRuleMaxDays",
        "TraceRetentionRuleMaxDaysOrCount",
    ]


class ProjectTraceRetentionPolicyConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectTraceRetentionPolicyEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ProjectTraceRetentionPolicyEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: ProjectTraceRetentionPolicy = Field(...)


class ProjectTraceRetentionPolicyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    node: ProjectTraceRetentionPolicy


class Prompt(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str
    description: Optional[str] = None
    id: str = Field(...)
    name: str
    promptVersions: PromptVersionConnection
    sourcePrompt: Optional[Prompt] = None
    sourcePromptId: Optional[str] = None
    version: PromptVersion
    versionTags: list[PromptVersionTag]


class PromptChatTemplate(BaseModel):
    model_config = ConfigDict(frozen=True)
    messages: list[PromptMessage]


class PromptConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class PromptEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Prompt = Field(...)


class PromptLabel(Node):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    id: str = Field(...)
    name: str
    prompts: list[Prompt]


class PromptLabelConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptLabelEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class PromptLabelEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: PromptLabel = Field(...)


class PromptLabelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptLabel: Optional[PromptLabel] = None


class PromptMessage(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: list[Union["TextContentPart", "ToolCallContentPart", "ToolResultContentPart"]]
    role: Literal["AI", "SYSTEM", "TOOL", "USER"]


class PromptResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    prompt: Optional[str] = Field(default=None)
    response: Optional[str] = Field(default=None)


class PromptStringTemplate(BaseModel):
    model_config = ConfigDict(frozen=True)
    template: str


class PromptVersion(Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str
    description: Optional[str] = None
    id: str = Field(...)
    invocationParameters: Optional[dict[str, Any]] = None
    metadata: dict[str, Any]
    modelName: str
    modelProvider: Literal["ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI"]
    previousVersion: Optional[PromptVersion] = None
    responseFormat: Optional[ResponseFormat] = None
    sequenceNumber: int = Field(...)
    tags: list[PromptVersionTag]
    template: Union["PromptChatTemplate", "PromptStringTemplate"]
    templateFormat: Literal["F_STRING", "MUSTACHE", "NONE"]
    templateType: Literal["CHAT", "STRING"]
    tools: list[ToolDefinition]
    user: Optional[User] = None


class PromptVersionConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptVersionEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class PromptVersionEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: PromptVersion = Field(...)


class PromptVersionTag(Node):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    id: str = Field(...)
    name: str
    promptVersionId: str
    user: Optional[User] = None


class PromptVersionTagMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    prompt: Prompt
    promptVersionTag: Optional[PromptVersionTag] = None


class ResponseFormat(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: dict[str, Any]


class Retrieval(BaseModel):
    model_config = ConfigDict(frozen=True)
    documentId: str
    queryId: str
    relevance: Optional[float] = None


class RunComparisonItem(BaseModel):
    model_config = ConfigDict(frozen=True)
    experimentId: str
    runs: list[ExperimentRun]


class Segment(BaseModel):
    model_config = ConfigDict(frozen=True)
    bin: Union["IntervalBin", "MissingValueBin", "NominalBin"]
    counts: DatasetValues


class Segments(BaseModel):
    model_config = ConfigDict(frozen=True)
    segments: list[Segment]
    totalCounts: DatasetValues


class Span(Node):
    model_config = ConfigDict(frozen=True)
    asExampleRevision: SpanAsExampleRevision = Field(...)
    attributes: str = Field(...)
    containedInDataset: bool = Field(...)
    context: SpanContext
    cumulativeTokenCountCompletion: Optional[int] = Field(default=None)
    cumulativeTokenCountPrompt: Optional[int] = Field(default=None)
    cumulativeTokenCountTotal: Optional[int] = Field(default=None)
    descendants: SpanConnection = Field(...)
    documentEvaluations: list[DocumentEvaluation] = Field(...)
    documentRetrievalMetrics: list[DocumentRetrievalMetrics] = Field(...)
    endTime: Optional[str] = None
    events: list[SpanEvent]
    id: str = Field(...)
    input: Optional[SpanIOValue] = None
    invocationParameters: list[
        Union[
            "BooleanInvocationParameter",
            "BoundedFloatInvocationParameter",
            "FloatInvocationParameter",
            "IntInvocationParameter",
            "JSONInvocationParameter",
            "StringInvocationParameter",
            "StringListInvocationParameter",
        ]
    ] = Field(...)
    latencyMs: Optional[float] = None
    metadata: Optional[str] = Field(default=None)
    name: str
    numChildSpans: int
    numDocuments: Optional[int] = None
    output: Optional[SpanIOValue] = None
    parentId: Optional[str] = Field(default=None)
    project: Project = Field(...)
    propagatedStatusCode: Literal["ERROR", "OK", "UNSET"] = Field(...)
    spanAnnotations: list[SpanAnnotation] = Field(...)
    spanId: str
    spanKind: Literal[
        "agent",
        "chain",
        "embedding",
        "evaluator",
        "guardrail",
        "llm",
        "reranker",
        "retriever",
        "tool",
        "unknown",
    ]
    startTime: str
    statusCode: Literal["ERROR", "OK", "UNSET"]
    statusMessage: str
    tokenCountCompletion: Optional[int] = None
    tokenCountPrompt: Optional[int] = None
    tokenCountTotal: Optional[int] = None
    trace: Trace


class SpanAnnotation(Annotation, Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["HUMAN", "LLM"]
    explanation: Optional[str] = Field(default=None)
    id: str = Field(...)
    label: Optional[str] = Field(default=None)
    metadata: dict[str, Any]
    name: str = Field(...)
    score: Optional[float] = Field(default=None)
    spanId: str


class SpanAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    spanAnnotations: list[SpanAnnotation]


class SpanAsExampleRevision(ExampleRevision):
    model_config = ConfigDict(frozen=True)
    input: dict[str, Any]
    metadata: dict[str, Any]
    output: dict[str, Any]


class SpanConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[SpanEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class SpanContext(BaseModel):
    model_config = ConfigDict(frozen=True)
    spanId: str
    traceId: str


class SpanCountTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class SpanEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Span = Field(...)


class SpanEvent(BaseModel):
    model_config = ConfigDict(frozen=True)
    message: str
    name: str
    timestamp: str


class SpanIOValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    mimeType: Literal["json", "text"]
    truncatedValue: str = Field(...)
    value: str


class StringInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[str] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    required: bool


class StringListInvocationParameter(InvocationParameterBase):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    defaultValue: Optional[list[str]] = None
    invocationInputField: Literal[
        "value_bool",
        "value_boolean",
        "value_float",
        "value_int",
        "value_json",
        "value_string",
        "value_string_list",
    ]
    invocationName: str
    label: str
    required: bool


class Subscription(BaseModel):
    model_config = ConfigDict(frozen=True)
    chatCompletion: ChatCompletionSubscriptionPayload
    chatCompletionOverDataset: ChatCompletionSubscriptionPayload


class SystemApiKey(ApiKey, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str = Field(...)
    description: Optional[str] = Field(default=None)
    expiresAt: Optional[str] = Field(default=None)
    id: str = Field(...)
    name: str = Field(...)


class TextChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    content: str
    datasetExampleId: Optional[str] = None


class TextContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: TextContentValue


class TextContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: str


class TimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    timestamp: str
    value: Optional[float] = None


class TokenUsage(BaseModel):
    model_config = ConfigDict(frozen=True)
    completion: int
    prompt: int
    total: int


class ToolCallChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    function: FunctionCallChunk
    id: str


class ToolCallContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolCall: ToolCallContentValue


class ToolCallContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolCall: ToolCallFunction
    toolCallId: str


class ToolCallFunction(BaseModel):
    model_config = ConfigDict(frozen=True)
    arguments: str
    name: str


class ToolDefinition(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: dict[str, Any]


class ToolResultContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolResult: ToolResultContentValue


class ToolResultContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    result: dict[str, Any]
    toolCallId: str


class Trace(Node):
    model_config = ConfigDict(frozen=True)
    endTime: str
    id: str = Field(...)
    latencyMs: Optional[float] = None
    numSpans: int
    project: Project
    projectId: str
    projectSessionId: Optional[str] = None
    rootSpan: Optional[Span] = None
    session: Optional[ProjectSession] = None
    spanAnnotations: list[TraceAnnotation] = Field(...)
    spans: SpanConnection
    startTime: str
    traceId: str


class TraceAnnotation(Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["HUMAN", "LLM"]
    explanation: Optional[str] = None
    id: str = Field(...)
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    traceId: str


class TraceAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    traceAnnotations: list[TraceAnnotation]


class TraceConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[TraceEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class TraceEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Trace = Field(...)


class TraceRetentionRuleMaxCount(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: int


class TraceRetentionRuleMaxDays(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxDays: float


class TraceRetentionRuleMaxDaysOrCount(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: int
    maxDays: float


class UMAPPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    coordinates: Union["Point2D", "Point3D"]
    embeddingMetadata: EmbeddingMetadata
    eventId: str = Field(...)
    eventMetadata: EventMetadata
    id: str


class UMAPPoints(BaseModel):
    model_config = ConfigDict(frozen=True)
    clusters: list[Cluster]
    contextRetrievals: list[Retrieval]
    corpusData: list[UMAPPoint]
    data: list[UMAPPoint]
    referenceData: list[UMAPPoint]


class UpdateCategoricalAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: CategoricalAnnotationConfig


class UpdateContinuousAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: ContinuousAnnotationConfig


class UpdateFreeformAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: FreeformAnnotationConfig


class User(Node):
    model_config = ConfigDict(frozen=True)
    apiKeys: list[UserApiKey]
    authMethod: Literal["LOCAL", "OAUTH2"]
    createdAt: str
    email: str
    id: str = Field(...)
    passwordNeedsReset: bool
    profilePictureUrl: Optional[str] = None
    role: UserRole
    username: str


class UserApiKey(ApiKey, Node):
    model_config = ConfigDict(frozen=True)
    createdAt: str = Field(...)
    description: Optional[str] = Field(default=None)
    expiresAt: Optional[str] = Field(default=None)
    id: str = Field(...)
    name: str = Field(...)
    user: User


class UserConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[UserEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class UserEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: User = Field(...)


class UserMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    user: User


class UserRole(Node):
    model_config = ConfigDict(frozen=True)
    id: str = Field(...)
    name: str


class ValidationResult(BaseModel):
    model_config = ConfigDict(frozen=True)
    errorMessage: Optional[str] = None
    isValid: bool


class AddAnnotationConfigToProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfigId: str
    projectId: str


class AddExamplesToDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: str
    datasetVersionDescription: Optional[str] = None
    datasetVersionMetadata: Optional[dict[str, Any]] = None
    examples: list[DatasetExampleInput]


class AddSpansToDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: str
    datasetVersionDescription: Optional[str] = None
    datasetVersionMetadata: Optional[dict[str, Any]] = None
    spanIds: list[str]


class CategoricalAnnotationValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: str
    score: Optional[float] = None


class ChatCompletionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: Optional[str] = None
    invocationParameters: list[InvocationParameterInput]
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    promptName: Optional[str] = None
    template: Optional[PromptTemplateOptions] = None
    tools: Optional[list[dict[str, Any]]] = None


class ChatCompletionMessageInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: dict[str, Any] = Field(...)
    role: Literal["AI", "SYSTEM", "TOOL", "USER"]
    toolCallId: Optional[str] = Field(default=None)
    toolCalls: Optional[list[dict[str, Any]]] = Field(default=None)


class ChatCompletionOverDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKey: Optional[str] = None
    datasetId: str
    datasetVersionId: Optional[str] = None
    experimentDescription: Optional[str] = None
    experimentMetadata: Optional[dict[str, Any]] = {}
    experimentName: Optional[str] = None
    invocationParameters: list[InvocationParameterInput]
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    promptName: Optional[str] = None
    templateFormat: Literal["F_STRING", "MUSTACHE", "NONE"]
    tools: Optional[list[dict[str, Any]]] = None


class ChatPromptVersionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    invocationParameters: dict[str, Any]
    modelName: str
    modelProvider: Literal["ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI"]
    responseFormat: Optional[ResponseFormatInput] = None
    template: PromptChatTemplateInput
    templateFormat: Literal["F_STRING", "MUSTACHE", "NONE"]
    tools: list[ToolDefinitionInput]


class ClearProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    endTime: Optional[str] = Field(default=None)
    id: str


class ClonePromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str
    promptId: str


class ClusterInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    eventIds: list[str]
    id: Optional[str] = None


class ContentPartInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: Optional[TextContentValueInput] = None
    toolCall: Optional[ToolCallContentValueInput] = None
    toolResult: Optional[ToolResultContentValueInput] = None


class CreateApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    expiresAt: Optional[str] = None
    name: str


class CreateCategoricalAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE"]
    values: list[CategoricalAnnotationValueInput]


class CreateChatPromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str
    promptVersion: ChatPromptVersionInput


class CreateChatPromptVersionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str
    promptVersion: ChatPromptVersionInput
    tags: Optional[list[SetPromptVersionTagInput]] = None


class CreateContinuousAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    lowerBound: Optional[float] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE"]
    upperBound: Optional[float] = None


class CreateDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    name: str


class CreateFreeformAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str


class CreateProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    addProjects: Optional[list[str]] = None
    cronExpression: str
    name: str
    rule: ProjectTraceRetentionRuleInput


class CreatePromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str


class CreateSpanAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["HUMAN", "LLM"]
    explanation: Optional[str] = None
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    spanId: str


class CreateTraceAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["HUMAN", "LLM"]
    explanation: Optional[str] = None
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    traceId: str


class CreateUserApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    expiresAt: Optional[str] = None
    name: str


class CreateUserInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    email: str
    password: str
    role: Literal["ADMIN", "MEMBER"]
    sendWelcomeEmail: Optional[bool] = False
    username: str


class DataQualityMetricInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    columnName: Optional[str] = None
    metric: Literal[
        "cardinality",
        "count",
        "max",
        "mean",
        "min",
        "p01",
        "p25",
        "p50",
        "p75",
        "p99",
        "percentEmpty",
        "sum",
    ]


class DatasetExampleInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    input: dict[str, Any]
    metadata: dict[str, Any]
    output: dict[str, Any]
    spanId: Optional[str] = None


class DatasetExamplePatch(BaseModel):
    model_config = ConfigDict(frozen=True)
    exampleId: str
    input: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None
    output: Optional[dict[str, Any]] = None


class DatasetSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["createdAt", "name"]
    dir: Literal["asc", "desc"]


class DatasetVersionSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["createdAt",]
    dir: Literal["asc", "desc"]


class DeleteAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    configId: str


class DeleteAnnotationsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationIds: list[str]


class DeleteApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str


class DeleteDatasetExamplesInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetVersionDescription: Optional[str] = None
    datasetVersionMetadata: Optional[dict[str, Any]] = None
    exampleIds: list[str]


class DeleteDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: str


class DeleteExperimentsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    experimentIds: list[str]


class DeleteProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str


class DeletePromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str


class DeletePromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptLabelId: str


class DeletePromptVersionTagInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptVersionTagId: str


class DeleteUsersInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    userIds: list[str]


class DimensionFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataTypes: Optional[list[Literal["categorical", "numeric"]]] = None
    shapes: Optional[list[Literal["continuous", "discrete"]]] = None
    types: Optional[list[Literal["actual", "feature", "prediction", "tag"]]] = None


class DimensionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    type: Literal["actual", "feature", "prediction", "tag"]


class EvalResultKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    attr: Literal["label", "score"]
    name: str


class GenerativeModelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiVersion: Optional[str] = None
    baseUrl: Optional[str] = None
    endpoint: Optional[str] = None
    name: str
    providerKey: Literal["ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI"]


class Granularity(BaseModel):
    model_config = ConfigDict(frozen=True)
    evaluationWindowMinutes: int = Field(...)
    samplingIntervalMinutes: int = Field(...)


class InputCoordinate2D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: float
    y: float


class InputCoordinate3D(BaseModel):
    model_config = ConfigDict(frozen=True)
    x: float
    y: float
    z: float


class InvocationParameterInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    canonicalName: Optional[
        Literal[
            "ANTHROPIC_EXTENDED_THINKING",
            "MAX_COMPLETION_TOKENS",
            "RANDOM_SEED",
            "REASONING_EFFORT",
            "RESPONSE_FORMAT",
            "STOP_SEQUENCES",
            "TEMPERATURE",
            "TOOL_CHOICE",
            "TOP_P",
        ]
    ] = None
    invocationName: str
    valueBool: Optional[bool] = None
    valueBoolean: Optional[bool] = None
    valueFloat: Optional[float] = None
    valueInt: Optional[int] = None
    valueJson: Optional[dict[str, Any]] = None
    valueString: Optional[str] = None
    valueStringList: Optional[list[str]] = None


class ModelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    modelName: Optional[str] = None
    providerKey: Optional[Literal["ANTHROPIC", "AZURE_OPENAI", "GOOGLE", "OPENAI"]] = None


class PatchAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationId: str
    annotatorKind: Optional[Literal["HUMAN", "LLM"]] = None
    explanation: Optional[str] = None
    label: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    name: Optional[str] = None
    score: Optional[float] = None


class PatchDatasetExamplesInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    patches: list[DatasetExamplePatch]
    versionDescription: Optional[str] = None
    versionMetadata: Optional[dict[str, Any]] = None


class PatchDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetId: str
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    name: Optional[str] = None


class PatchProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    addProjects: Optional[list[str]] = None
    cronExpression: Optional[str] = None
    id: str
    name: Optional[str] = None
    removeProjects: Optional[list[str]] = None
    rule: Optional[ProjectTraceRetentionRuleInput] = None


class PatchPromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: str
    promptId: str


class PatchPromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: Optional[str] = None
    promptLabelId: str


class PatchUserInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    newPassword: Optional[str] = None
    newRole: Optional[Literal["ADMIN", "MEMBER"]] = None
    newUsername: Optional[str] = None
    userId: str


class PatchViewerInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None
    newUsername: Optional[str] = None


class PerformanceMetricInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    metric: Literal["accuracyScore",]


class ProjectSessionSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["endTime", "numTraces", "startTime", "tokenCountTotal"]
    dir: Literal["asc", "desc"]


class ProjectTraceRetentionRuleInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: Optional[ProjectTraceRetentionRuleMaxCountInput] = None
    maxDays: Optional[ProjectTraceRetentionRuleMaxDaysInput] = None
    maxDaysOrCount: Optional[ProjectTraceRetentionRuleMaxDaysOrCountInput] = None


class ProjectTraceRetentionRuleMaxCountInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: int


class ProjectTraceRetentionRuleMaxDaysInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxDays: float


class ProjectTraceRetentionRuleMaxDaysOrCountInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    maxCount: int
    maxDays: float


class PromptChatTemplateInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    messages: list[PromptMessageInput]


class PromptMessageInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: list[ContentPartInput]
    role: str


class PromptTemplateOptions(BaseModel):
    model_config = ConfigDict(frozen=True)
    format: Literal["F_STRING", "MUSTACHE", "NONE"]
    variables: dict[str, Any]


class ResponseFormatInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: dict[str, Any]


class SetPromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str
    promptLabelId: str


class SetPromptVersionTagInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str
    promptVersionId: str


class SpanAnnotationSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["createdAt", "name"]
    dir: Literal["asc", "desc"]


class SpanSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Optional[
        Literal[
            "cumulativeTokenCountCompletion",
            "cumulativeTokenCountPrompt",
            "cumulativeTokenCountTotal",
            "endTime",
            "latencyMs",
            "startTime",
            "tokenCountCompletion",
            "tokenCountPrompt",
            "tokenCountTotal",
        ]
    ] = None
    dir: Literal["asc", "desc"]
    evalResultKey: Optional[EvalResultKey] = None


class TextContentValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    text: str


class TimeRange(BaseModel):
    model_config = ConfigDict(frozen=True)
    end: Optional[str] = Field(default=None)
    start: Optional[str] = Field(default=None)


class ToolCallContentValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    toolCall: ToolCallFunctionInput
    toolCallId: str


class ToolCallFunctionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    arguments: str
    name: str
    type: Optional[str] = "function"


class ToolDefinitionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: dict[str, Any]


class ToolResultContentValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    result: dict[str, Any]
    toolCallId: str


class TraceAnnotationSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["createdAt", "name"]
    dir: Literal["asc", "desc"]


class UnsetPromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str
    promptLabelId: str


class UpdateCategoricalAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    configId: str
    description: Optional[str] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE"]
    values: list[CategoricalAnnotationValueInput]


class UpdateContinuousAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    configId: str
    description: Optional[str] = None
    lowerBound: Optional[float] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE"]
    upperBound: Optional[float] = None


class UpdateFreeformAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    configId: str
    description: Optional[str] = None
    name: str
