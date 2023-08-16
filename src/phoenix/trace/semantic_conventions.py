"""
Semantic conventions for the attributes of a span

Inspiration from OpenTelemetry:
https://opentelemetry.io/docs/specs/otel/trace/semantic_conventions/span-general/
"""
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict


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
    TEXT = "text"
    JSON = "json"


LLM_VENDOR = "llm.vendor"
LLM_MODEL_NAME = "llm.model_name"
LLM_INVOCATION_PARAMETERS = "llm.invocation_parameters"
LLM_PROMPT_TOKENS = "llm.prompt_tokens"
LLM_COMPLETION_TOKENS = "llm.completion_tokens"
LLM_TOTAL_TOKENS = "llm.total_tokens"
LLM_PROMPT_TEMPLATE = "llm.prompt_template.template"
LLM_PROMPT_TEMPLATE_VARIABLES = "llm.prompt_template.variables"
LLM_PROMPT_TEMPLATE_VERSION = "llm.prompt_template.version"
LLM_FUNCTION_CALL = "llm.function_call"
