from datetime import datetime
from typing import Any, Optional

from pydantic import Field

from .base_model import BaseModel
from .enums import (
    AnnotationSource,
    AnnotationTimeRangeField,
    AnnotatorKind,
    AnthropicOutputConfigEffort,
    AnthropicThinkingDisplay,
    AuthMethod,
    DatasetColumn,
    DatasetEvaluatorColumn,
    DatasetEvaluatorFilterColumn,
    DatasetExampleField,
    DatasetFilterColumn,
    DatasetVersionColumn,
    DecisionFilterColumn,
    DecisionTemplateFormat,
    EvalAttr,
    EvaluationTarget,
    EvaluatorColumn,
    EvaluatorFilterColumn,
    ExperimentColumn,
    ExperimentRunMetric,
    GenerativeProviderKey,
    GoogleThinkingLevel,
    InternetAccessChoice,
    Language,
    ModelProvider,
    ModelType,
    OpenAIApiType,
    OpenAIReasoningEffort,
    OptimizationDirection,
    ProjectColumn,
    ProjectEvaluatorFilterColumn,
    ProjectFilterColumn,
    ProjectSessionAnnoAttr,
    ProjectSessionColumn,
    PromptFilterColumn,
    PromptMessageRole,
    PromptTemplateFormat,
    SortDir,
    SpanAnnotationColumn,
    SpanColumn,
    TimeBinScale,
    TokenKind,
    TraceAnnotationColumn,
    UserRoleInput,
)


class AWSBedrockAccessKeysInput(BaseModel):
    aws_access_key_id: str = Field(alias="awsAccessKeyId")
    aws_secret_access_key: Any = Field(alias="awsSecretAccessKey")
    aws_session_token: Optional[Any] = Field(alias="awsSessionToken", default=None)


class AWSBedrockAuthenticationMethodInput(BaseModel):
    access_keys: Optional["AWSBedrockAccessKeysInput"] = Field(
        alias="accessKeys", default=None
    )
    "Explicit AWS access key credentials."
    default_credentials: Optional[bool] = Field(
        alias="defaultCredentials", default=None
    )
    "Use SDK default credentials (IAM role, env vars, config files)."


class AWSBedrockClientKwargsInput(BaseModel):
    region_name: str = Field(alias="regionName")
    endpoint_url: Optional[str] = Field(alias="endpointUrl", default=None)


class AWSBedrockCustomProviderConfigInput(BaseModel):
    aws_bedrock_authentication_method: "AWSBedrockAuthenticationMethodInput" = Field(
        alias="awsBedrockAuthenticationMethod"
    )
    aws_bedrock_client_kwargs: "AWSBedrockClientKwargsInput" = Field(
        alias="awsBedrockClientKwargs"
    )


class AddAnnotationConfigToProjectInput(BaseModel):
    project_id: str = Field(alias="projectId")
    annotation_config_id: str = Field(alias="annotationConfigId")


class AddDatasetExampleOperation(BaseModel):
    """Adds an example with the given value. Added examples are not linked to a span; use `addExamplesToDataset` for span-sourced examples."""

    value: "DatasetExampleValueInput"


class AddExamplesToDatasetInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    examples: list["DatasetExampleInput"]
    dataset_version_description: Optional[str] = Field(
        alias="datasetVersionDescription", default=None
    )
    dataset_version_metadata: Optional[Any] = Field(
        alias="datasetVersionMetadata", default=None
    )


class AddProjectCodeEvaluatorInput(BaseModel):
    project_id: str = Field(alias="projectId")
    evaluator_id: str = Field(alias="evaluatorId")
    name: str
    sampling_rate: float = Field(alias="samplingRate")
    evaluation_target: EvaluationTarget = Field(alias="evaluationTarget")
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    "Project-specific CODE input mapping. Null inherits the evaluator input mapping; an object overrides it."
    filter_condition: str = Field(alias="filterCondition", default="")
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = Field(
        alias="evaluationDelaySeconds", default=None
    )
    "Seconds a trace or session must stay quiet before evaluation is scheduled; the minimum is 10 seconds. The delay applies to TRACE and SESSION targets and is rejected for SPAN. Omit or use null to store the default: 300 seconds for TRACE and SESSION, and 0 for SPAN, which evaluates spans as they arrive. A trace or session is evaluated only once, and later activity does not schedule another evaluation."


class AddSpansToDatasetInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    span_ids: list[str] = Field(alias="spanIds")
    dataset_version_description: Optional[str] = Field(
        alias="datasetVersionDescription", default=None
    )
    dataset_version_metadata: Optional[Any] = Field(
        alias="datasetVersionMetadata", default=None
    )


class AgentBuiltinProviderModelSelectionInput(BaseModel):
    provider: ModelProvider
    model_name: str = Field(alias="modelName")


class AgentCustomProviderModelSelectionInput(BaseModel):
    provider_id: str = Field(alias="providerId")
    model_name: str = Field(alias="modelName")


class AgentModelSelectionInput(BaseModel):
    custom: Optional["AgentCustomProviderModelSelectionInput"] = None
    builtin: Optional["AgentBuiltinProviderModelSelectionInput"] = None


class AnnotationConfigInput(BaseModel):
    categorical: Optional["CategoricalAnnotationConfigInput"] = None
    continuous: Optional["ContinuousAnnotationConfigInput"] = None
    freeform: Optional["FreeformAnnotationConfigInput"] = None


class AnnotationFilter(BaseModel):
    include: Optional["AnnotationFilterCondition"] = None
    exclude: Optional["AnnotationFilterCondition"] = None


class AnnotationFilterCondition(BaseModel):
    names: Optional[list[str]] = None
    sources: Optional[list[AnnotationSource]] = None
    user_ids: Optional[list[Optional[str]]] = Field(alias="userIds", default=None)


class AnthropicAuthenticationMethodInput(BaseModel):
    api_key: Any = Field(alias="apiKey")


class AnthropicClientKwargsInput(BaseModel):
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    default_headers: Optional[Any] = Field(alias="defaultHeaders", default=None)


class AnthropicCustomProviderConfigInput(BaseModel):
    anthropic_authentication_method: "AnthropicAuthenticationMethodInput" = Field(
        alias="anthropicAuthenticationMethod"
    )
    anthropic_client_kwargs: Optional["AnthropicClientKwargsInput"] = Field(
        alias="anthropicClientKwargs", default=None
    )


class AnthropicThinkingAdaptiveInput(BaseModel):
    display: Optional[AnthropicThinkingDisplay] = None


class AnthropicThinkingDisabledMarkerInput(BaseModel):
    disabled: bool = True


class AnthropicThinkingEnabledInput(BaseModel):
    budget_tokens: int = Field(alias="budgetTokens")
    display: Optional[AnthropicThinkingDisplay] = None


class AzureOpenAIADTokenProviderInput(BaseModel):
    azure_tenant_id: str = Field(alias="azureTenantId")
    azure_client_id: str = Field(alias="azureClientId")
    azure_client_secret: Any = Field(alias="azureClientSecret")
    scope: Optional[str] = None


class AzureOpenAIAuthenticationMethodInput(BaseModel):
    api_key: Optional[Any] = Field(alias="apiKey", default=None)
    azure_ad_token_provider: Optional["AzureOpenAIADTokenProviderInput"] = Field(
        alias="azureAdTokenProvider", default=None
    )
    default_credentials: Optional[bool] = Field(
        alias="defaultCredentials", default=None
    )
    "Use SDK default credentials (Managed Identity, Azure CLI, env vars)."


class AzureOpenAIClientKwargsInput(BaseModel):
    azure_endpoint: str = Field(alias="azureEndpoint")
    default_headers: Optional[Any] = Field(alias="defaultHeaders", default=None)


class AzureOpenAICustomProviderConfigInput(BaseModel):
    azure_openai_authentication_method: "AzureOpenAIAuthenticationMethodInput" = Field(
        alias="azureOpenaiAuthenticationMethod"
    )
    azure_openai_client_kwargs: "AzureOpenAIClientKwargsInput" = Field(
        alias="azureOpenaiClientKwargs"
    )
    openai_api_type: Optional[OpenAIApiType] = Field(
        alias="openaiApiType", default=OpenAIApiType.RESPONSES
    )


class BranchAgentSessionInput(BaseModel):
    id: str
    message_id: str = Field(alias="messageId")
    "The transcript message (UIMessage id) to branch at. A user message is excluded from the branch along with everything after it; an assistant message is included and everything after it is excluded."


class BuiltInDecisionConnectionInput(BaseModel):
    """A built-in provider, reached with its own or given credentials."""

    provider_key: GenerativeProviderKey = Field(alias="providerKey")
    "The provider whose decision API runs the request; it must offer decision models."
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    "Send the request to this endpoint instead of the provider default. Requires an API key in `credentials` or a stored secret; the server-configured key is never sent to a custom URL."
    credentials: Optional[list["GenerativeCredentialInput"]] = None
    "API keys for this request only, by environment variable name. When omitted, a stored secret is used, then the server environment."


