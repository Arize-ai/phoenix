"""
Data structures and types for the Universal LLM Wrapper system.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Type, TYPE_CHECKING

if TYPE_CHECKING:
    from .base import BaseLLMAdapter


@dataclass
class AdapterRegistration:
    """Registration information for an adapter."""
    adapter_class: Type["BaseLLMAdapter"]
    identifier: Callable[[Any], bool]
    priority: int
    name: str


@dataclass
class ProviderRegistration:
    """Registration information for a provider."""
    provider: str
    adapter_class: Type["BaseLLMAdapter"]
    client_factory: Callable[..., Any]
    dependencies: List[str]


class OutputType(str, Enum):
    """Supported output types from LLM models."""

    TEXT = "text"
    TOOL_CALL = "tool_call"
    STRUCTURED = "structured"


@dataclass
class ToolCall:
    """Represents a tool/function call from the model."""

    name: str
    arguments: Dict[str, Any]
    id: Optional[str] = None


@dataclass
class StructuredOutput:
    """Represents structured/JSON output from the model."""

    data: Dict[str, Any]
    schema: Optional[Dict[str, Any]] = None


@dataclass
class LLMResponse:
    """Unified response object supporting different output types."""

    text: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    structured_output: Optional[StructuredOutput] = None
    raw_response: Optional[Any] = None

    @property
    def output_type(self) -> OutputType:
        """Determine the primary output type of this response."""
        if self.tool_calls:
            return OutputType.TOOL_CALL
        elif self.structured_output:
            return OutputType.STRUCTURED
        else:
            return OutputType.TEXT
