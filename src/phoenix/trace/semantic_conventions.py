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


EMBEDDING_EMBEDDINGS_VECTOR = "embedding.embeddings.vector"
"""
The embedding vectors.
"""
EMBEDDING_EMBEDDINGS_TEXT = "embedding.embeddings.text"
"""
In the case of textual data, the pieces of text represented by the embedding vectors.
"""
EMBEDDING_MODEL_NAME = "embedding.model_name"
"""
The name of the embedding model.
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
LLM_MESSAGES = "llm.messages"
"""
Messages (system, user, role) provided to a chat API.
"""
LLM_MODEL_NAME = "llm.model_name"
"""
The name of the model being used.
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