class CategoricalAnnotationConfigInput(BaseModel):
    name: str
    description: Optional[str] = None
    optimization_direction: OptimizationDirection = Field(alias="optimizationDirection")
    values: list["CategoricalAnnotationConfigValueInput"]


class CategoricalAnnotationConfigValueInput(BaseModel):
    label: str
    score: Optional[float] = None


class ChatCompletionInput(BaseModel):
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    connection_config: Optional["ConnectionConfigInput"] = Field(
        alias="connectionConfig", default=None
    )
    headers: Optional[Any] = None
    credentials: Optional[list["GenerativeCredentialInput"]] = None
    template: Optional["PromptTemplateOptions"] = None
    prompt_name: Optional[str] = Field(alias="promptName", default=None)
    repetitions: int
    evaluators: list["PlaygroundEvaluatorInput"] = Field(default_factory=lambda: [])
    stream_model_output: bool = Field(alias="streamModelOutput", default=True)


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


class ChoiceOptionInput(BaseModel):
    value: str
    description: Optional[str] = None


class ChoiceQuestionInput(BaseModel):
    """One option from a fixed set of 2–255."""

    name: str
    "The name the answer is returned under."
    instructions: str
    choices: list["ChoiceOptionInput"]


class ClearProjectInput(BaseModel):
    id: str
    end_time: Optional[datetime] = Field(alias="endTime", default=None)
    "The time up to which to purge data. Time is right-open /non-inclusive."


class ClearQueuedEvaluationsInput(BaseModel):
    project_id: str = Field(alias="projectId")


class CloneDecisionInput(BaseModel):
    decision_id: str = Field(alias="decisionId")
    name: str
    description: Optional[str] = None
    metadata: Optional[Any] = None


class ClonePromptInput(BaseModel):
    name: str
    prompt_id: str = Field(alias="promptId")
    description: Optional[str] = None
    metadata: Optional[Any] = None


class ConnectionConfigInput(BaseModel):
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    azure_endpoint: Optional[str] = Field(alias="azureEndpoint", default=None)
    region_name: Optional[str] = Field(alias="regionName", default=None)
    endpoint_url: Optional[str] = Field(alias="endpointUrl", default=None)
    openai_api_type: Optional[OpenAIApiType] = Field(
        alias="openaiApiType", default=None
    )
    organization: Optional[str] = None
    project: Optional[str] = None


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


class CreateAgentSessionInput(BaseModel):
    model: "AgentModelSelectionInput"
    title: str = ""
    "Optional initial title."
    is_ephemeral: bool = Field(alias="isEphemeral", default=False)
    "Whether the session should expire after a period of inactivity."


class CreateAnnotationConfigInput(BaseModel):
    annotation_config: "AnnotationConfigInput" = Field(alias="annotationConfig")


class CreateApiKeyInput(BaseModel):
    name: str
    description: Optional[str] = None
    expires_at: Optional[datetime] = Field(alias="expiresAt", default=None)


class CreateChatPromptInput(BaseModel):
    name: str
    description: Optional[str] = None
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    metadata: Optional[Any] = None
    tags: Optional[list["CreatePromptVersionTagInput"]] = None


class CreateChatPromptVersionInput(BaseModel):
    prompt_id: str = Field(alias="promptId")
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    tags: Optional[list["CreatePromptVersionTagInput"]] = None


class CreateCodeEvaluatorInput(BaseModel):
    name: str
    source_code: str = Field(alias="sourceCode")
    language: Language
    sandbox_config_id: str = Field(alias="sandboxConfigId")
    description: Optional[str] = None
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )


class CreateCodeEvaluatorVersionInput(BaseModel):
    code_evaluator_id: str = Field(alias="codeEvaluatorId")
    source_code: str = Field(alias="sourceCode")


class CreateDatasetBuiltinEvaluatorInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    evaluator_id: str = Field(alias="evaluatorId")
    name: str
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    description: Optional[str] = None


class CreateDatasetCodeEvaluatorInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    evaluator_id: str = Field(alias="evaluatorId")
    name: str
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    description: Optional[str] = None


class CreateDatasetDecisionEvaluatorInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    evaluator_id: Optional[str] = Field(alias="evaluatorId", default=None)
    decision_id: Optional[str] = Field(alias="decisionId", default=None)
    evaluator_name: Optional[str] = Field(alias="evaluatorName", default=None)
    decision_version_id: Optional[str] = Field(alias="decisionVersionId", default=None)
    decision_version: Optional["DecisionVersionInput"] = Field(
        alias="decisionVersion", default=None
    )
    scoring_policy: Optional["DecisionScoringPolicyInput"] = Field(
        alias="scoringPolicy", default=None
    )
    name: str
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")
    description: Optional[str] = None


class CreateDatasetInput(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[Any] = None


class CreateDatasetLLMEvaluatorInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    name: str
    description: Optional[str] = None
    prompt_version_id: Optional[str] = Field(alias="promptVersionId", default=None)
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )


class CreateDatasetLabelInput(BaseModel):
    name: str
    description: Optional[str] = None
    color: str
    dataset_ids: Optional[list[str]] = Field(alias="datasetIds", default=None)


class CreateDatasetSplitInput(BaseModel):
    name: str
    description: Optional[str] = None
    color: str
    metadata: Optional[Any] = None


class CreateDatasetSplitWithExamplesInput(BaseModel):
    name: str
    description: Optional[str] = None
    color: str
    metadata: Optional[Any] = None
    example_ids: list[str] = Field(alias="exampleIds")


class CreateDecisionEvaluatorInput(BaseModel):
    name: str
    decision_version_id: str = Field(alias="decisionVersionId")
    description: Optional[str] = None
    scoring_policy: Optional["DecisionScoringPolicyInput"] = Field(
        alias="scoringPolicy", default=None
    )


class CreateDecisionInput(BaseModel):
    name: str
    description: Optional[str] = None
    metadata: Optional[Any] = None
    version: "DecisionVersionInput"
    tags: Optional[list["CreateDecisionVersionTagInput"]] = None


class CreateDecisionLabelInput(BaseModel):
    name: str
    description: Optional[str] = None
    color: str


class CreateDecisionVersionInput(BaseModel):
    decision_id: str = Field(alias="decisionId")
    version: "DecisionVersionInput"
    tags: Optional[list["CreateDecisionVersionTagInput"]] = None


class CreateDecisionVersionTagInput(BaseModel):
    name: str
    description: Optional[str] = None


class CreateDocumentAnnotationInput(BaseModel):
    span_id: str = Field(alias="spanId")
    document_position: int = Field(alias="documentPosition")
    name: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: Any
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateGenerativeModelCustomProviderMutationInput(BaseModel):
    name: str
    description: Optional[str] = None
    provider: str
    client_config: "GenerativeModelCustomerProviderConfigInput" = Field(
        alias="clientConfig"
    )


class CreateModelMutationInput(BaseModel):
    name: str
    provider: Optional[str] = None
    name_pattern: str = Field(alias="namePattern")
    costs: list["TokenPriceInput"]
    start_time: Optional[datetime] = Field(alias="startTime", default=None)


class CreateProjectCodeEvaluatorInput(BaseModel):
    project_id: str = Field(alias="projectId")
    name: str
    source_code: str = Field(alias="sourceCode")
    language: Language
    sandbox_config_id: str = Field(alias="sandboxConfigId")
    evaluator_input_mapping: "EvaluatorInputMappingInput" = Field(
        alias="evaluatorInputMapping"
    )
    sampling_rate: float = Field(alias="samplingRate")
    evaluation_target: EvaluationTarget = Field(alias="evaluationTarget")
    description: Optional[str] = None
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    "Project-specific CODE input mapping. Null inherits the evaluator input mapping; an object overrides it."
    filter_condition: str = Field(alias="filterCondition", default="")
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = Field(
        alias="evaluationDelaySeconds", default=None
    )
    "Seconds a trace or session must stay quiet before evaluation is scheduled; the minimum is 10 seconds. The delay applies to TRACE and SESSION targets and is rejected for SPAN. Omit or use null to store the default: 300 seconds for TRACE and SESSION, and 0 for SPAN, which evaluates spans as they arrive. A trace or session is evaluated only once, and later activity does not schedule another evaluation."


class CreateProjectInput(BaseModel):
    name: str
    description: Optional[str] = None
    gradient_start_color: Optional[str] = Field(
        alias="gradientStartColor", default=None
    )
    gradient_end_color: Optional[str] = Field(alias="gradientEndColor", default=None)


