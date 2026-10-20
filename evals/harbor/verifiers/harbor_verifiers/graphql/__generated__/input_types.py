from typing import Any, Optional

from pydantic import Field

from .base_model import BaseModel
from .enums import (
    AnthropicOutputConfigEffort,
    AnthropicThinkingDisplay,
    DecisionTemplateFormat,
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


class ChoiceOptionInput(BaseModel):
    value: str
    description: Optional[str] = None


class ChoiceQuestionInput(BaseModel):
    """One option from a fixed set of 2–255."""

    name: str
    "The name the answer is returned under."
    instructions: str
    choices: list["ChoiceOptionInput"]


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


class ScaleLevelInput(BaseModel):
    label: str
    description: Optional[str] = None


class ScaleQuestionInput(BaseModel):
    """2–10 ordered levels; a level's position, from zero, is its value."""

    name: str
    "The name the answer is returned under."
    instructions: str
    levels: list["ScaleLevelInput"]


class TextContentValueInput(BaseModel):
    text: str


class TextStateInput(BaseModel):
    """Render a text template over the inputs."""

    template: str
    template_format: DecisionTemplateFormat = Field(alias="templateFormat")


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
ChoiceQuestionInput.model_rebuild()
ContentPartInput.model_rebuild()
DecisionChoiceScoringInput.model_rebuild()
DecisionQuestionInput.model_rebuild()
DecisionQuestionScoringInput.model_rebuild()
DecisionScoringPolicyInput.model_rebuild()
DecisionStateInput.model_rebuild()
DecisionVersionInput.model_rebuild()
EvaluatorDefinitionInput.model_rebuild()
EvaluatorPreviewInput.model_rebuild()
InlineCodeEvaluatorInput.model_rebuild()
InlineDecisionEvaluatorInput.model_rebuild()
InlineLLMEvaluatorInput.model_rebuild()
PredicateQuestionInput.model_rebuild()
PromptAnthropicInvocationParametersInput.model_rebuild()
PromptAnthropicThinkingConfigInput.model_rebuild()
PromptChatTemplateInput.model_rebuild()
PromptGoogleInvocationParametersInput.model_rebuild()
PromptInvocationParametersInput.model_rebuild()
PromptMessageInput.model_rebuild()
PromptResponseFormatJSONSchemaInput.model_rebuild()
PromptToolInput.model_rebuild()
PromptToolsInput.model_rebuild()
ScaleQuestionInput.model_rebuild()
ToolCallContentValueInput.model_rebuild()
