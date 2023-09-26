"""
Semantic conventions for the attributes of a span

Inspiration from OpenTelemetry:
https://opentelemetry.io/docs/specs/otel/trace/semantic_conventions/span-general/
"""
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class AttributeDescription(Dict[str, Any]):
    id: str
    brief: str
    type: str


class AttributeGroup:
    """
    AttributeGroup is a collection of attributes that are
    semantically related to each other
    """

    id: str
    attributes: Dict[str, AttributeDescription]


class DeploymentAttributes(AttributeGroup):
    id = "deployment"
    prefix = "deployment"
    attributes = {
        "environment": AttributeDescription(
            id="deployment.environment",
            brief="The environment where the service is deployed",
            type="string",
        ),
    }


EXCEPTION_TYPE = "exception.type"
EXCEPTION_MESSAGE = "exception.message"
EXCEPTION_ESCAPED = "exception.escaped"
EXCEPTION_STACKTRACE = "exception.stacktrace"


OUTPUT_VALUE = "output.value"
OUTPUT_MIME_TYPE = "output.mime_type"
"""
The type of output.value. If unspecified, the type is plain text by default.
If type is JSON, the value is a string representing a JSON object.
"""
INPUT_VALUE = "input.value"
INPUT_MIME_TYPE = "input.mime_type"
"""
The type of input.value. If unspecified, the type is plain text by default.
If type is JSON, the value is a string representing a JSON object.
"""


class MimeType(Enum):
    TEXT = "text/plain"
    JSON = "application/json"

    @classmethod
    def _missing_(cls, v: Any) -> Optional["MimeType"]:
        return None if v else cls.TEXT


EMBEDDING_EMBEDDINGS = "embedding.embeddings"
"""
A list of objects containing embedding data, including the vector and represented piece of text.
"""
EMBEDDING_MODEL_NAME = "embedding.model_name"
"""
The name of the embedding model.
"""
EMBEDDING_TEXT = "embedding.text"
"""
The text represented by the embedding.
"""
EMBEDDING_VECTOR = "embedding.vector"
"""
The embedding vector.
"""

MESSAGE_ROLE = "message.role"
"""
The role of the message, such as "user", "agent", "function".
"""
MESSAGE_NAME = "message.name"
"""
The name of the message, often used to identify the function
that was used to generate the message.
"""
MESSAGE_FUNCTION_CALL_NAME = "message.function_call_name"
"""
The function name that is a part of the message list.
This is populated for role 'function' or 'agent' as a mechanism to identify
the function that was called during the execution of a tool
"""
MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = "message.function_call_arguments_json"
"""
The JSON string representing the arguments passed to the function
during a function call
"""
MESSAGE_CONTENT = "message.content"
"""
The content of the message to the llm
"""
LLM_FUNCTION_CALL = "llm.function_call"
"""
For models and APIs that support function calling. Records attributes such as the function name and
arguments to the called function.
"""
LLM_INVOCATION_PARAMETERS = "llm.invocation_parameters"
"""
Invocation parameters passed to the LLM or API, such as the model name, temperature, etc.
"""
LLM_INPUT_MESSAGES = "llm.input_messages"
"""
Messages provided to a chat API.
"""
LLM_OUTPUT_MESSAGES = "llm.output_messages"
"""
Messages received from a chat API.
"""
LLM_MODEL_NAME = "llm.model_name"
"""
The name of the model being used.
"""
LLM_PROMPTS = "llm.prompts"
"""
Prompts provided to a completions API.
"""
LLM_PROMPT_TEMPLATE = "llm.prompt_template.template"
"""
The prompt template as a Python f-string.
"""
LLM_PROMPT_TEMPLATE_VARIABLES = "llm.prompt_template.variables"
"""
A list of input variables to the prompt template.
"""
LLM_PROMPT_TEMPLATE_VERSION = "llm.prompt_template.version"
"""
The version of the prompt template being used.
"""
LLM_TOKEN_COUNT_PROMPT = "llm.token_count.prompt"
"""
Number of tokens in the prompt.
"""
LLM_TOKEN_COUNT_COMPLETION = "llm.token_count.completion"
"""
Number of tokens in the completion.
"""
LLM_TOKEN_COUNT_TOTAL = "llm.token_count.total"
"""
Total number of tokens, including both prompt and completion.
"""

TOOL_NAME = "tool.name"
"""
Name of the tool being used.
"""
TOOL_DESCRIPTION = "tool.description"
"""
Description of the tool's purpose, typically used to select the tool.
"""
TOOL_PARAMETERS = "tool.parameters"
"""
Parameters of the tool, e.g. see https://platform.openai.com/docs/guides/gpt/function-calling
"""

RETRIEVAL_DOCUMENTS = "retrieval.documents"
DOCUMENT_ID = "document.id"
DOCUMENT_SCORE = "document.score"
DOCUMENT_CONTENT = "document.content"
DOCUMENT_METADATA = "document.metadata"
"""
Document metadata as a string representing a JSON object
"""
