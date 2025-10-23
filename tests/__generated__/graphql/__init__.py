"""Do not edit"""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class Annotation(BaseModel):
    model_config = ConfigDict(frozen=True)
    createdAt: str = Field(...)
    explanation: Optional[str] = Field(default=None)
    label: Optional[str] = Field(default=None)
    name: str = Field(...)
    score: Optional[float] = Field(default=None)
    updatedAt: str = Field(...)


class AnnotationConfigBase(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
    description: Optional[str] = None
    name: str


class ApiKey(BaseModel):
    model_config = ConfigDict(frozen=True)
    createdAt: str = Field(...)
    description: Optional[str] = Field(default=None)
    expiresAt: Optional[str] = Field(default=None)
    name: str = Field(...)


class ChatCompletionSubscriptionPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    repetitionNumber: Optional[int] = None


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


class ModelInterface(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    providerKey: Optional[
        Literal["ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"]
    ] = None


class Node(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str = Field(...)


class TimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class AddAnnotationConfigToProjectPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project


class AddDatasetExamplesToDatasetSplitsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    examples: list[DatasetExample]


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
    name: str
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


class CategoricalAnnotationConfig(AnnotationConfigBase, Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
    description: Optional[str] = None
    id: str = Field(...)
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE", "NONE"]
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
    repetitionNumber: int
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
    repetitionNumber: Optional[int] = None


class ChatCompletionSubscriptionExperiment(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    experiment: Experiment
    repetitionNumber: Optional[int] = None


class ChatCompletionSubscriptionResult(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    experimentRun: Optional[ExperimentRun] = None
    repetitionNumber: Optional[int] = None
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


class ContinuousAnnotationConfig(AnnotationConfigBase, Node):
    model_config = ConfigDict(frozen=True)
    annotationType: Literal["CATEGORICAL", "CONTINUOUS", "FREEFORM"]
    description: Optional[str] = None
    id: str = Field(...)
    lowerBound: Optional[float] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE", "NONE"]
    upperBound: Optional[float] = None


class CostBreakdown(BaseModel):
    model_config = ConfigDict(frozen=True)
    cost: Optional[float] = None
    tokens: Optional[float] = Field(default=None)


class CreateAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: Union[
        "CategoricalAnnotationConfig", "ContinuousAnnotationConfig", "FreeformAnnotationConfig"
    ]


class CreateDatasetLabelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabel: DatasetLabel


class CreateModelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: GenerativeModel


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
    experimentAnnotationSummaries: list[DatasetExperimentAnnotationSummary]
    experimentCount: int = Field(...)
    experiments: ExperimentConnection
    id: str = Field(...)
    labels: list[DatasetLabel]
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
    datasetSplits: list[DatasetSplit]
    experimentRepeatedRunGroups: list[ExperimentRepeatedRunGroup]
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


class DatasetExperimentAnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: str
    maxScore: Optional[float] = None
    minScore: Optional[float] = None


class DatasetLabel(Node):
    model_config = ConfigDict(frozen=True)
    color: str
    description: Optional[str] = None
    id: str = Field(...)
    name: str


class DatasetLabelConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetLabelEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class DatasetLabelEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: DatasetLabel = Field(...)


class DatasetMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataset: Dataset


class DatasetSplit(Node):
    model_config = ConfigDict(frozen=True)
    color: str
    createdAt: str
    description: Optional[str] = None
    id: str = Field(...)
    metadata: dict[str, Any]
    name: str
    updatedAt: str


class DatasetSplitConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[DatasetSplitEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class DatasetSplitEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: DatasetSplit = Field(...)


class DatasetSplitMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplit: DatasetSplit


class DatasetSplitMutationPayloadWithExamples(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplit: DatasetSplit
    examples: list[DatasetExample]


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


class DeleteAnnotationConfigsPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfigs: list[
        Union[
            "CategoricalAnnotationConfig", "ContinuousAnnotationConfig", "FreeformAnnotationConfig"
        ]
    ]


class DeleteApiKeyMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiKeyId: str


class DeleteDatasetLabelsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabels: list[DatasetLabel]


class DeleteDatasetSplitsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplits: list[DatasetSplit]


class DeleteModelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: GenerativeModel


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


class DocumentAnnotation(Annotation, Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    createdAt: str = Field(...)
    documentPosition: int
    explanation: Optional[str] = Field(default=None)
    id: str = Field(...)
    identifier: str
    label: Optional[str] = Field(default=None)
    metadata: dict[str, Any]
    name: str = Field(...)
    score: Optional[float] = Field(default=None)
    source: Literal["API", "APP"]
    span: Span
    updatedAt: str = Field(...)
    user: Optional[User] = None


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
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    createdAt: str
    datasetVersionId: str
    description: Optional[str] = None
    errorRate: Optional[float] = None
    id: str = Field(...)
    lastUpdatedAt: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    project: Optional[Project] = None
    projectName: Optional[str] = None
    repetitions: int
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


class ExperimentComparison(Node):
    model_config = ConfigDict(frozen=True)
    example: DatasetExample
    id: str = Field(...)
    repeatedRunGroups: list[ExperimentRepeatedRunGroup]


class ExperimentComparisonConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ExperimentComparisonEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ExperimentComparisonEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: ExperimentComparison = Field(...)


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


class ExperimentRepeatedRunGroup(Node):
    model_config = ConfigDict(frozen=True)
    annotationSummaries: list[ExperimentRepeatedRunGroupAnnotationSummary]
    averageLatencyMs: Optional[float] = None
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    experimentId: str
    id: str = Field(...)
    runs: list[ExperimentRun]


class ExperimentRepeatedRunGroupAnnotationSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationName: str
    meanScore: Optional[float] = None


class ExperimentRun(Node):
    model_config = ConfigDict(frozen=True)
    annotations: ExperimentRunAnnotationConnection
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    endTime: str
    error: Optional[str] = None
    example: DatasetExample
    experimentId: str
    id: str = Field(...)
    latencyMs: float
    output: Optional[dict[str, Any]] = None
    repetitionNumber: int
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


class ExperimentRunMetricComparison(BaseModel):
    model_config = ConfigDict(frozen=True)
    numRunsEqual: int = Field(...)
    numRunsImproved: int = Field(...)
    numRunsRegressed: int = Field(...)
    numRunsWithoutComparison: int = Field(...)


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


class FreeformAnnotationConfig(AnnotationConfigBase, Node):
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
    repetitionNumber: Optional[int] = None


class Functionality(BaseModel):
    model_config = ConfigDict(frozen=True)
    modelInferences: bool = Field(...)


class GenerativeModel(ModelInterface, Node):
    model_config = ConfigDict(frozen=True)
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    createdAt: str
    id: str = Field(...)
    kind: Literal["BUILT_IN", "CUSTOM"]
    lastUsedAt: Optional[str] = None
    name: str
    namePattern: str
    provider: Optional[str] = None
    providerKey: Optional[
        Literal["ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"]
    ] = None
    startTime: Optional[str] = None
    tokenPrices: list[TokenPrice]
    updatedAt: str


class GenerativeProvider(BaseModel):
    model_config = ConfigDict(frozen=True)
    credentialRequirements: list[GenerativeProviderCredentialConfig] = Field(...)
    credentialsSet: bool = Field(...)
    dependencies: list[str]
    dependenciesInstalled: bool
    key: Literal[
        "ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"
    ]
    name: str


class GenerativeProviderCredentialConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    envVarName: str
    isRequired: bool


class InferenceModel(BaseModel):
    model_config = ConfigDict(frozen=True)
    corpusInferences: Optional[Inferences] = None
    dimensions: DimensionConnection
    embeddingDimensions: EmbeddingDimensionConnection
    exportedFiles: list[ExportedFile] = Field(...)
    performanceMetric: Optional[float] = None
    performanceTimeSeries: PerformanceTimeSeries = Field(...)
    primaryInferences: Inferences
    referenceInferences: Optional[Inferences] = None


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


class PlaygroundModel(ModelInterface):
    model_config = ConfigDict(frozen=True)
    name: str
    providerKey: Literal[
        "ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"
    ]


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
    costSummary: SpanCostSummary
    createdAt: str
    documentEvaluationNames: list[str] = Field(...)
    documentEvaluationSummary: Optional[DocumentEvaluationSummary] = None
    endTime: Optional[str] = None
    gradientEndColor: str
    gradientStartColor: str
    id: str = Field(...)
    latencyMsQuantile: Optional[float] = None
    name: str
    recordCount: int
    sessionAnnotationNames: list[str] = Field(...)
    sessions: ProjectSessionConnection
    spanAnnotationNames: list[str] = Field(...)
    spanAnnotationScoreTimeSeries: SpanAnnotationScoreTimeSeries
    spanAnnotationSummary: Optional[AnnotationSummary] = None
    spanCountTimeSeries: SpanCountTimeSeries
    spanLatencyMsQuantile: Optional[float] = None
    spans: SpanConnection
    startTime: Optional[str] = None
    streamingLastUpdatedAt: Optional[str] = None
    tokenCountCompletion: float
    tokenCountPrompt: float
    tokenCountTotal: float
    topModelsByCost: list[GenerativeModel]
    topModelsByTokenCount: list[GenerativeModel]
    trace: Optional[Trace] = None
    traceAnnotationSummary: Optional[AnnotationSummary] = None
    traceAnnotationsNames: list[str] = Field(...)
    traceCount: int
    traceCountByStatusTimeSeries: TraceCountByStatusTimeSeries
    traceCountTimeSeries: TraceCountTimeSeries
    traceLatencyMsPercentileTimeSeries: TraceLatencyPercentileTimeSeries
    traceRetentionPolicy: ProjectTraceRetentionPolicy
    traceTokenCostTimeSeries: TraceTokenCostTimeSeries
    traceTokenCountTimeSeries: TraceTokenCountTimeSeries
    updatedAt: str
    validateSpanFilterCondition: ValidationResult


class ProjectConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[ProjectEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class ProjectEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Project = Field(...)


class ProjectMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project


class ProjectSession(Node):
    model_config = ConfigDict(frozen=True)
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    endTime: str
    firstInput: Optional[SpanIOValue] = None
    id: str = Field(...)
    lastOutput: Optional[SpanIOValue] = None
    numTraces: int
    numTracesWithError: int
    project: Project
    sessionAnnotationSummaries: list[AnnotationSummary] = Field(...)
    sessionAnnotations: list[ProjectSessionAnnotation]
    sessionId: str
    startTime: str
    tokenUsage: TokenUsage
    traceLatencyMsQuantile: Optional[float] = None
    traces: TraceConnection


class ProjectSessionAnnotation(Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    explanation: Optional[str] = None
    id: str = Field(...)
    identifier: str
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    projectSessionId: str
    score: Optional[float] = None
    source: Literal["API", "APP"]
    user: Optional[User] = None


class ProjectSessionAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    projectSessionAnnotation: ProjectSessionAnnotation


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
    labels: list[PromptLabel]
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
    color: str
    description: Optional[str] = None
    id: str = Field(...)
    name: str


class PromptLabelAssociationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)


class PromptLabelConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[PromptLabelEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class PromptLabelDeleteMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    deletedPromptLabelIds: list[str]


class PromptLabelEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: PromptLabel = Field(...)


class PromptLabelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptLabels: list[PromptLabel]


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
    modelProvider: Literal[
        "ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"
    ]
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


class RemoveAnnotationConfigFromProjectPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    project: Project


class RemoveDatasetExamplesFromDatasetSplitsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    examples: list[DatasetExample]


class ResponseFormat(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: dict[str, Any]


class Retrieval(BaseModel):
    model_config = ConfigDict(frozen=True)
    documentId: str
    queryId: str
    relevance: Optional[float] = None


class Segment(BaseModel):
    model_config = ConfigDict(frozen=True)
    bin: Union["IntervalBin", "MissingValueBin", "NominalBin"]
    counts: DatasetValues


class Segments(BaseModel):
    model_config = ConfigDict(frozen=True)
    segments: list[Segment]
    totalCounts: DatasetValues


class ServerStatus(BaseModel):
    model_config = ConfigDict(frozen=True)
    insufficientStorage: bool


class SetDatasetLabelsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)


class Span(Node):
    model_config = ConfigDict(frozen=True)
    asExampleRevision: SpanAsExampleRevision = Field(...)
    attributes: str = Field(...)
    containedInDataset: bool = Field(...)
    context: SpanContext
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: Optional[SpanCostSummary] = None
    cumulativeTokenCountCompletion: Optional[int] = Field(default=None)
    cumulativeTokenCountPrompt: Optional[int] = Field(default=None)
    cumulativeTokenCountTotal: Optional[int] = Field(default=None)
    descendants: SpanConnection = Field(...)
    documentEvaluations: list[DocumentAnnotation] = Field(...)
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
    spanAnnotationSummaries: list[AnnotationSummary] = Field(...)
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
    spanNotes: list[SpanAnnotation] = Field(...)
    startTime: str
    statusCode: Literal["ERROR", "OK", "UNSET"]
    statusMessage: str
    tokenCountCompletion: Optional[int] = None
    tokenCountPrompt: Optional[int] = None
    tokenCountTotal: Optional[int] = None
    tokenPromptDetails: TokenCountPromptDetails
    trace: Trace


class SpanAnnotation(Annotation, Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    createdAt: str = Field(...)
    explanation: Optional[str] = Field(default=None)
    id: str = Field(...)
    identifier: str
    label: Optional[str] = Field(default=None)
    metadata: dict[str, Any]
    name: str = Field(...)
    score: Optional[float] = Field(default=None)
    source: Literal["API", "APP"]
    spanId: str
    updatedAt: str = Field(...)
    user: Optional[User] = None


class SpanAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    spanAnnotations: list[SpanAnnotation]


class SpanAnnotationScoreTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[SpanAnnotationScoreTimeSeriesDataPoint]
    names: list[str]


class SpanAnnotationScoreTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    scoresWithLabels: list[SpanAnnotationScoreWithLabel]
    timestamp: str


class SpanAnnotationScoreWithLabel(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: str
    score: float


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


class SpanCostDetailSummaryEntry(BaseModel):
    model_config = ConfigDict(frozen=True)
    isPrompt: bool
    tokenType: str
    value: CostBreakdown


class SpanCostSummary(BaseModel):
    model_config = ConfigDict(frozen=True)
    completion: CostBreakdown
    prompt: CostBreakdown
    total: CostBreakdown


class SpanCountTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[SpanCountTimeSeriesDataPoint]


class SpanCountTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    errorCount: Optional[int] = None
    okCount: Optional[int] = None
    timestamp: str
    totalCount: Optional[int] = None
    unsetCount: Optional[int] = None


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
    repetitionNumber: Optional[int] = None


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


class TokenCountPromptDetails(BaseModel):
    model_config = ConfigDict(frozen=True)
    audio: Optional[int] = None
    cacheRead: Optional[int] = None
    cacheWrite: Optional[int] = None


class TokenPrice(BaseModel):
    model_config = ConfigDict(frozen=True)
    costPerMillionTokens: float
    costPerToken: float
    kind: Literal["COMPLETION", "PROMPT"]
    tokenType: str


class TokenUsage(BaseModel):
    model_config = ConfigDict(frozen=True)
    completion: float
    prompt: float
    total: float


class ToolCallChunk(ChatCompletionSubscriptionPayload):
    model_config = ConfigDict(frozen=True)
    datasetExampleId: Optional[str] = None
    function: FunctionCallChunk
    id: str
    repetitionNumber: Optional[int] = None


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
    costDetailSummaryEntries: list[SpanCostDetailSummaryEntry]
    costSummary: SpanCostSummary
    endTime: str
    id: str = Field(...)
    latencyMs: Optional[float] = None
    numSpans: int
    project: Project
    projectId: str
    projectSessionId: Optional[str] = None
    rootSpan: Optional[Span] = None
    session: Optional[ProjectSession] = None
    spans: SpanConnection
    startTime: str
    traceAnnotationSummaries: list[AnnotationSummary] = Field(...)
    traceAnnotations: list[TraceAnnotation] = Field(...)
    traceId: str


class TraceAnnotation(Node):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    explanation: Optional[str] = None
    id: str = Field(...)
    identifier: str
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    source: Literal["API", "APP"]
    trace: Trace
    user: Optional[User] = None


class TraceAnnotationMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    traceAnnotations: list[TraceAnnotation]


class TraceConnection(BaseModel):
    model_config = ConfigDict(frozen=True)
    edges: list[TraceEdge] = Field(...)
    pageInfo: PageInfo = Field(...)


class TraceCountByStatusTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceCountByStatusTimeSeriesDataPoint]


class TraceCountByStatusTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    errorCount: int
    okCount: int
    timestamp: str
    totalCount: int


class TraceCountTimeSeries(TimeSeries):
    model_config = ConfigDict(frozen=True)
    data: list[TimeSeriesDataPoint]


class TraceEdge(BaseModel):
    model_config = ConfigDict(frozen=True)
    cursor: str = Field(...)
    node: Trace = Field(...)


class TraceLatencyMsPercentileTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    max: Optional[float] = None
    p50: Optional[float] = None
    p75: Optional[float] = None
    p90: Optional[float] = None
    p95: Optional[float] = None
    p99: Optional[float] = None
    p999: Optional[float] = None
    timestamp: str


class TraceLatencyPercentileTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceLatencyMsPercentileTimeSeriesDataPoint]


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


class TraceTokenCostTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceTokenCostTimeSeriesDataPoint]


class TraceTokenCostTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    completionCost: Optional[float] = None
    promptCost: Optional[float] = None
    timestamp: str
    totalCost: Optional[float] = None


class TraceTokenCountTimeSeries(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: list[TraceTokenCountTimeSeriesDataPoint]


class TraceTokenCountTimeSeriesDataPoint(BaseModel):
    model_config = ConfigDict(frozen=True)
    completionTokenCount: Optional[float] = None
    promptTokenCount: Optional[float] = None
    timestamp: str
    totalTokenCount: Optional[float] = None


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


class UnsetDatasetLabelsMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)


class UpdateAnnotationConfigPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: Union[
        "CategoricalAnnotationConfig", "ContinuousAnnotationConfig", "FreeformAnnotationConfig"
    ]


class UpdateDatasetLabelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabel: DatasetLabel


class UpdateModelMutationPayload(BaseModel):
    model_config = ConfigDict(frozen=True)
    model: GenerativeModel


class User(Node):
    model_config = ConfigDict(frozen=True)
    apiKeys: list[UserApiKey]
    authMethod: Literal["LOCAL", "OAUTH2"]
    createdAt: str
    email: str
    id: str = Field(...)
    isManagementUser: bool
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


class AddDatasetExamplesToDatasetSplitsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplitIds: list[str]
    exampleIds: list[str]


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


class AnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    categorical: Optional[CategoricalAnnotationConfigInput] = None
    continuous: Optional[ContinuousAnnotationConfigInput] = None
    freeform: Optional[FreeformAnnotationConfigInput] = None


class AnnotationFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    exclude: Optional[AnnotationFilterCondition] = None
    include: Optional[AnnotationFilterCondition] = None


class AnnotationFilterCondition(BaseModel):
    model_config = ConfigDict(frozen=True)
    names: Optional[list[str]] = None
    sources: Optional[list[Literal["API", "APP"]]] = None
    userIds: Optional[list[Optional[str]]] = None


class CategoricalAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE", "NONE"]
    values: list[CategoricalAnnotationConfigValueInput]


class CategoricalAnnotationConfigValueInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    label: str
    score: Optional[float] = None


class ChatCompletionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    credentials: Optional[list[GenerativeCredentialInput]] = None
    invocationParameters: list[InvocationParameterInput]
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    promptName: Optional[str] = None
    repetitions: int
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
    credentials: Optional[list[GenerativeCredentialInput]] = None
    datasetId: str
    datasetVersionId: Optional[str] = None
    experimentDescription: Optional[str] = None
    experimentMetadata: Optional[dict[str, Any]] = {}
    experimentName: Optional[str] = None
    invocationParameters: list[InvocationParameterInput]
    messages: list[ChatCompletionMessageInput]
    model: GenerativeModelInput
    promptName: Optional[str] = None
    repetitions: int
    templateFormat: Literal["F_STRING", "MUSTACHE", "NONE"]
    tools: Optional[list[dict[str, Any]]] = None


class ChatPromptVersionInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    invocationParameters: dict[str, Any]
    modelName: str
    modelProvider: Literal[
        "ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"
    ]
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


class ContinuousAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    lowerBound: Optional[float] = None
    name: str
    optimizationDirection: Literal["MAXIMIZE", "MINIMIZE", "NONE"]
    upperBound: Optional[float] = None


class CreateAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: AnnotationConfigInput


class CreateApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    expiresAt: Optional[str] = None
    name: str


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


class CreateDatasetInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    name: str


class CreateDatasetLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: str
    description: Optional[str] = None
    name: str


class CreateDatasetSplitInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: str
    description: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    name: str


class CreateDatasetSplitWithExamplesInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: str
    description: Optional[str] = None
    exampleIds: list[str]
    metadata: Optional[dict[str, Any]] = None
    name: str


class CreateModelMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    costs: list[TokenPriceInput]
    name: str
    namePattern: str
    provider: Optional[str] = None
    startTime: Optional[str] = None


class CreateProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    gradientEndColor: Optional[str] = None
    gradientStartColor: Optional[str] = None
    name: str


class CreateProjectSessionAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    explanation: Optional[str] = None
    identifier: Optional[str] = None
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    projectSessionId: str
    score: Optional[float] = None
    source: Literal["API", "APP"]


class CreateProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    addProjects: Optional[list[str]] = None
    cronExpression: str
    name: str
    rule: ProjectTraceRetentionRuleInput


class CreatePromptLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: str
    description: Optional[str] = None
    name: str


class CreateSpanAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    explanation: Optional[str] = None
    identifier: Optional[str] = None
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    source: Literal["API", "APP"]
    spanId: str


class CreateSpanNoteInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    note: str
    spanId: str


class CreateTraceAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    explanation: Optional[str] = None
    identifier: Optional[str] = None
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    source: Literal["API", "APP"]
    traceId: str


class CreateUserApiKeyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    expiresAt: Optional[str] = None
    name: str


class CreateUserInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    authMethod: Optional[Literal["LOCAL", "OAUTH2"]] = "LOCAL"
    email: str
    password: Optional[str] = None
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


class DatasetFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["name",]
    value: str


class DatasetSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["createdAt", "name"]
    dir: Literal["asc", "desc"]


class DatasetVersionSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["createdAt",]
    dir: Literal["asc", "desc"]


class DeleteAnnotationConfigsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    ids: list[str]


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


class DeleteDatasetLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetLabelIds: list[str]


class DeleteDatasetSplitInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplitIds: list[str]


class DeleteExperimentsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    experimentIds: list[str]


class DeleteModelMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str


class DeleteProjectTraceRetentionPolicyInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str


class DeletePromptInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str


class DeletePromptLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptLabelIds: list[str]


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


class FreeformAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    description: Optional[str] = None
    name: str


class GenerativeCredentialInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    envVarName: str
    value: str


class GenerativeModelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    apiVersion: Optional[str] = None
    baseUrl: Optional[str] = None
    customHeaders: Optional[dict[str, Any]] = None
    endpoint: Optional[str] = None
    name: str
    providerKey: Literal[
        "ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"
    ]
    region: Optional[str] = None


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
    providerKey: Optional[
        Literal["ANTHROPIC", "AWS", "AZURE_OPENAI", "DEEPSEEK", "GOOGLE", "OLLAMA", "OPENAI", "XAI"]
    ] = None


class PatchAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationId: str
    annotatorKind: Optional[Literal["CODE", "HUMAN", "LLM"]] = None
    explanation: Optional[str] = None
    identifier: Optional[str] = None
    label: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    name: Optional[str] = None
    score: Optional[float] = None
    source: Optional[Literal["API", "APP"]] = None


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


class PatchDatasetSplitInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: Optional[str] = None
    datasetSplitId: str
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


class ProjectFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["name",]
    value: str


class ProjectSessionSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["costTotal", "endTime", "numTraces", "startTime", "tokenCountTotal"]
    dir: Literal["asc", "desc"]


class ProjectSort(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["endTime", "name"]
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


class PromptFilter(BaseModel):
    model_config = ConfigDict(frozen=True)
    col: Literal["name",]
    value: str


class PromptMessageInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: list[ContentPartInput]
    role: str


class PromptTemplateOptions(BaseModel):
    model_config = ConfigDict(frozen=True)
    format: Literal["F_STRING", "MUSTACHE", "NONE"]
    variables: dict[str, Any]


class RemoveAnnotationConfigFromProjectInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfigId: str
    projectId: str


class RemoveDatasetExamplesFromDatasetSplitsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetSplitIds: list[str]
    exampleIds: list[str]


class ResponseFormatInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    definition: dict[str, Any]


class SetDatasetLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetIds: list[str]
    datasetLabelIds: list[str]


class SetPromptLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str
    promptLabelIds: list[str]


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
            "cumulativeTokenCostTotal",
            "cumulativeTokenCountCompletion",
            "cumulativeTokenCountPrompt",
            "cumulativeTokenCountTotal",
            "endTime",
            "latencyMs",
            "startTime",
            "tokenCostTotal",
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


class TimeBinConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    scale: Literal["DAY", "HOUR", "MINUTE", "MONTH", "WEEK", "YEAR"] = Field(...)
    utcOffsetMinutes: int = Field(...)


class TimeRange(BaseModel):
    model_config = ConfigDict(frozen=True)
    end: Optional[str] = Field(default=None)
    start: Optional[str] = Field(default=None)


class TokenPriceInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    costPerMillionTokens: float
    kind: Literal["COMPLETION", "PROMPT"]
    tokenType: str


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


class UnsetDatasetLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    datasetIds: list[str]
    datasetLabelIds: list[str]


class UnsetPromptLabelsInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    promptId: str
    promptLabelIds: list[str]


class UpdateAnnotationConfigInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotationConfig: AnnotationConfigInput
    id: str


class UpdateAnnotationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    annotatorKind: Literal["CODE", "HUMAN", "LLM"]
    explanation: Optional[str] = None
    id: str
    label: Optional[str] = None
    metadata: dict[str, Any]
    name: str
    score: Optional[float] = None
    source: Literal["API", "APP"]


class UpdateDatasetLabelInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    color: str
    datasetLabelId: str
    description: Optional[str] = None
    name: str


class UpdateModelMutationInput(BaseModel):
    model_config = ConfigDict(frozen=True)
    costs: list[TokenPriceInput]
    id: str
    name: str
    namePattern: str
    provider: Optional[str] = None
    startTime: Optional[str] = None