class CreateProjectLLMEvaluatorInput(BaseModel):
    project_id: str = Field(alias="projectId")
    name: str
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")
    sampling_rate: float = Field(alias="samplingRate")
    evaluation_target: EvaluationTarget = Field(alias="evaluationTarget")
    description: Optional[str] = None
    prompt_version_id: Optional[str] = Field(alias="promptVersionId", default=None)
    filter_condition: str = Field(alias="filterCondition", default="")
    enabled: bool = True
    evaluation_delay_seconds: Optional[int] = Field(
        alias="evaluationDelaySeconds", default=None
    )
    "Seconds a trace or session must stay quiet before evaluation is scheduled; the minimum is 10 seconds. The delay applies to TRACE and SESSION targets and is rejected for SPAN. Omit or use null to store the default: 300 seconds for TRACE and SESSION, and 0 for SPAN, which evaluates spans as they arrive. A trace or session is evaluated only once, and later activity does not schedule another evaluation."


class CreateProjectSessionAnnotationInput(BaseModel):
    project_session_id: str = Field(alias="projectSessionId")
    name: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: Any
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateProjectSessionNoteInput(BaseModel):
    session: "ProjectSessionReferenceInput"
    note: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateProjectTraceRetentionPolicyInput(BaseModel):
    name: str
    cron_expression: Any = Field(alias="cronExpression")
    rule: "ProjectTraceRetentionRuleInput"
    add_projects: Optional[list[str]] = Field(alias="addProjects", default=None)


class CreatePromptLabelInput(BaseModel):
    name: str
    description: Optional[str] = None
    color: str


class CreatePromptVersionTagInput(BaseModel):
    name: str
    description: Optional[str] = None


class CreateSandboxConfigInput(BaseModel):
    config: "SandboxConfigVariantInput"
    name: str
    description: Optional[str] = None
    timeout: Optional[int] = None
    enabled: bool = True


class CreateSpanAnnotationInput(BaseModel):
    span_id: str = Field(alias="spanId")
    name: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: Any
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateSpanNoteInput(BaseModel):
    span: "SpanReferenceInput"
    note: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateTraceAnnotationInput(BaseModel):
    trace_id: str = Field(alias="traceId")
    name: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: Any
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateTraceNoteInput(BaseModel):
    trace: "TraceReferenceInput"
    note: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    source: AnnotationSource
    identifier: Optional[str] = None


class CreateUserApiKeyInput(BaseModel):
    name: str
    description: Optional[str] = None
    expires_at: Optional[datetime] = Field(alias="expiresAt", default=None)


class CreateUserInput(BaseModel):
    email: str
    username: str
    password: Optional[str] = None
    role: UserRoleInput
    send_welcome_email: Optional[bool] = Field(alias="sendWelcomeEmail", default=False)
    auth_method: Optional[AuthMethod] = Field(
        alias="authMethod", default=AuthMethod.LOCAL
    )


class CustomProviderDecisionConnectionInput(BaseModel):
    """A custom provider, reached with its stored key, endpoint, and headers. Its SDK must serve decision models: `openai` runs OpenAI's Decisions API, `typesafe` runs System One."""

    id: str
    "The custom provider's ID."


class DatasetEvaluatorFilter(BaseModel):
    """The filter key and value for dataset evaluator connections"""

    col: DatasetEvaluatorFilterColumn
    value: str


class DatasetEvaluatorSort(BaseModel):
    """The sort key and direction for evaluator connections"""

    col: DatasetEvaluatorColumn
    dir: SortDir


class DatasetExampleExpectedOutputInput(BaseModel):
    example_id: str = Field(alias="exampleId")
    expected_revision_id: str = Field(alias="expectedRevisionId")
    annotation_name: str = Field(alias="annotationName")
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None


class DatasetExampleInput(BaseModel):
    input: Any
    output: Any
    metadata: Any
    span_id: Optional[str] = Field(alias="spanId", default=None)
    external_id: Optional[str] = Field(alias="externalId", default=None)


class DatasetExampleOperation(BaseModel):
    """One change to a dataset's examples, after JSON Patch (RFC 6902). Exactly one of `add`, `replace`, or `remove` is set."""

    add: Optional["AddDatasetExampleOperation"] = None
    replace: Optional["ReplaceDatasetExampleFieldOperation"] = None
    remove: Optional["RemoveDatasetExampleOperation"] = None


class DatasetExampleValueInput(BaseModel):
    """The full value of a dataset example. `input`, `output`, and `metadata` must be JSON objects. `externalId` is an optional custom ID; leave it out to have one generated."""

    input: Any
    output: Any
    metadata: Any
    external_id: Optional[str] = Field(alias="externalId", default=None)


class DatasetFilter(BaseModel):
    """A filter for datasets"""

    col: Optional[DatasetFilterColumn] = None
    value: Optional[str] = None
    filter_labels: Optional[list[str]] = Field(alias="filterLabels", default=None)


class DatasetSort(BaseModel):
    """The sort key and direction for dataset connections"""

    col: DatasetColumn
    dir: SortDir


class DatasetVersionSort(BaseModel):
    """The sort key and direction for dataset version connections"""

    col: DatasetVersionColumn
    dir: SortDir


class DaytonaConfigInput(BaseModel):
    language: Language
    env_vars: list["EnvVarInput"] = Field(alias="envVars", default_factory=lambda: [])
    internet_access: Optional["InternetAccessInput"] = Field(
        alias="internetAccess", default=None
    )
    dependencies: Optional["DependenciesInput"] = None


class DaytonaDeploymentInput(BaseModel):
    api_url: Optional[str] = Field(alias="apiUrl", default=None)
    target: Optional[str] = None


class DecisionChoiceScoreInput(BaseModel):
    """The score for one of a choice question's declared choices."""

    choice: str
    score: float


class DecisionChoiceScoringInput(BaseModel):
    """Scoring for a choice question."""

    name: str
    scores: list["DecisionChoiceScoreInput"] = Field(default_factory=lambda: [])
    "Scores by choice; a choice left out gets a null score."
    optimization_direction: OptimizationDirection = Field(
        alias="optimizationDirection", default=OptimizationDirection.NONE
    )


class DecisionConnectionInput(BaseModel):
    """Where a decision runs."""

    built_in: Optional["BuiltInDecisionConnectionInput"] = Field(
        alias="builtIn", default=None
    )
    custom_provider: Optional["CustomProviderDecisionConnectionInput"] = Field(
        alias="customProvider", default=None
    )


class DecisionFilter(BaseModel):
    """The filter key and value for decision connections"""

    col: DecisionFilterColumn
    value: str


class DecisionInputDefinitionInput(BaseModel):
    """One named input a caller passes."""

    name: str
    description: Optional[str] = None
    json_schema: Optional[Any] = Field(alias="jsonSchema", default=None)
    "Describes the value for the playground form. Not enforced on a run."


class DecisionPredicateScoringInput(BaseModel):
    """Scoring for a predicate question."""

    name: str
    threshold: float = 0.5
    "The probability, in [0, 1], at or above which the label is `true`."
    optimization_direction: OptimizationDirection = Field(
        alias="optimizationDirection", default=OptimizationDirection.NONE
    )


class DecisionQuestionInput(BaseModel):
    """One decision question. Exactly one type must be set."""

    predicate: Optional["PredicateQuestionInput"] = None
    choice: Optional["ChoiceQuestionInput"] = None
    scale: Optional["ScaleQuestionInput"] = None


class DecisionQuestionScoringInput(BaseModel):
    """Scoring settings for one named decision question."""

    predicate: Optional["DecisionPredicateScoringInput"] = None
    choice: Optional["DecisionChoiceScoringInput"] = None
    scale: Optional["DecisionScaleScoringInput"] = None


class DecisionScaleScoringInput(BaseModel):
    """Scoring for a scale question; its score is the expected level."""

    name: str
    include_label: bool = Field(alias="includeLabel", default=False)
    "Also label the annotation with the most probable level."
    optimization_direction: OptimizationDirection = Field(
        alias="optimizationDirection", default=OptimizationDirection.NONE
    )


class DecisionScoringPolicyInput(BaseModel):
    """Scoring settings by question. A question left out keeps its default, or on a dataset binding, the judge's own setting."""

    questions: list["DecisionQuestionScoringInput"] = Field(default_factory=lambda: [])


class DecisionStateInput(BaseModel):
    """How the state sent to the model is built from the inputs. Exactly one must be set: `object: true` sends the inputs object itself, `text` renders a template, and `input` sends one input's value unchanged."""

    object_: Optional[bool] = Field(alias="object", default=None)
    text: Optional["TextStateInput"] = None
    input: Optional[str] = None
    "The name of the input whose value is the state."


