"""Do not edit"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal, Mapping, Optional, Sequence, Union

from pydantic import BaseModel, ConfigDict, Field


class CreateExperimentRequestBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    name: Annotated[
        Optional[str],
        Field(
            description="Name of the experiment (if omitted, a random name will be generated)",
            title="Name",
        ),
    ] = None
    description: Annotated[
        Optional[str],
        Field(description="An optional description of the experiment", title="Description"),
    ] = None
    metadata: Annotated[
        Optional[Mapping[str, Any]],
        Field(description="Metadata for the experiment", title="Metadata"),
    ] = None
    version_id: Annotated[
        Optional[str],
        Field(
            description="ID of the dataset version over which the experiment will be run (if omitted, the latest version will be used)",
            title="Version Id",
        ),
    ] = None
    repetitions: Annotated[
        Optional[int],
        Field(
            description="Number of times the experiment should be repeated for each example",
            title="Repetitions",
        ),
    ] = 1


class Dataset(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    id: Annotated[str, Field(title="Id")]
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    created_at: Annotated[datetime, Field(title="Created At")]
    updated_at: Annotated[datetime, Field(title="Updated At")]


class DatasetExample(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    id: Annotated[str, Field(title="Id")]
    input: Annotated[Mapping[str, Any], Field(title="Input")]
    output: Annotated[Mapping[str, Any], Field(title="Output")]
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    updated_at: Annotated[datetime, Field(title="Updated At")]


class DatasetVersion(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    version_id: Annotated[str, Field(title="Version Id")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    created_at: Annotated[datetime, Field(title="Created At")]


class DatasetWithExampleCount(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    id: Annotated[str, Field(title="Id")]
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    created_at: Annotated[datetime, Field(title="Created At")]
    updated_at: Annotated[datetime, Field(title="Updated At")]
    example_count: Annotated[int, Field(title="Example Count")]


class Experiment(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    id: Annotated[str, Field(description="The ID of the experiment", title="Id")]
    dataset_id: Annotated[
        str,
        Field(
            description="The ID of the dataset associated with the experiment", title="Dataset Id"
        ),
    ]
    dataset_version_id: Annotated[
        str,
        Field(
            description="The ID of the dataset version associated with the experiment",
            title="Dataset Version Id",
        ),
    ]
    repetitions: Annotated[
        int, Field(description="Number of times the experiment is repeated", title="Repetitions")
    ]
    metadata: Annotated[
        Mapping[str, Any], Field(description="Metadata of the experiment", title="Metadata")
    ]
    project_name: Annotated[
        Optional[str],
        Field(
            description="The name of the project associated with the experiment",
            title="Project Name",
        ),
    ] = None
    created_at: Annotated[
        datetime, Field(description="The creation timestamp of the experiment", title="Created At")
    ]
    updated_at: Annotated[
        datetime,
        Field(description="The last update timestamp of the experiment", title="Updated At"),
    ]


class GetDatasetResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: DatasetWithExampleCount


class GetExperimentResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Experiment


class InsertedSpanAnnotation(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    id: Annotated[str, Field(description="The ID of the inserted span annotation", title="Id")]


class JSONSchemaDraft7ObjectSchema(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    type: Annotated[Literal["json-schema-draft-7-object-schema"], Field(title="Type")]
    json_: Annotated[Mapping[str, Any], Field(alias="json", title="Json")]


class ListDatasetExamplesData(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    dataset_id: Annotated[str, Field(title="Dataset Id")]
    version_id: Annotated[str, Field(title="Version Id")]
    examples: Annotated[Sequence[DatasetExample], Field(title="Examples")]


class ListDatasetExamplesResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: ListDatasetExamplesData


class ListDatasetVersionsResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[DatasetVersion], Field(title="Data")]
    next_cursor: Annotated[Optional[str], Field(title="Next Cursor")] = None


class ListDatasetsResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[Dataset], Field(title="Data")]
    next_cursor: Annotated[Optional[str], Field(title="Next Cursor")] = None


class ListExperimentsResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[Experiment], Field(title="Data")]


class Prompt(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    name: Annotated[str, Field(pattern="^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$", title="Identifier")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    source_prompt_id: Annotated[Optional[str], Field(title="Source Prompt Id")] = None


class PromptAnthropicInvocationParametersContent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    max_tokens: Annotated[int, Field(title="Max Tokens")]
    temperature: Annotated[Optional[float], Field(title="Temperature")] = None
    top_p: Annotated[Optional[float], Field(title="Top P")] = None
    stop_sequences: Annotated[Optional[Sequence[str]], Field(title="Stop Sequences")] = None


class PromptAzureOpenAIInvocationParametersContent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    temperature: Annotated[Optional[float], Field(title="Temperature")] = None
    max_tokens: Annotated[Optional[int], Field(title="Max Tokens")] = None
    frequency_penalty: Annotated[Optional[float], Field(title="Frequency Penalty")] = None
    presence_penalty: Annotated[Optional[float], Field(title="Presence Penalty")] = None
    top_p: Annotated[Optional[float], Field(title="Top P")] = None
    seed: Annotated[Optional[int], Field(title="Seed")] = None
    reasoning_effort: Annotated[
        Optional[Literal["low", "medium", "high"]], Field(title="Reasoning Effort")
    ] = None


class PromptData(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    name: Annotated[str, Field(pattern="^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$", title="Identifier")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    source_prompt_id: Annotated[Optional[str], Field(title="Source Prompt Id")] = None
    id: Annotated[str, Field(title="Id")]


class PromptFunctionTool(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["function-tool"], Field(title="Type")]
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    schema_: Annotated[
        Optional[JSONSchemaDraft7ObjectSchema],
        Field(alias="schema", discriminator="type", title="Schema"),
    ] = None
    extra_parameters: Annotated[Optional[Mapping[str, Any]], Field(title="Extra Parameters")] = None


class PromptGeminiInvocationParametersContent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    temperature: Annotated[Optional[float], Field(title="Temperature")] = None
    max_output_tokens: Annotated[Optional[int], Field(title="Max Output Tokens")] = None
    stop_sequences: Annotated[Optional[Sequence[str]], Field(title="Stop Sequences")] = None
    presence_penalty: Annotated[Optional[float], Field(title="Presence Penalty")] = None
    frequency_penalty: Annotated[Optional[float], Field(title="Frequency Penalty")] = None
    top_p: Annotated[Optional[float], Field(title="Top P")] = None
    top_k: Annotated[Optional[int], Field(title="Top K")] = None


class PromptOpenAIInvocationParametersContent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    temperature: Annotated[Optional[float], Field(title="Temperature")] = None
    max_tokens: Annotated[Optional[int], Field(title="Max Tokens")] = None
    frequency_penalty: Annotated[Optional[float], Field(title="Frequency Penalty")] = None
    presence_penalty: Annotated[Optional[float], Field(title="Presence Penalty")] = None
    top_p: Annotated[Optional[float], Field(title="Top P")] = None
    seed: Annotated[Optional[int], Field(title="Seed")] = None
    reasoning_effort: Annotated[
        Optional[Literal["low", "medium", "high"]], Field(title="Reasoning Effort")
    ] = None


class PromptResponseFormatJSONSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["response-format-json-schema"], Field(title="Type")]
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    schema_: Annotated[
        JSONSchemaDraft7ObjectSchema, Field(alias="schema", discriminator="type", title="Schema")
    ]
    extra_parameters: Annotated[Mapping[str, Any], Field(title="Extra Parameters")]


class PromptStringTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["string"], Field(title="Type")]
    template: Annotated[str, Field(title="Template")]


class PromptToolChoiceNone(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["none"], Field(title="Type")]


class PromptToolChoiceOneOrMore(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["one-or-more"], Field(title="Type")]


class PromptToolChoiceSpecificFunctionTool(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["specific-function-tool"], Field(title="Type")]
    function_name: Annotated[str, Field(title="Function Name")]


class PromptToolChoiceZeroOrMore(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["zero-or-more"], Field(title="Type")]


class PromptTools(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["tools"], Field(title="Type")]
    tools: Annotated[
        Sequence[Annotated[PromptFunctionTool, Field(discriminator="type")],],
        Field(min_length=1, title="Tools"),
    ]
    tool_choice: Annotated[
        Optional[
            Union[
                PromptToolChoiceNone,
                PromptToolChoiceZeroOrMore,
                PromptToolChoiceOneOrMore,
                PromptToolChoiceSpecificFunctionTool,
            ]
        ],
        Field(discriminator="type", title="Tool Choice"),
    ] = None
    disable_parallel_tool_calls: Annotated[
        Optional[bool], Field(title="Disable Parallel Tool Calls")
    ] = None


class SpanAnnotationResult(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    label: Annotated[
        Optional[str], Field(description="The label assigned by the annotation", title="Label")
    ] = None
    score: Annotated[
        Optional[float], Field(description="The score assigned by the annotation", title="Score")
    ] = None
    explanation: Annotated[
        Optional[str],
        Field(description="Explanation of the annotation result", title="Explanation"),
    ] = None


class TextContentValue(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    text: Annotated[str, Field(title="Text")]


class ToolCallFunction(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    type: Annotated[Literal["function"], Field(title="Type")]
    name: Annotated[str, Field(title="Name")]
    arguments: Annotated[str, Field(title="Arguments")]


class ToolResultContentValue(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    tool_call_id: Annotated[str, Field(title="Tool Call Id")]
    result: Annotated[
        Optional[Union[bool, int, float, str, Mapping[str, Any], Sequence[Any]]],
        Field(title="Result"),
    ] = None


class UploadDatasetData(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    dataset_id: Annotated[str, Field(title="Dataset Id")]


class UploadDatasetResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: UploadDatasetData


class ValidationError(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    loc: Annotated[Sequence[Union[str, int]], Field(title="Location")]
    msg: Annotated[str, Field(title="Message")]
    type: Annotated[str, Field(title="Error Type")]


class AnnotateSpansResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[InsertedSpanAnnotation], Field(title="Data")]


class CreateExperimentResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Experiment


class GetPromptsResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[PromptData], Field(title="Data")]


class HTTPValidationError(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    detail: Annotated[Optional[Sequence[ValidationError]], Field(title="Detail")] = None


class PromptAnthropicInvocationParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["anthropic"], Field(title="Type")]
    anthropic: PromptAnthropicInvocationParametersContent


class PromptAzureOpenAIInvocationParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["azure_openai"], Field(title="Type")]
    azure_openai: PromptAzureOpenAIInvocationParametersContent


class PromptGeminiInvocationParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["gemini"], Field(title="Type")]
    gemini: PromptGeminiInvocationParametersContent


class PromptOpenAIInvocationParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["openai"], Field(title="Type")]
    openai: PromptOpenAIInvocationParametersContent


class SpanAnnotation(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    span_id: Annotated[
        str, Field(description="OpenTelemetry Span ID (hex format w/o 0x prefix)", title="Span Id")
    ]
    name: Annotated[str, Field(description="The name of the annotation", title="Name")]
    annotator_kind: Annotated[
        Literal["LLM", "HUMAN"],
        Field(description="The kind of annotator used for the annotation", title="Annotator Kind"),
    ]
    result: Annotated[
        Optional[SpanAnnotationResult], Field(description="The result of the annotation")
    ] = None
    metadata: Annotated[
        Optional[Mapping[str, Any]],
        Field(description="Metadata for the annotation", title="Metadata"),
    ] = None


class TextContentPart(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["text"], Field(title="Type")]
    text: TextContentValue


class ToolCallContentValue(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    tool_call_id: Annotated[str, Field(title="Tool Call Id")]
    tool_call: ToolCallFunction


class ToolResultContentPart(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["tool_result"], Field(title="Type")]
    tool_result: ToolResultContentValue


class AnnotateSpansRequestBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[SpanAnnotation], Field(title="Data")]


class ToolCallContentPart(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["tool_call"], Field(title="Type")]
    tool_call: ToolCallContentValue


class PromptMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    role: Annotated[Literal["USER", "SYSTEM", "AI", "TOOL"], Field(title="PromptMessageRole")]
    content: Annotated[
        Sequence[
            Annotated[
                Union[TextContentPart, ToolCallContentPart, ToolResultContentPart],
                Field(discriminator="type"),
            ],
        ],
        Field(min_length=1, title="Content"),
    ]


class PromptChatTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, validate_assignment=True)
    type: Annotated[Literal["chat"], Field(title="Type")]
    messages: Annotated[Sequence[PromptMessage], Field(title="Messages")]


class PromptVersion(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    description: Annotated[Optional[str], Field(title="Description")] = None
    model_provider: Annotated[
        Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GEMINI"], Field(title="ModelProvider")
    ]
    model_name: Annotated[str, Field(title="Model Name")]
    template: Annotated[
        Union[PromptChatTemplate, PromptStringTemplate],
        Field(discriminator="type", title="Template"),
    ]
    template_type: Annotated[Literal["STR", "CHAT"], Field(title="PromptTemplateType")]
    template_format: Annotated[
        Literal["MUSTACHE", "FSTRING", "NONE"], Field(title="PromptTemplateFormat")
    ]
    invocation_parameters: Annotated[
        Union[
            PromptOpenAIInvocationParameters,
            PromptAzureOpenAIInvocationParameters,
            PromptAnthropicInvocationParameters,
            PromptGeminiInvocationParameters,
        ],
        Field(discriminator="type", title="Invocation Parameters"),
    ]
    tools: Optional[PromptTools] = None
    response_format: Annotated[
        Optional[PromptResponseFormatJSONSchema], Field(title="Response Format")
    ] = None


class PromptVersionData(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    description: Annotated[Optional[str], Field(title="Description")] = None
    model_provider: Annotated[
        Literal["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "GEMINI"], Field(title="ModelProvider")
    ]
    model_name: Annotated[str, Field(title="Model Name")]
    template: Annotated[
        Union[PromptChatTemplate, PromptStringTemplate],
        Field(discriminator="type", title="Template"),
    ]
    template_type: Annotated[Literal["STR", "CHAT"], Field(title="PromptTemplateType")]
    template_format: Annotated[
        Literal["MUSTACHE", "FSTRING", "NONE"], Field(title="PromptTemplateFormat")
    ]
    invocation_parameters: Annotated[
        Union[
            PromptOpenAIInvocationParameters,
            PromptAzureOpenAIInvocationParameters,
            PromptAnthropicInvocationParameters,
            PromptGeminiInvocationParameters,
        ],
        Field(discriminator="type", title="Invocation Parameters"),
    ]
    tools: Optional[PromptTools] = None
    response_format: Annotated[
        Optional[PromptResponseFormatJSONSchema], Field(title="Response Format")
    ] = None
    id: Annotated[str, Field(title="Id")]


class CreatePromptRequestBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    prompt: Prompt
    version: PromptVersion


class CreatePromptResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: PromptVersionData


class GetPromptResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: PromptVersionData


class GetPromptVersionsResponseBody(BaseModel):
    model_config = ConfigDict(strict=True, validate_assignment=True)
    data: Annotated[Sequence[PromptVersionData], Field(title="Data")]
