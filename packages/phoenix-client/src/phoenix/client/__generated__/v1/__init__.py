"""Do not edit"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal, Mapping, Optional, Sequence, Union

from pydantic import BaseModel, ConfigDict, Field, RootModel


class CreateExperimentRequestBody(BaseModel):
    model_config = ConfigDict(frozen=True)
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
    model_config = ConfigDict(frozen=True)
    id: Annotated[str, Field(title="Id")]
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    created_at: Annotated[datetime, Field(title="Created At")]
    updated_at: Annotated[datetime, Field(title="Updated At")]


class DatasetExample(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: Annotated[str, Field(title="Id")]
    input: Annotated[Mapping[str, Any], Field(title="Input")]
    output: Annotated[Mapping[str, Any], Field(title="Output")]
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    updated_at: Annotated[datetime, Field(title="Updated At")]


class DatasetVersion(BaseModel):
    model_config = ConfigDict(frozen=True)
    version_id: Annotated[str, Field(title="Version Id")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    created_at: Annotated[datetime, Field(title="Created At")]


class DatasetWithExampleCount(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: Annotated[str, Field(title="Id")]
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None
    metadata: Annotated[Mapping[str, Any], Field(title="Metadata")]
    created_at: Annotated[datetime, Field(title="Created At")]
    updated_at: Annotated[datetime, Field(title="Updated At")]
    example_count: Annotated[int, Field(title="Example Count")]


class Experiment(BaseModel):
    model_config = ConfigDict(frozen=True)
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
    model_config = ConfigDict(frozen=True)
    data: DatasetWithExampleCount


class GetExperimentResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Experiment


class ImageContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    url: Annotated[str, Field(title="Url")]


class InsertedSpanAnnotation(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: Annotated[str, Field(description="The ID of the inserted span annotation", title="Id")]


class ListDatasetExamplesData(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataset_id: Annotated[str, Field(title="Dataset Id")]
    version_id: Annotated[str, Field(title="Version Id")]
    examples: Sequence[Annotated[DatasetExample, Field(title="Examples")]]


class ListDatasetExamplesResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: ListDatasetExamplesData


class ListDatasetVersionsResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Sequence[Annotated[DatasetVersion, Field(title="Data")]]
    next_cursor: Annotated[Optional[str], Field(title="Next Cursor")] = None


class ListDatasetsResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Sequence[Annotated[Dataset, Field(title="Data")]]
    next_cursor: Annotated[Optional[str], Field(title="Next Cursor")] = None


class ListExperimentsResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Sequence[Annotated[Experiment, Field(title="Data")]]


class Prompt(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: Annotated[str, Field(title="Id")]
    source_prompt_id: Annotated[Optional[str], Field(title="Source Prompt Id")] = None
    name: Annotated[str, Field(title="Name")]
    description: Annotated[Optional[str], Field(title="Description")] = None


class PromptJSONSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    definition: Annotated[Mapping[str, Any], Field(title="Definition")]


class PromptStringTemplateV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    template: Annotated[str, Field(title="Template")]


class PromptToolDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    definition: Annotated[Mapping[str, Any], Field(title="Definition")]


class PromptToolsV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    version: Annotated[Literal["tools-v1"], Field(title="Version")] = "tools-v1"
    tool_definitions: Sequence[Annotated[PromptToolDefinition, Field(title="Tool Definitions")]]


class SpanAnnotationResult(BaseModel):
    model_config = ConfigDict(frozen=True)
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
    model_config = ConfigDict(frozen=True)
    text: Annotated[str, Field(title="Text")]


class ToolCallFunction(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Annotated[Literal["function"], Field(title="Type")] = "function"
    name: Annotated[str, Field(title="Name")]
    arguments: Annotated[str, Field(title="Arguments")]


class ToolResultContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    tool_call_id: Annotated[str, Field(title="Tool Call Id")]
    result: Annotated[
        Optional[Union[bool, int, float, str, Mapping[str, Any], Sequence[Any]]],
        Field(title="Result"),
    ] = None


class UploadDatasetData(BaseModel):
    model_config = ConfigDict(frozen=True)
    dataset_id: Annotated[str, Field(title="Dataset Id")]


class UploadDatasetResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: UploadDatasetData


class ValidationError(BaseModel):
    model_config = ConfigDict(frozen=True)
    loc: Sequence[Annotated[Union[str, int], Field(title="Location")]]
    msg: Annotated[str, Field(title="Message")]
    type: Annotated[str, Field(title="Error Type")]


class AnnotateSpansResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Sequence[Annotated[InsertedSpanAnnotation, Field(title="Data")]]


class CreateExperimentResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Experiment


class GetPromptsResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Sequence[Annotated[Prompt, Field(title="Data")]]


class HTTPValidationError(BaseModel):
    model_config = ConfigDict(frozen=True)
    detail: Annotated[Optional[Sequence[ValidationError]], Field(title="Detail")] = None


class ImageContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Annotated[Literal["image"], Field(title="Type")] = "image"
    image: ImageContentValue


class SpanAnnotation(BaseModel):
    model_config = ConfigDict(frozen=True)
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
    model_config = ConfigDict(frozen=True)
    type: Annotated[Literal["text"], Field(title="Type")] = "text"
    text: TextContentValue


class ToolCallContentValue(BaseModel):
    model_config = ConfigDict(frozen=True)
    tool_call_id: Annotated[str, Field(title="Tool Call Id")]
    tool_call: ToolCallFunction


class ToolResultContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Annotated[Literal["tool_result"], Field(title="Type")] = "tool_result"
    tool_result: ToolResultContentValue


class AnnotateSpansRequestBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: Sequence[Annotated[SpanAnnotation, Field(title="Data")]]


class ToolCallContentPart(BaseModel):
    model_config = ConfigDict(frozen=True)
    type: Annotated[Literal["tool_call"], Field(title="Type")] = "tool_call"
    tool_call: ToolCallContentValue


class PromptMessage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    role: Annotated[Literal["USER", "SYSTEM", "AI", "TOOL"], Field(title="PromptMessageRole")]
    content: Sequence[
        Annotated[
            Union[TextContentPart, ImageContentPart, ToolCallContentPart, ToolResultContentPart],
            Field(title="Content"),
        ]
    ]


class PromptChatTemplateV1(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    messages: Sequence[Annotated[PromptMessage, Field(title="Messages")]]


class PromptVersion(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: Annotated[str, Field(title="Id")]
    description: Annotated[str, Field(title="Description")]
    model_provider: Annotated[str, Field(title="Model Provider")]
    model_name: Annotated[str, Field(title="Model Name")]
    template: Annotated[
        Union[PromptChatTemplateV1, PromptStringTemplateV1], Field(title="Template")
    ]
    template_type: Annotated[
        Optional[Literal["STR", "CHAT"]], Field(title="PromptTemplateType")
    ] = "CHAT"
    template_format: Annotated[
        Optional[Literal["MUSTACHE", "FSTRING", "NONE"]], Field(title="PromptTemplateFormat")
    ] = "MUSTACHE"
    invocation_parameters: Annotated[
        Optional[Mapping[str, Any]], Field(title="Invocation Parameters")
    ] = None
    tools: Optional[PromptToolsV1] = None
    output_schema: Optional[PromptJSONSchema] = None


class GetPromptResponseBody(BaseModel):
    model_config = ConfigDict(frozen=True)
    data: PromptVersion