class DecisionTaskInput(BaseModel):
    """A decision asked about every example of a dataset, as a prompt task completes a prompt for every example."""

    connection: "DecisionConnectionInput"
    model_name: str = Field(alias="modelName")
    inputs: list["DecisionInputDefinitionInput"]
    "The named inputs the state is built from."
    state: "DecisionStateInput"
    questions: list["DecisionQuestionInput"]
    "The fixed questions asked of every example; at least one is required."
    input_values_path: Optional[str] = Field(alias="inputValuesPath", default="input")
    "Dot-notation path to the object holding the input values, by input name, as `templateVariablesPath` is for a prompt. Default 'input' means input `ticket` resolves to input.ticket. Empty string means the whole context, so values are read as `input`, `reference`, or `metadata`."
    evaluators: list["PlaygroundEvaluatorInput"] = Field(default_factory=lambda: [])
    "Dataset evaluators to run on this decision's runs"
    decision_version_id: Optional[str] = Field(alias="decisionVersionId", default=None)
    "The saved version this definition was copied from, as a prompt task's promptVersionId. It is recorded, not read: the definition given here is what runs."


class DecisionVersionInput(BaseModel):
    """A decision version to save: its inputs, state, questions, and the model that answers. Saved versions are immutable; saving again adds a version."""

    inputs: list["DecisionInputDefinitionInput"]
    state: "DecisionStateInput"
    questions: list["DecisionQuestionInput"]
    model_provider: GenerativeProviderKey = Field(alias="modelProvider")
    "The provider whose decision API answers; it must offer decision models. For a custom provider, the API its SDK speaks (OPENAI or TYPESAFE)."
    model_name: str = Field(alias="modelName")
    custom_provider_id: Optional[str] = Field(alias="customProviderId", default=None)
    "Run on this custom provider instead of the built-in one."
    description: Optional[str] = None
    metadata: Optional[Any] = None


class DeleteAgentSessionInput(BaseModel):
    id: str


class DeleteAnnotationConfigsInput(BaseModel):
    ids: list[str]


class DeleteAnnotationsInput(BaseModel):
    annotation_ids: list[str] = Field(alias="annotationIds")


class DeleteApiKeyInput(BaseModel):
    id: str


class DeleteDatasetEvaluatorsInput(BaseModel):
    dataset_evaluator_ids: list[str] = Field(alias="datasetEvaluatorIds")
    delete_associated_prompt: bool = Field(
        alias="deleteAssociatedPrompt", default=False
    )
    "Also delete each LLM evaluator's prompt when no other evaluator references it. Off by default so that a prompt adopted from the prompt hub survives the binding."


class DeleteDatasetExamplesInput(BaseModel):
    example_ids: list[str] = Field(alias="exampleIds")
    dataset_version_description: Optional[str] = Field(
        alias="datasetVersionDescription", default=None
    )
    dataset_version_metadata: Optional[Any] = Field(
        alias="datasetVersionMetadata", default=None
    )
    dataset_id: Optional[str] = Field(alias="datasetId", default=None)
    "When provided, every deleted example must belong to this dataset or the whole mutation is rejected — lets callers scope the write to the dataset they believe they are editing."


class DeleteDatasetInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")


class DeleteDatasetLabelsInput(BaseModel):
    dataset_label_ids: list[str] = Field(alias="datasetLabelIds")


class DeleteDatasetSplitInput(BaseModel):
    dataset_split_ids: list[str] = Field(alias="datasetSplitIds")


class DeleteDecisionEvaluatorInput(BaseModel):
    evaluator_id: str = Field(alias="evaluatorId")


class DeleteDecisionInput(BaseModel):
    decision_id: str = Field(alias="decisionId")


class DeleteDecisionLabelsInput(BaseModel):
    decision_label_ids: list[str] = Field(alias="decisionLabelIds")


class DeleteDecisionVersionTagInput(BaseModel):
    decision_version_tag_id: str = Field(alias="decisionVersionTagId")


class DeleteExperimentsInput(BaseModel):
    experiment_ids: list[str] = Field(alias="experimentIds")


class DeleteGenerativeModelCustomProviderMutationInput(BaseModel):
    id: str


class DeleteModelMutationInput(BaseModel):
    id: str


class DeleteProjectAnnotationsInput(BaseModel):
    project_id: str = Field(alias="projectId")
    annotation_name: str = Field(alias="annotationName")
    time_range: Optional["TimeRange"] = Field(alias="timeRange", default=None)
    "If provided, only annotations whose timestamp falls within this range are deleted. The end of the range is right-exclusive."
    time_range_field: AnnotationTimeRangeField = Field(
        alias="timeRangeField", default=AnnotationTimeRangeField.ANNOTATION_CREATED_AT
    )
    "Which timestamp the time range is applied against. Defaults to the annotation's own creation time."


class DeleteProjectEvaluatorsInput(BaseModel):
    project_evaluator_ids: list[str] = Field(alias="projectEvaluatorIds")
    delete_associated_prompt: bool = Field(
        alias="deleteAssociatedPrompt", default=False
    )
    "Also delete each LLM evaluator's prompt when no other evaluator references it. Off by default so that a prompt adopted from the prompt hub survives the binding."


class DeleteProjectTraceRetentionPolicyInput(BaseModel):
    id: str


class DeletePromptInput(BaseModel):
    prompt_id: str = Field(alias="promptId")


class DeletePromptLabelsInput(BaseModel):
    prompt_label_ids: list[str] = Field(alias="promptLabelIds")


class DeletePromptVersionTagInput(BaseModel):
    prompt_version_tag_id: str = Field(alias="promptVersionTagId")


class DeleteSandboxConfigInput(BaseModel):
    id: str


class DeleteUsersInput(BaseModel):
    user_ids: list[str] = Field(alias="userIds")


class DenoConfigInput(BaseModel):
    language: Language


class DependenciesInput(BaseModel):
    packages: list[str] = Field(default_factory=lambda: [])


class DockerConfigInput(BaseModel):
    language: Language
    env_vars: list["EnvVarInput"] = Field(alias="envVars", default_factory=lambda: [])
    internet_access: Optional["InternetAccessInput"] = Field(
        alias="internetAccess", default=None
    )
    dependencies: Optional["DependenciesInput"] = None


class E2BConfigInput(BaseModel):
    language: Language
    env_vars: list["EnvVarInput"] = Field(alias="envVars", default_factory=lambda: [])
    internet_access: Optional["InternetAccessInput"] = Field(
        alias="internetAccess", default=None
    )
    dependencies: Optional["DependenciesInput"] = None


class E2BDeploymentInput(BaseModel):
    domain: Optional[str] = None
    api_url: Optional[str] = Field(alias="apiUrl", default=None)


class EnvVarInput(BaseModel):
    name: str
    secret_key: str = Field(alias="secretKey")


class EvalResultKey(BaseModel):
    name: str
    attr: EvalAttr


class EvaluatorDefinitionInput(BaseModel):
    inline_decision_evaluator: Optional["InlineDecisionEvaluatorInput"] = Field(
        alias="inlineDecisionEvaluator", default=None
    )
    decision_evaluator_id: Optional[str] = Field(
        alias="decisionEvaluatorId", default=None
    )
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


class EvaluatorFilter(BaseModel):
    """The filter key and value for evaluator connections"""

    col: EvaluatorFilterColumn
    value: str


class EvaluatorInputMappingInput(BaseModel):
    literal_mapping: Any = Field(alias="literalMapping")
    path_mapping: Any = Field(alias="pathMapping")


class EvaluatorPreviewInput(BaseModel):
    evaluator: Optional["EvaluatorDefinitionInput"] = None
    "The evaluator to run. Optional only when datasetEvaluatorId names one."
    dataset_evaluator_id: Optional[str] = Field(
        alias="datasetEvaluatorId", default=None
    )
    "Preview a saved decision judge as this dataset evaluator binding: it runs under the binding's name and provenance, using the evaluator's scoring policy. Omit to preview the judge on its own, under its own name and policy."
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")
    subjects: list["EvaluatorPreviewSubjectInput"]
    apply_online_evaluation_limits: bool = Field(
        alias="applyOnlineEvaluationLimits", default=False
    )
    "Whether to enforce the execution limits an online evaluation runs under: the rendered LLM message cap and the sandbox payload cap. Set this when the preview stands in for a scheduled run, so a preview cannot succeed where the live evaluation would be rejected. The limits themselves come from the server's configuration, never from this request."
    credentials: Optional[list["GenerativeCredentialInput"]] = None


class EvaluatorPreviewSubjectInput(BaseModel):
    id: str
    "Chosen by the caller and echoed on the subject's result; unique per request."
    context: Any


class EvaluatorSort(BaseModel):
    """The sort key and direction for evaluator connections"""

    col: EvaluatorColumn
    dir: SortDir


class EvaluatorTaskInput(BaseModel):
    evaluator: "EvaluatorDefinitionInput"
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")
    source: Optional["EvaluatorTaskSourceInput"] = None
    "The saved evaluator, prompt version and dataset or project binding the task was opened from, kept on the experiment so its calibration can be traced back."


