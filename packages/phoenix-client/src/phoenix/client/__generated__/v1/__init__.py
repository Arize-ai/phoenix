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


class ImageContentValue(TypedDict):
    url: str


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


class ListExperimentsResponseBody(TypedDict):
    data: Sequence[Experiment]


class Prompt(TypedDict):
    id: str
    source_prompt_id: Optional[str]
    name: str
    description: Optional[str]


class PromptFunctionToolV1(TypedDict):
    name: str
    type: Literal["function-tool-v1"]
    description: NotRequired[str]
    schema: NotRequired[Mapping[str, Any]]
    extra_parameters: NotRequired[Mapping[str, Any]]


class PromptOutputSchema(TypedDict):
    definition: Mapping[str, Any]


class PromptStringTemplateV1(TypedDict):
    template: str
    version: Literal["string-template-v1"]


class PromptToolsV1(TypedDict):
    tools: Sequence[PromptFunctionToolV1]
    type: Literal["tools-v1"]


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


class ImageContentPart(TypedDict):
    image: ImageContentValue
    type: Literal["image"]


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
    content: Sequence[
        Union[TextContentPart, ImageContentPart, ToolCallContentPart, ToolResultContentPart]
    ]


class PromptChatTemplateV1(TypedDict):
    messages: Sequence[PromptMessage]
    version: Literal["chat-template-v1"]


class PromptVersion(TypedDict):
    id: str
    description: str
    model_provider: str
    model_name: str
    template: Union[PromptChatTemplateV1, PromptStringTemplateV1]
    template_type: NotRequired[Literal["STR", "CHAT"]]
    template_format: NotRequired[Literal["MUSTACHE", "FSTRING", "NONE"]]
    invocation_parameters: NotRequired[Mapping[str, Any]]
    tools: NotRequired[PromptToolsV1]
    output_schema: NotRequired[PromptOutputSchema]


class GetPromptResponseBody(TypedDict):
    data: PromptVersion


class GetPromptVersionsResponseBody(TypedDict):
    data: Sequence[PromptVersion]
