# Auto-generated from open-telemetry/semantic-conventions-genai @ 494d44d5bcc9
# Source schemas: gen-ai-input-messages.json, gen-ai-output-messages.json, gen-ai-retrieval-documents.json, gen-ai-system-instructions.json, gen-ai-tool-definitions.json
# Regenerate with: make gen-otel-models
# DO NOT EDIT BY HAND.
# ruff: noqa: E501

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel


class GenericPart(BaseModel):
    """
    Represents an arbitrary message part with any type and properties.
    This allows for extensibility with custom message part types.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        str, Field(description="The type of the content captured in this part.", title="Type")
    ]


class GenericServerToolCall(BaseModel):
    """
    Represents an arbitrary server tool call with any type and properties.
    This allows for extensibility with custom server tool types.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        str, Field(description="Type identifier for the server tool call.", title="Type")
    ]


class GenericServerToolCallResponse(BaseModel):
    """
    Represents an arbitrary server tool call response with any type and properties.
    This allows for extensibility with custom server tool response types.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        str, Field(description="Type identifier for the server tool call response.", title="Type")
    ]


class Modality(Enum):
    image = "image"
    video = "video"
    audio = "audio"


class ReasoningPart(BaseModel):
    """
    Represents reasoning/thinking content received from the model.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["reasoning"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    content: Annotated[
        str,
        Field(description="Reasoning/thinking content received from the model.", title="Content"),
    ]


class Role(Enum):
    system = "system"
    user = "user"
    assistant = "assistant"
    tool = "tool"


class TextPart(BaseModel):
    """
    Represents text content sent to or received from the model.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["text"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    content: Annotated[
        str, Field(description="Text content sent to or received from the model.", title="Content")
    ]


class ToolCallRequestPart(BaseModel):
    """
    Represents a tool call requested by the model.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["tool_call"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    id: Annotated[
        str | None, Field(description="Unique identifier for the tool call.", title="Id")
    ] = None
    name: Annotated[str, Field(description="Name of the tool.", title="Name")]
    arguments: Annotated[
        Any | None, Field(description="Arguments for the tool call.", title="Arguments")
    ] = None


class ToolCallResponsePart(BaseModel):
    """
    Represents a tool call result sent to the model or a built-in tool call outcome and details.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["tool_call_response"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    id: Annotated[str | None, Field(description="Unique tool call identifier.", title="Id")] = None
    response: Annotated[Any, Field(description="Tool call response.", title="Response")]


class ServerToolCallPart(BaseModel):
    """
    Represents a server-side tool call invocation. Server tool calls are executed by the model provider on the server side rather than by the client application. Provider-specific tools (e.g., code_interpreter, web_search) can have well-defined schemas defined by the respective providers.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["server_tool_call"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    id: Annotated[
        str | None, Field(description="Unique identifier for the server tool call.", title="Id")
    ] = None
    name: Annotated[str, Field(description="Name of the server tool.", title="Name")]
    server_tool_call: Annotated[
        GenericServerToolCall,
        Field(
            description="Polymorphic server tool call details with type discriminator. The structure varies based on the tool type.",
            title="Server Tool Call",
        ),
    ]


class ServerToolCallResponsePart(BaseModel):
    """
    Represents a server-side tool call response. Contains the outcome and details of a server tool execution. Provider-specific tools (e.g., code_interpreter, web_search) can have well-defined response schemas defined by the respective providers.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["server_tool_call_response"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    id: Annotated[
        str | None,
        Field(
            description="Unique server tool call identifier matching the original call.", title="Id"
        ),
    ] = None
    server_tool_call_response: Annotated[
        GenericServerToolCallResponse,
        Field(
            description="Polymorphic server tool call response with type discriminator. The structure varies based on the tool type.",
            title="Server Tool Call Response",
        ),
    ]


class UriPart(BaseModel):
    """
    Represents an external referenced file sent to the model by URI
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["uri"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    mime_type: Annotated[
        str | None, Field(description="The IANA MIME type of the attached data.", title="Mime Type")
    ] = None
    modality: Annotated[
        Modality | str,
        Field(
            description="The general modality of the data if it is known. Instrumentations SHOULD also set the mimeType field if the specific type is known.",
            title="Modality",
        ),
    ]
    uri: Annotated[
        str,
        Field(
            description="A URI referencing attached data. It should not be a base64 data URL, which should use the `blob` part instead. The URI may use a scheme known to the provider api (e.g. `gs://bucket/object.png`), or be a publicly accessible location.",
            title="Uri",
        ),
    ]


class FinishReason(Enum):
    """
    Represents the reason for finishing the generation.
    """

    stop = "stop"
    length = "length"
    content_filter = "content_filter"
    tool_call = "tool_call"
    error = "error"


class RetrievalDocument(BaseModel):
    """
    Represents a single document retrieved from a vector database or search system.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    id: Annotated[str, Field(description="A unique identifier for the document.", title="Id")]
    score: Annotated[
        float, Field(description="The relevance score of the document.", title="Score")
    ]


class RetrievalDocuments(RootModel[list[RetrievalDocument]]):
    """
    Represents the list of documents retrieved from a vector database or search system.
    """

    root: Annotated[
        list[RetrievalDocument],
        Field(
            description="Represents the list of documents retrieved from a vector database or search system.",
            title="RetrievalDocuments",
        ),
    ]


class FunctionToolDefinition(BaseModel):
    """
    Represents a tool definition in the form of a function.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[Literal["function"], Field(description="The type of the tool.", title="Type")]
    name: Annotated[str, Field(description="The name of the tool.", title="Name")]
    description: Annotated[
        str | None,
        Field(
            description="The description of the tool. Since this attribute could be large, it's NOT RECOMMENDED to be populated by default. Instrumentations MAY provide a way to enable populating this property.",
            title="Description",
        ),
    ] = None
    parameters: Annotated[
        dict[str, Any] | None,
        Field(
            description="JSON Schema document describing the parameters accepted by the tool. The value MUST conform to JSON Schema draft-07. Since this attribute could be large, it's NOT RECOMMENDED to be populated by default. Instrumentations MAY provide a way to enable populating this property.",
            title="Parameters",
        ),
    ] = None


class GenericToolDefinition(BaseModel):
    """
    Represents a tool definition in any form.
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[str, Field(description="The type of the tool.", title="Type")]
    name: Annotated[str, Field(description="The name of the tool.", title="Name")]


class ToolDefinitions(RootModel[list[FunctionToolDefinition | GenericToolDefinition]]):
    """
    Represents the list of tool definitions available to the GenAI agent or model.
    """

    root: Annotated[
        list[FunctionToolDefinition | GenericToolDefinition],
        Field(
            description="Represents the list of tool definitions available to the GenAI agent or model.",
            title="ToolDefinitions",
        ),
    ]


class BlobPart(BaseModel):
    """
    Represents blob binary data sent inline to the model
    """

    type: Annotated[
        Literal["blob"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    mime_type: Annotated[
        str | None, Field(description="The IANA MIME type of the attached data.", title="Mime Type")
    ] = None
    modality: Annotated[
        Modality | str,
        Field(
            description="The general modality of the data if it is known. Instrumentations SHOULD also set the mimeType field if the specific type is known.",
            title="Modality",
        ),
    ]
    content: Annotated[
        bytes,
        Field(
            description="Raw bytes of the attached data. This field SHOULD be encoded as a base64 string when serialized to JSON.",
            title="Content",
        ),
    ]


class FilePart(BaseModel):
    """
    Represents an external referenced file sent to the model by file id
    """

    model_config = ConfigDict(
        extra="allow",
    )
    type: Annotated[
        Literal["file"],
        Field(description="The type of the content captured in this part.", title="Type"),
    ]
    mime_type: Annotated[
        str | None, Field(description="The IANA MIME type of the attached data.", title="Mime Type")
    ] = None
    modality: Annotated[
        Modality | str,
        Field(
            description="The general modality of the data if it is known. Instrumentations SHOULD also set the mimeType field if the specific type is known.",
            title="Modality",
        ),
    ]
    file_id: Annotated[
        str,
        Field(
            description="An identifier referencing a file that was pre-uploaded to the provider.",
            title="File Id",
        ),
    ]


class OutputMessage(BaseModel):
    """
    Represents an output message generated by the model or agent. The output message captures
    specific response (choice, candidate).
    """

    model_config = ConfigDict(
        extra="allow",
    )
    role: Annotated[
        Role | str, Field(description="Role of the entity that created the message.", title="Role")
    ]
    parts: Annotated[
        list[
            TextPart
            | ToolCallRequestPart
            | ToolCallResponsePart
            | ServerToolCallPart
            | ServerToolCallResponsePart
            | BlobPart
            | FilePart
            | UriPart
            | ReasoningPart
            | GenericPart
        ],
        Field(description="List of message parts that make up the message content.", title="Parts"),
    ]
    name: Annotated[str | None, Field(description="The name of the participant.", title="Name")] = (
        None
    )
    finish_reason: Annotated[
        FinishReason | str,
        Field(description="Reason for finishing the generation.", title="Finish Reason"),
    ]


class OutputMessages(RootModel[list[OutputMessage]]):
    """
    Represents the list of output messages generated by the model or agent.
    """

    root: Annotated[
        list[OutputMessage],
        Field(
            description="Represents the list of output messages generated by the model or agent.",
            title="OutputMessages",
        ),
    ]


class SystemInstructions(
    RootModel[
        list[
            TextPart
            | ToolCallRequestPart
            | ToolCallResponsePart
            | BlobPart
            | FilePart
            | UriPart
            | ReasoningPart
            | GenericPart
        ]
    ]
):
    """
    Represents the list of input messages sent to the model.
    """

    root: Annotated[
        list[
            TextPart
            | ToolCallRequestPart
            | ToolCallResponsePart
            | BlobPart
            | FilePart
            | UriPart
            | ReasoningPart
            | GenericPart
        ],
        Field(
            description="Represents the list of input messages sent to the model.",
            title="SystemInstructions",
        ),
    ]


class ChatMessage(BaseModel):
    model_config = ConfigDict(
        extra="allow",
    )
    role: Annotated[
        Role | str, Field(description="Role of the entity that created the message.", title="Role")
    ]
    parts: Annotated[
        list[
            TextPart
            | ToolCallRequestPart
            | ToolCallResponsePart
            | ServerToolCallPart
            | ServerToolCallResponsePart
            | BlobPart
            | FilePart
            | UriPart
            | ReasoningPart
            | GenericPart
        ],
        Field(description="List of message parts that make up the message content.", title="Parts"),
    ]
    name: Annotated[str | None, Field(description="The name of the participant.", title="Name")] = (
        None
    )


class InputMessages(RootModel[list[ChatMessage]]):
    """
    Represents the list of input messages sent to the model.
    """

    root: Annotated[
        list[ChatMessage],
        Field(
            description="Represents the list of input messages sent to the model.",
            title="InputMessages",
        ),
    ]