class EvaluatorTaskSourceInput(BaseModel):
    evaluator_id: Optional[str] = Field(alias="evaluatorId", default=None)
    prompt_version_id: Optional[str] = Field(alias="promptVersionId", default=None)
    dataset_evaluator_id: Optional[str] = Field(
        alias="datasetEvaluatorId", default=None
    )
    project_evaluator_id: Optional[str] = Field(
        alias="projectEvaluatorId", default=None
    )


class ExperimentRunColumn(BaseModel):
    metric: Optional[ExperimentRunMetric] = None
    annotation_name: Optional[str] = Field(alias="annotationName", default=None)


class ExperimentRunSort(BaseModel):
    """The sort key and direction for experiment run connections"""

    col: "ExperimentRunColumn"
    dir: SortDir


class ExperimentSort(BaseModel):
    """The sort key and direction for experiment connections"""

    col: ExperimentColumn
    dir: SortDir


class ExperimentTaskInput(BaseModel):
    prompt: Optional["PromptTaskInput"] = None
    evaluator: Optional["EvaluatorTaskInput"] = None
    decision: Optional["DecisionTaskInput"] = None


class ExperimentsOverDatasetInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    dataset_version_id: Optional[str] = Field(alias="datasetVersionId", default=None)
    split_ids: Optional[list[str]] = Field(alias="splitIds", default=None)
    example_ids: Optional[list[str]] = Field(alias="exampleIds", default=None)
    "Run only these examples of the dataset, as a row's play button does; every example of the dataset or its splits when omitted."
    repetitions: int = 1
    max_concurrency: int = Field(alias="maxConcurrency", default=10)
    "The concurrency budget of each experiment"
    credentials: Optional[list["GenerativeCredentialInput"]] = None
    experiment_name: Optional[str] = Field(alias="experimentName", default=None)
    experiment_description: Optional[str] = Field(
        alias="experimentDescription", default=None
    )
    experiment_metadata: Optional[Any] = Field(alias="experimentMetadata", default=None)
    create_ephemeral_experiment: Optional[bool] = Field(
        alias="createEphemeralExperiment", default=False
    )
    tasks: list["ExperimentTaskInput"]
    "One experiment is created per task, in this order. The tasks must all be prompt or decision tasks (which may be mixed) or all evaluators."


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


class GenerativeModelCustomerProviderConfigInput(BaseModel):
    openai: Optional["OpenAICustomProviderConfigInput"] = None
    azure_openai: Optional["AzureOpenAICustomProviderConfigInput"] = Field(
        alias="azureOpenai", default=None
    )
    anthropic: Optional["AnthropicCustomProviderConfigInput"] = None
    aws_bedrock: Optional["AWSBedrockCustomProviderConfigInput"] = Field(
        alias="awsBedrock", default=None
    )
    google_genai: Optional["GoogleGenAICustomProviderConfigInput"] = Field(
        alias="googleGenai", default=None
    )
    typesafe: Optional["TypeSafeCustomProviderConfigInput"] = None


class GoogleGenAIAuthenticationMethodInput(BaseModel):
    api_key: Any = Field(alias="apiKey")


class GoogleGenAIClientKwargsInput(BaseModel):
    http_options: Optional["GoogleGenAIHttpOptionsInput"] = Field(
        alias="httpOptions", default=None
    )


class GoogleGenAICustomProviderConfigInput(BaseModel):
    google_genai_authentication_method: "GoogleGenAIAuthenticationMethodInput" = Field(
        alias="googleGenaiAuthenticationMethod"
    )
    google_genai_client_kwargs: Optional["GoogleGenAIClientKwargsInput"] = Field(
        alias="googleGenaiClientKwargs", default=None
    )


class GoogleGenAIHttpOptionsInput(BaseModel):
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    headers: Optional[Any] = None


class InlineCodeEvaluatorInput(BaseModel):
    name: str
    language: Language
    source_code: str = Field(alias="sourceCode")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    sandbox_config_id: Optional[str] = Field(alias="sandboxConfigId", default=None)
    description: Optional[str] = None


class InlineDecisionEvaluatorInput(BaseModel):
    name: str
    decision_version: "DecisionVersionInput" = Field(alias="decisionVersion")
    scoring_policy: Optional["DecisionScoringPolicyInput"] = Field(
        alias="scoringPolicy", default=None
    )
    description: Optional[str] = None


class InlineLLMEvaluatorInput(BaseModel):
    name: str
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    description: Optional[str] = None


class InternetAccessInput(BaseModel):
    mode: InternetAccessChoice


class ModalConfigInput(BaseModel):
    language: Language = Language.PYTHON
    env_vars: list["EnvVarInput"] = Field(alias="envVars", default_factory=lambda: [])
    internet_access: Optional["InternetAccessInput"] = Field(
        alias="internetAccess", default=None
    )
    dependencies: Optional["DependenciesInput"] = None


class ModelsInput(BaseModel):
    provider_key: Optional[GenerativeProviderKey] = Field(
        alias="providerKey", default=None
    )
    model_name: Optional[str] = Field(alias="modelName", default=None)
    openai_api_type: Optional[OpenAIApiType] = Field(
        alias="openaiApiType", default=None
    )
    model_type: ModelType = Field(alias="modelType", default=ModelType.LLM)


class MontyConfigInput(BaseModel):
    language: Language = Language.PYTHON


class OpenAIAuthenticationMethodInput(BaseModel):
    api_key: Any = Field(alias="apiKey")


class OpenAIClientKwargsInput(BaseModel):
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    organization: Optional[str] = None
    project: Optional[str] = None
    default_headers: Optional[Any] = Field(alias="defaultHeaders", default=None)


class OpenAICustomProviderConfigInput(BaseModel):
    openai_authentication_method: "OpenAIAuthenticationMethodInput" = Field(
        alias="openaiAuthenticationMethod"
    )
    openai_client_kwargs: Optional["OpenAIClientKwargsInput"] = Field(
        alias="openaiClientKwargs", default=None
    )
    openai_api_type: Optional[OpenAIApiType] = Field(
        alias="openaiApiType", default=OpenAIApiType.RESPONSES
    )


class PatchAgentSessionInput(BaseModel):
    id: str
    title: Optional[str] = None
    "New title. Omitted leaves the title unchanged."
    model: Optional["AgentModelSelectionInput"] = None
    "New model selection. Omitted leaves the model unchanged."


class PatchAnnotationInput(BaseModel):
    annotation_id: str = Field(alias="annotationId")
    name: Optional[str] = None
    annotator_kind: Optional[AnnotatorKind] = Field(alias="annotatorKind", default=None)
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: Optional[Any] = None
    identifier: Optional[str] = None
    source: Optional[AnnotationSource] = None


class PatchCodeEvaluatorInput(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    sandbox_config_id: Optional[str] = Field(alias="sandboxConfigId", default=None)
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )


class PatchDatasetExamplesInput(BaseModel):
    """Input to the `patchDatasetExamples` mutation. The operations are applied in order and committed together as one new dataset version, or not at all. Later operations see the effect of earlier ones: replacing a field twice keeps the last value, removing an example discards its replacements, and targeting an example after it was removed is an error."""

    dataset_id: str = Field(alias="datasetId")
    operations: list["DatasetExampleOperation"]
    version_description: Optional[str] = Field(alias="versionDescription", default=None)
    version_metadata: Optional[Any] = Field(alias="versionMetadata", default=None)


class PatchDatasetInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Any] = None


class PatchDatasetSplitInput(BaseModel):
    dataset_split_id: str = Field(alias="datasetSplitId")
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    metadata: Optional[Any] = None


class PatchDecisionEvaluatorInput(BaseModel):
    evaluator_id: str = Field(alias="evaluatorId")
    name: Optional[str] = None
    description: Optional[str] = None
    decision_version_id: Optional[str] = Field(alias="decisionVersionId", default=None)
    scoring_policy: Optional["DecisionScoringPolicyInput"] = Field(
        alias="scoringPolicy", default=None
    )


class PatchDecisionInput(BaseModel):
    decision_id: str = Field(alias="decisionId")
    description: Optional[str] = None
    metadata: Optional[Any] = None


class PatchDecisionLabelInput(BaseModel):
    decision_label_id: str = Field(alias="decisionLabelId")
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class PatchExperimentInput(BaseModel):
    experiment_id: str = Field(alias="experimentId")
    name: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[Any] = None


class PatchGenerativeModelCustomProviderMutationInput(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    client_config: Optional["GenerativeModelCustomerProviderConfigInput"] = Field(
        alias="clientConfig", default=None
    )


class PatchProjectInput(BaseModel):
    id: str
    description: Optional[str] = None
    gradient_start_color: Optional[str] = Field(
        alias="gradientStartColor", default=None
    )
    gradient_end_color: Optional[str] = Field(alias="gradientEndColor", default=None)


class PatchProjectTraceRetentionPolicyInput(BaseModel):
    id: str
    name: Optional[str] = None
    cron_expression: Optional[Any] = Field(alias="cronExpression", default=None)
    rule: Optional["ProjectTraceRetentionRuleInput"] = None
    add_projects: Optional[list[str]] = Field(alias="addProjects", default=None)
    remove_projects: Optional[list[str]] = Field(alias="removeProjects", default=None)


class PatchPromptInput(BaseModel):
    prompt_id: str = Field(alias="promptId")
    description: Optional[str] = None
    metadata: Optional[Any] = None


class PatchPromptLabelInput(BaseModel):
    prompt_label_id: str = Field(alias="promptLabelId")
    name: Optional[str] = None
    description: Optional[str] = None


class PatchUserInput(BaseModel):
    user_id: str = Field(alias="userId")
    new_role: Optional[UserRoleInput] = Field(alias="newRole", default=None)
    new_username: Optional[str] = Field(alias="newUsername", default=None)
    new_password: Optional[str] = Field(alias="newPassword", default=None)


class PatchViewerInput(BaseModel):
    new_username: Optional[str] = Field(alias="newUsername", default=None)
    new_password: Optional[str] = Field(alias="newPassword", default=None)
    current_password: Optional[str] = Field(alias="currentPassword", default=None)


class PlaygroundEvaluatorInput(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )


class PredicateCriteriaInput(BaseModel):
    """What counts as true and as false; either may be omitted."""

    true: Optional[str] = None
    "What counts as true."
    false: Optional[str] = None
    "What counts as false."


class PredicateQuestionInput(BaseModel):
    """A statement or yes/no question, answered with the probability that it is true."""

    name: str
    "The name the answer is returned under."
    instructions: str
    criteria: Optional["PredicateCriteriaInput"] = None


class ProjectEvaluatorFilter(BaseModel):
    """A filter for project evaluator connections"""

    col: Optional[ProjectEvaluatorFilterColumn] = None
    value: Optional[str] = None
    annotation_names: Optional[list[str]] = Field(alias="annotationNames", default=None)
    "Match evaluators that produce any of these exact annotation names, before pagination. Single-output evaluators use the project evaluator's name; multiple outputs use '<evaluator name>.<output name>'. An omitted, null, or empty list does not filter."


class ProjectFilter(BaseModel):
    """The filter key and value for project connections"""

    col: ProjectFilterColumn
    value: str


class ProjectSessionAnnoResultKey(BaseModel):
    name: str
    attr: ProjectSessionAnnoAttr


class ProjectSessionReferenceInput(BaseModel):
    id: Optional[str] = None
    "The session's Phoenix node ID."
    session_id: Optional[str] = Field(alias="sessionId", default=None)
    "The raw session.id value supplied by the application, matched exactly."


class ProjectSessionSort(BaseModel):
    """The sort key and direction for ProjectSession connections."""

    col: Optional[ProjectSessionColumn] = None
    anno_result_key: Optional["ProjectSessionAnnoResultKey"] = Field(
        alias="annoResultKey", default=None
    )
    dir: SortDir


class ProjectSort(BaseModel):
    """The sort key and direction for project connections"""

    col: ProjectColumn
    dir: SortDir


class ProjectTraceRetentionRuleInput(BaseModel):
    max_days: Optional["ProjectTraceRetentionRuleMaxDaysInput"] = Field(
        alias="maxDays", default=None
    )
    max_count: Optional["ProjectTraceRetentionRuleMaxCountInput"] = Field(
        alias="maxCount", default=None
    )
    max_days_or_count: Optional["ProjectTraceRetentionRuleMaxDaysOrCountInput"] = Field(
        alias="maxDaysOrCount", default=None
    )


class ProjectTraceRetentionRuleMaxCountInput(BaseModel):
    max_count: int = Field(alias="maxCount")


class ProjectTraceRetentionRuleMaxDaysInput(BaseModel):
    max_days: float = Field(alias="maxDays")


class ProjectTraceRetentionRuleMaxDaysOrCountInput(BaseModel):
    max_days: float = Field(alias="maxDays")
    max_count: int = Field(alias="maxCount")


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


class PromptFilter(BaseModel):
    """The filter key and value for prompt connections"""

    col: PromptFilterColumn
    value: str


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


class PromptTaskInput(BaseModel):
    prompt_version_id: Optional[str] = Field(alias="promptVersionId", default=None)
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    prompt_name: Optional[str] = Field(alias="promptName", default=None)
    connection_config: Optional["ConnectionConfigInput"] = Field(
        alias="connectionConfig", default=None
    )
    headers: Optional[Any] = None
    appended_messages_path: Optional[str] = Field(
        alias="appendedMessagesPath", default=None
    )
    "Dot-notation path to messages in dataset example input to append to prompt"
    template_variables_path: Optional[str] = Field(
        alias="templateVariablesPath", default="input"
    )
    "Dot-notation path prefix for template variables. Default 'input' means {{query}} resolves to input.query. Empty string means full paths like {{input.query}} or {{reference.answer}} are required."
    stream_model_output: bool = Field(alias="streamModelOutput", default=True)
    evaluators: list["PlaygroundEvaluatorInput"] = Field(default_factory=lambda: [])
    "Dataset evaluators to run on this prompt's outputs"


class PromptTemplateOptions(BaseModel):
    variables: Any
    format: PromptTemplateFormat


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


class RemoveAnnotationConfigFromProjectInput(BaseModel):
    project_id: str = Field(alias="projectId")
    annotation_config_id: str = Field(alias="annotationConfigId")


class RemoveDatasetExampleOperation(BaseModel):
    """Removes an existing example from the dataset."""

    example_id: str = Field(alias="exampleId")


class ReplaceDatasetExampleFieldOperation(BaseModel):
    """Replaces one field of an existing example with `value`, a JSON object. Fields the operation list never names carry over from the example's latest revision."""

    example_id: str = Field(alias="exampleId")
    field: DatasetExampleField
    value: Any


class RevokeOAuth2GrantInput(BaseModel):
    id: str


class RunDecisionInput(BaseModel):
    """A decision run: where it runs, the inputs it declares and their values for this call, how the state is built from them, and the questions."""

    connection: "DecisionConnectionInput"
    model_name: str = Field(alias="modelName")
    "The decision model to run. Any name the endpoint accepts works; the catalog only suggests names."
    inputs: list["DecisionInputDefinitionInput"]
    "The named inputs a caller passes, in order. Names must be unique."
    state: "DecisionStateInput"
    "How the state sent to the model is built from the inputs."
    input_values: Any = Field(alias="inputValues")
    "An object with one entry per declared input: the key is the input's name, and the value is any JSON (a string, number, boolean, null, object, or array). Missing or undeclared names are rejected."
    questions: list["DecisionQuestionInput"]
    "The questions, in order. Names must be unique; answers come back under them."


class RunDecisionVersionInput(BaseModel):
    """A run of a saved decision version: its definition, model, and provider as saved, with this call's input values."""

    decision_version_id: str = Field(alias="decisionVersionId")
    input_values: Any = Field(alias="inputValues")
    "An object with one entry per input the version declares, keyed by name. Missing or undeclared names are rejected."
    credentials: Optional[list["GenerativeCredentialInput"]] = None
    "API keys for this request only, for a version on a built-in provider. When omitted, a stored secret is used, then the server environment. A custom provider brings its own key."
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    "Send the request to this endpoint instead of the built-in provider's default, such as a local Ollama. Requires an API key in `credentials` or a stored secret where the provider needs one; the server-configured key is never sent to a custom URL. A custom provider brings its own endpoint."


class SandboxConfigVariantInput(BaseModel):
    e_2_b: Optional["E2BConfigInput"] = Field(alias="e2b", default=None)
    daytona: Optional["DaytonaConfigInput"] = None
    deno: Optional["DenoConfigInput"] = None
    vercel: Optional["VercelConfigInput"] = None
    wasm: Optional["WASMConfigInput"] = None
    modal: Optional["ModalConfigInput"] = None
    monty: Optional["MontyConfigInput"] = None
    docker: Optional["DockerConfigInput"] = None


class SandboxDeploymentVariantInput(BaseModel):
    daytona: Optional["DaytonaDeploymentInput"] = None
    e_2_b: Optional["E2BDeploymentInput"] = Field(alias="e2b", default=None)


class ScaleLevelInput(BaseModel):
    label: str
    description: Optional[str] = None


class ScaleQuestionInput(BaseModel):
    """2–10 ordered levels; a level's position, from zero, is its value."""

    name: str
    "The name the answer is returned under."
    instructions: str
    levels: list["ScaleLevelInput"]


class SecretKeyValueInput(BaseModel):
    key: str
    value: Optional[str] = None
    "The value of the secret. If null, the secret will be deleted."


class SetAgentAssistantEnabledInput(BaseModel):
    enabled: bool


class SetAgentGithubEnabledInput(BaseModel):
    enabled: bool


class SetAgentSessionRetentionInput(BaseModel):
    max_idle_days: Optional[int] = Field(alias="maxIdleDays", default=None)
    "Delete persisted sessions idle longer than this many days. Omit to leave unchanged; set null to disable idle-based deletion."
    max_count_per_user: Optional[int] = Field(alias="maxCountPerUser", default=None)
    "Keep only the newest N persisted sessions per user. Omit to leave unchanged; set null to disable the per-user count limit."


class SetAgentTraceRecordingInput(BaseModel):
    allow_local_traces: bool = Field(alias="allowLocalTraces")
    allow_remote_export: bool = Field(alias="allowRemoteExport")


class SetDatasetExampleExpectedOutputsInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    expected_outputs: list["DatasetExampleExpectedOutputInput"] = Field(
        alias="expectedOutputs"
    )


class SetDatasetExampleSplitsInput(BaseModel):
    example_id: str = Field(alias="exampleId")
    dataset_split_ids: list[str] = Field(alias="datasetSplitIds")


class SetDatasetExamplesSplitsInput(BaseModel):
    example_ids: list[str] = Field(alias="exampleIds")
    dataset_split_ids: list[str] = Field(alias="datasetSplitIds")
    dataset_id: Optional[str] = Field(alias="datasetId", default=None)
    "When provided, every example must belong to this dataset or the whole mutation is rejected — lets callers scope a batch write to the dataset they believe they are editing."


class SetDatasetLabelsInput(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    dataset_label_ids: list[str] = Field(alias="datasetLabelIds")


class SetDecisionLabelsInput(BaseModel):
    decision_id: str = Field(alias="decisionId")
    decision_label_ids: list[str] = Field(alias="decisionLabelIds")


class SetDecisionVersionTagInput(BaseModel):
    decision_version_id: str = Field(alias="decisionVersionId")
    name: str
    description: Optional[str] = None


class SetProjectEvaluatorEnabledInput(BaseModel):
    project_evaluator_id: str = Field(alias="projectEvaluatorId")
    enabled: bool


class SetPromptLabelsInput(BaseModel):
    prompt_id: str = Field(alias="promptId")
    prompt_label_ids: list[str] = Field(alias="promptLabelIds")


class SetPromptVersionTagInput(BaseModel):
    prompt_version_id: str = Field(alias="promptVersionId")
    name: str
    description: Optional[str] = None


class SpanAnnotationSort(BaseModel):
    """The sort key and direction for SpanAnnotation connections"""

    col: SpanAnnotationColumn
    dir: SortDir


class SpanReferenceInput(BaseModel):
    id: Optional[str] = None
    "The span's Phoenix node ID."
    otel_id: Optional[str] = Field(alias="otelId", default=None)
    "The span's OpenTelemetry span ID, matched exactly."


class SpanSort(BaseModel):
    """The sort key and direction for span connections. Must specify one and only one of either `col` or `evalResultKey`."""

    col: Optional[SpanColumn] = None
    eval_result_key: Optional["EvalResultKey"] = Field(
        alias="evalResultKey", default=None
    )
    dir: SortDir


class TextContentValueInput(BaseModel):
    text: str


class TextStateInput(BaseModel):
    """Render a text template over the inputs."""

    template: str
    template_format: DecisionTemplateFormat = Field(alias="templateFormat")


class TimeBinConfig(BaseModel):
    scale: TimeBinScale = TimeBinScale.HOUR
    "The scale of time bins for aggregation."
    utc_offset_minutes: int = Field(alias="utcOffsetMinutes", default=0)
    "Offset in minutes from UTC for local time binning."
    units_per_bin: int = Field(alias="unitsPerBin", default=1)
    "Number of scale units per bin, from 1 to 1000. Values above 1 are allowed for MINUTE, HOUR, DAY, and WEEK. Bins follow local clock time (for example, 5-minute bins start at :00, :05, ...), and week bins start on Monday."


class TimeRange(BaseModel):
    start: Optional[datetime] = None
    "The start of the time range"
    end: Optional[datetime] = None
    "The end of the time range. Right exclusive."


class TokenPriceInput(BaseModel):
    token_type: str = Field(alias="tokenType")
    cost_per_million_tokens: float = Field(alias="costPerMillionTokens")
    kind: TokenKind


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


class TraceAnnotationSort(BaseModel):
    """The sort key and direction for TraceAnnotation connections"""

    col: TraceAnnotationColumn
    dir: SortDir


class TraceReferenceInput(BaseModel):
    id: Optional[str] = None
    "The trace's Phoenix node ID."
    otel_id: Optional[str] = Field(alias="otelId", default=None)
    "The trace's OpenTelemetry trace ID, matched exactly."


class TruncateAgentSessionInput(BaseModel):
    id: str
    message_id: str = Field(alias="messageId")
    "The transcript message (UIMessage id) to rewind at. A user message is removed along with everything after it; an assistant message is kept and everything after it is removed."


class TypeSafeAuthenticationMethodInput(BaseModel):
    api_key: Any = Field(alias="apiKey")


class TypeSafeClientKwargsInput(BaseModel):
    base_url: Optional[str] = Field(alias="baseUrl", default=None)
    default_headers: Optional[Any] = Field(alias="defaultHeaders", default=None)


class TypeSafeCustomProviderConfigInput(BaseModel):
    """A System One-compatible endpoint; it serves decision models only."""

    typesafe_authentication_method: "TypeSafeAuthenticationMethodInput" = Field(
        alias="typesafeAuthenticationMethod"
    )
    typesafe_client_kwargs: Optional["TypeSafeClientKwargsInput"] = Field(
        alias="typesafeClientKwargs", default=None
    )


class UnsetDecisionLabelsInput(BaseModel):
    decision_id: str = Field(alias="decisionId")
    decision_label_ids: list[str] = Field(alias="decisionLabelIds")


class UnsetPromptLabelsInput(BaseModel):
    prompt_id: str = Field(alias="promptId")
    prompt_label_ids: list[str] = Field(alias="promptLabelIds")


class UpdateAnnotationConfigInput(BaseModel):
    id: str
    annotation_config: "AnnotationConfigInput" = Field(alias="annotationConfig")


class UpdateAnnotationInput(BaseModel):
    id: str
    name: str
    annotator_kind: AnnotatorKind = Field(alias="annotatorKind")
    label: Optional[str] = None
    score: Optional[float] = None
    explanation: Optional[str] = None
    metadata: Any
    source: AnnotationSource


class UpdateDatasetBuiltinEvaluatorInput(BaseModel):
    dataset_evaluator_id: str = Field(alias="datasetEvaluatorId")
    name: str
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    description: Optional[str] = None


class UpdateDatasetCodeEvaluatorInput(BaseModel):
    dataset_evaluator_id: str = Field(alias="datasetEvaluatorId")
    name: str
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    description: Optional[str] = None


class UpdateDatasetDecisionEvaluatorInput(BaseModel):
    dataset_evaluator_id: str = Field(alias="datasetEvaluatorId")
    name: Optional[str] = None
    description: Optional[str] = None
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    decision_version_id: Optional[str] = Field(alias="decisionVersionId", default=None)
    decision_version: Optional["DecisionVersionInput"] = Field(
        alias="decisionVersion", default=None
    )
    scoring_policy: Optional["DecisionScoringPolicyInput"] = Field(
        alias="scoringPolicy", default=None
    )


class UpdateDatasetLLMEvaluatorInput(BaseModel):
    dataset_evaluator_id: str = Field(alias="datasetEvaluatorId")
    dataset_id: str = Field(alias="datasetId")
    name: str
    description: Optional[str] = None
    prompt_version_id: Optional[str] = Field(alias="promptVersionId", default=None)
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )


class UpdateModelMutationInput(BaseModel):
    id: str
    name: str
    provider: Optional[str] = None
    name_pattern: str = Field(alias="namePattern")
    costs: list["TokenPriceInput"]
    start_time: Optional[datetime] = Field(alias="startTime", default=None)


class UpdateProjectCodeEvaluatorInput(BaseModel):
    project_evaluator_id: str = Field(alias="projectEvaluatorId")
    name: str
    sampling_rate: float = Field(alias="samplingRate")
    evaluation_target: EvaluationTarget = Field(alias="evaluationTarget")
    "The evaluation target is fixed at project evaluator creation."
    filter_condition: str = Field(alias="filterCondition")
    evaluator_input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="evaluatorInputMapping", default=None
    )
    enabled: Optional[bool] = None
    description: Optional[str] = None
    source_code: Optional[str] = Field(alias="sourceCode", default=None)
    sandbox_config_id: Optional[str] = Field(alias="sandboxConfigId", default=None)
    output_configs: Optional[list["AnnotationConfigInput"]] = Field(
        alias="outputConfigs", default=None
    )
    input_mapping: Optional["EvaluatorInputMappingInput"] = Field(
        alias="inputMapping", default=None
    )
    "Project-specific CODE input mapping patch. Omit to preserve the current setting, use null to inherit the evaluator input mapping, or provide an object to override it."
    evaluation_delay_seconds: Optional[int] = Field(
        alias="evaluationDelaySeconds", default=None
    )
    "Seconds a trace or session must stay quiet before evaluation is scheduled; the minimum is 10 seconds. The delay applies to TRACE and SESSION targets and is rejected for SPAN. Omit to preserve the current setting, or use null to restore the default: 300 seconds for TRACE and SESSION, and 0 for SPAN. A trace or session is evaluated only once, and later activity does not schedule another evaluation."


class UpdateProjectLLMEvaluatorInput(BaseModel):
    project_evaluator_id: str = Field(alias="projectEvaluatorId")
    name: str
    prompt_version: "ChatPromptVersionInput" = Field(alias="promptVersion")
    output_configs: list["AnnotationConfigInput"] = Field(alias="outputConfigs")
    input_mapping: "EvaluatorInputMappingInput" = Field(alias="inputMapping")
    sampling_rate: float = Field(alias="samplingRate")
    evaluation_target: EvaluationTarget = Field(alias="evaluationTarget")
    "The evaluation target is fixed at project evaluator creation."
    filter_condition: str = Field(alias="filterCondition")
    enabled: Optional[bool] = None
    description: Optional[str] = None
    prompt_version_id: Optional[str] = Field(alias="promptVersionId", default=None)
    evaluation_delay_seconds: Optional[int] = Field(
        alias="evaluationDelaySeconds", default=None
    )
    "Seconds a trace or session must stay quiet before evaluation is scheduled; the minimum is 10 seconds. The delay applies to TRACE and SESSION targets and is rejected for SPAN. Omit to preserve the current setting, or use null to restore the default: 300 seconds for TRACE and SESSION, and 0 for SPAN. A trace or session is evaluated only once, and later activity does not schedule another evaluation."


class UpdateSandboxConfigInput(BaseModel):
    id: str
    description: Optional[str] = None
    config: Optional["SandboxConfigVariantInput"] = None
    timeout: Optional[int] = None
    enabled: Optional[bool] = None


class UpdateSandboxProviderInput(BaseModel):
    id: str
    enabled: Optional[bool] = None
    deployment: Optional["SandboxDeploymentVariantInput"] = None


class UpsertOrDeleteSecretsMutationInput(BaseModel):
    secrets: list["SecretKeyValueInput"]
    "A list of secret key-value pairs to upsert or delete. Must contain at least one secret. When the same key appears multiple times in the list, the last occurrence determines the final action (upsert with that value, or delete if value is null)."


class VercelConfigInput(BaseModel):
    language: Language
    env_vars: list["EnvVarInput"] = Field(alias="envVars", default_factory=lambda: [])
    internet_access: Optional["InternetAccessInput"] = Field(
        alias="internetAccess", default=None
    )
    dependencies: Optional["DependenciesInput"] = None


class WASMConfigInput(BaseModel):
    language: Language = Language.PYTHON


AWSBedrockAuthenticationMethodInput.model_rebuild()
AWSBedrockCustomProviderConfigInput.model_rebuild()
AddDatasetExampleOperation.model_rebuild()
AddExamplesToDatasetInput.model_rebuild()
AddProjectCodeEvaluatorInput.model_rebuild()
AgentModelSelectionInput.model_rebuild()
AnnotationConfigInput.model_rebuild()
AnnotationFilter.model_rebuild()
AnthropicCustomProviderConfigInput.model_rebuild()
AzureOpenAIAuthenticationMethodInput.model_rebuild()
AzureOpenAICustomProviderConfigInput.model_rebuild()
BuiltInDecisionConnectionInput.model_rebuild()
CategoricalAnnotationConfigInput.model_rebuild()
ChatCompletionInput.model_rebuild()
ChatPromptVersionInput.model_rebuild()
ChoiceQuestionInput.model_rebuild()
ContentPartInput.model_rebuild()
CreateAgentSessionInput.model_rebuild()
CreateAnnotationConfigInput.model_rebuild()
CreateChatPromptInput.model_rebuild()
CreateChatPromptVersionInput.model_rebuild()
CreateCodeEvaluatorInput.model_rebuild()
CreateDatasetBuiltinEvaluatorInput.model_rebuild()
CreateDatasetCodeEvaluatorInput.model_rebuild()
CreateDatasetDecisionEvaluatorInput.model_rebuild()
CreateDatasetLLMEvaluatorInput.model_rebuild()
CreateDecisionEvaluatorInput.model_rebuild()
CreateDecisionInput.model_rebuild()
CreateDecisionVersionInput.model_rebuild()
CreateGenerativeModelCustomProviderMutationInput.model_rebuild()
CreateModelMutationInput.model_rebuild()
CreateProjectCodeEvaluatorInput.model_rebuild()
CreateProjectLLMEvaluatorInput.model_rebuild()
CreateProjectSessionNoteInput.model_rebuild()
CreateProjectTraceRetentionPolicyInput.model_rebuild()
CreateSandboxConfigInput.model_rebuild()
CreateSpanNoteInput.model_rebuild()
CreateTraceNoteInput.model_rebuild()
DatasetExampleOperation.model_rebuild()
DaytonaConfigInput.model_rebuild()
DecisionChoiceScoringInput.model_rebuild()
DecisionConnectionInput.model_rebuild()
DecisionQuestionInput.model_rebuild()
DecisionQuestionScoringInput.model_rebuild()
DecisionScoringPolicyInput.model_rebuild()
DecisionStateInput.model_rebuild()
DecisionTaskInput.model_rebuild()
DecisionVersionInput.model_rebuild()
DeleteProjectAnnotationsInput.model_rebuild()
DockerConfigInput.model_rebuild()
E2BConfigInput.model_rebuild()
EvaluatorDefinitionInput.model_rebuild()
EvaluatorPreviewInput.model_rebuild()
EvaluatorTaskInput.model_rebuild()
ExperimentRunSort.model_rebuild()
ExperimentTaskInput.model_rebuild()
ExperimentsOverDatasetInput.model_rebuild()
GenerativeModelCustomerProviderConfigInput.model_rebuild()
GoogleGenAIClientKwargsInput.model_rebuild()
GoogleGenAICustomProviderConfigInput.model_rebuild()
InlineCodeEvaluatorInput.model_rebuild()
InlineDecisionEvaluatorInput.model_rebuild()
InlineLLMEvaluatorInput.model_rebuild()
ModalConfigInput.model_rebuild()
OpenAICustomProviderConfigInput.model_rebuild()
PatchAgentSessionInput.model_rebuild()
PatchCodeEvaluatorInput.model_rebuild()
PatchDatasetExamplesInput.model_rebuild()
PatchDecisionEvaluatorInput.model_rebuild()
PatchGenerativeModelCustomProviderMutationInput.model_rebuild()
PatchProjectTraceRetentionPolicyInput.model_rebuild()
PlaygroundEvaluatorInput.model_rebuild()
PredicateQuestionInput.model_rebuild()
ProjectSessionSort.model_rebuild()
ProjectTraceRetentionRuleInput.model_rebuild()
PromptAnthropicInvocationParametersInput.model_rebuild()
PromptAnthropicThinkingConfigInput.model_rebuild()
PromptChatTemplateInput.model_rebuild()
PromptGoogleInvocationParametersInput.model_rebuild()
PromptInvocationParametersInput.model_rebuild()
PromptMessageInput.model_rebuild()
PromptResponseFormatJSONSchemaInput.model_rebuild()
PromptTaskInput.model_rebuild()
PromptToolInput.model_rebuild()
PromptToolsInput.model_rebuild()
RunDecisionInput.model_rebuild()
RunDecisionVersionInput.model_rebuild()
SandboxConfigVariantInput.model_rebuild()
SandboxDeploymentVariantInput.model_rebuild()
ScaleQuestionInput.model_rebuild()
SetDatasetExampleExpectedOutputsInput.model_rebuild()
SpanSort.model_rebuild()
ToolCallContentValueInput.model_rebuild()
TypeSafeCustomProviderConfigInput.model_rebuild()
UpdateAnnotationConfigInput.model_rebuild()
UpdateDatasetBuiltinEvaluatorInput.model_rebuild()
UpdateDatasetCodeEvaluatorInput.model_rebuild()
UpdateDatasetDecisionEvaluatorInput.model_rebuild()
UpdateDatasetLLMEvaluatorInput.model_rebuild()
UpdateModelMutationInput.model_rebuild()
UpdateProjectCodeEvaluatorInput.model_rebuild()
UpdateProjectLLMEvaluatorInput.model_rebuild()
UpdateSandboxConfigInput.model_rebuild()
UpdateSandboxProviderInput.model_rebuild()
UpsertOrDeleteSecretsMutationInput.model_rebuild()
VercelConfigInput.model_rebuild()
