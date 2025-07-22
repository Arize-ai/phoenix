import base64
import json
import logging
from typing import Any, Dict, Optional, Union
from urllib.parse import urlparse

from phoenix.evals.exceptions import PhoenixUnsupportedAudioFormat
from phoenix.evals.templates import MultimodalPrompt, PromptPartContentType
from phoenix.evals.utils import SUPPORTED_AUDIO_FORMATS, get_audio_format_from_base64

from ...registries import register_provider
from ...types import BaseLLMAdapter
from .client import LiteLLMClient
from .factories import (
    create_anthropic_client,
    create_litellm_client,
    create_openai_client,
)

logger = logging.getLogger(__name__)


@register_provider(
    provider="anthropic", client_factory=create_anthropic_client, dependencies=["litellm"]
)
@register_provider(provider="openai", client_factory=create_openai_client, dependencies=["litellm"])
@register_provider(
    provider="litellm", client_factory=create_litellm_client, dependencies=["litellm"]
)
class LiteLLMAdapter(BaseLLMAdapter):
    """Adapter for LiteLLM function-based interface."""

    def __init__(self, client: LiteLLMClient):
        self.client = client
        self._validate_client()
        self._import_litellm()

    def _validate_client(self) -> None:
        """Validate that the client is a LiteLLMClient."""
        if not isinstance(self.client, LiteLLMClient):
            raise ValueError(
                f"LiteLLMAdapter requires a LiteLLMClient instance, got {type(self.client)}"
            )

    def _import_litellm(self) -> None:
        """Initialize LiteLLM library."""
        try:
            import litellm

            self._litellm = litellm
        except ImportError:
            raise ImportError("LiteLLM package not installed. Run: pip install litellm")

    def generate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Generate text using LiteLLM."""
        # Convert multimodal prompt to text
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        # Build messages for LiteLLM
        messages = []
        if instruction:
            messages.append({"role": "system", "content": instruction})
        messages.append({"role": "user", "content": prompt_text})

        # Merge client config with call-specific kwargs
        call_kwargs = {**self.client.config, **kwargs}

        try:
            response = self._litellm.completion(  # pyright: ignore
                model=self.client.model_string, messages=messages, **call_kwargs
            )
            content = response.choices[0].message.content  # pyright: ignore
            if content is None:
                raise ValueError("LiteLLM returned None content")
            return content
        except Exception as e:
            logger.error(f"LiteLLM completion failed: {e}")
            raise

    async def agenerate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Async text generation using LiteLLM."""
        # Convert multimodal prompt to text
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        # Build messages for LiteLLM
        messages = []
        if instruction:
            messages.append({"role": "system", "content": instruction})
        messages.append({"role": "user", "content": prompt_text})

        # Merge client config with call-specific kwargs
        call_kwargs = {**self.client.config, **kwargs}

        try:
            response = await self._litellm.acompletion(  # pyright: ignore
                model=self.client.model_string, messages=messages, **call_kwargs
            )
            content = response.choices[0].message.content  # pyright: ignore
            if content is None:
                raise ValueError("LiteLLM returned None content")
            return content
        except Exception as e:
            logger.error(f"LiteLLM async completion failed: {e}")
            raise

    def generate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        supported_params = self._litellm.get_supported_openai_params(model=self.client.model)
        supports_structured_output = "response_format" in supported_params
        supports_tool_calls = "tools" in supported_params

        if not supports_structured_output and not supports_tool_calls:
            raise ValueError(
                f"LiteLLM model {self.client.model} does not support structured "
                "output or tool calls"
            )

        if supports_structured_output:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": "extract_structured_data",
                    "schema": schema,
                    "strict": True,
                },
            }
            messages = self._build_messages(prompt)
            response = self._litellm.completion(  # pyright: ignore
                model=self.client.model_string,
                messages=messages,
                response_format=response_format,
                **kwargs,
            )
            content = response.choices[0].message.content  # pyright: ignore
            if content is None:
                raise ValueError("LiteLLM returned no content")
            return json.loads(content)
        else:
            tool_definition = self._schema_to_tool(schema)
            messages = self._build_messages(prompt)

            response = self._litellm.completion(
                model=self.client.model_string,
                messages=messages,
                tools=[tool_definition],
                tool_choice={"type": "function", "function": {"name": "extract_structured_data"}},
                **kwargs,
            )

            tool_call = response.choices[0].message.tool_calls[0]
            arguments = tool_call.function.arguments
            if isinstance(arguments, str):
                return json.loads(arguments)
            else:
                return arguments

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        supported_params = self._litellm.get_supported_openai_params(model=self.client.model)
        supports_structured_output = "response_format" in supported_params
        supports_tool_calls = "tools" in supported_params

        if not supports_structured_output and not supports_tool_calls:
            raise ValueError(
                f"LiteLLM model {self.client.model} does not support structured "
                "output or tool calls"
            )

        if supports_structured_output:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": "extract_structured_data",
                    "schema": schema,
                    "strict": True,
                },
            }
            messages = self._build_messages(prompt)
            response = await self._litellm.acompletion(  # pyright: ignore
                model=self.client.model_string,
                messages=messages,
                response_format=response_format,
                **kwargs,
            )
            content = response.choices[0].message.content  # pyright: ignore
            if content is None:
                raise ValueError("LiteLLM returned no content")
            return json.loads(content)
        else:
            tool_definition = self._schema_to_tool(schema)
            messages = self._build_messages(prompt)

            response = await self._litellm.acompletion(
                model=self.client.model_string,
                messages=messages,
                tools=[tool_definition],
                tool_choice={"type": "function", "function": {"name": "extract_structured_data"}},
                **kwargs,
            )

            tool_call = response.choices[0].message.tool_calls[0]
            arguments = tool_call.function.arguments
            if isinstance(arguments, str):
                return json.loads(arguments)
            else:
                return arguments

    @property
    def model_name(self) -> str:
        """Return the LiteLLM model name."""
        return self.client.model_string

    def _schema_to_tool(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a JSON schema to a tool definition for LiteLLM.

        Args:
            schema: JSON schema defining the expected structure

        Returns:
            Tool definition in OpenAI format for LiteLLM
        """
        # Create tool description from schema
        description = schema.get(
            "description", "Extract structured data according to the provided schema"
        )

        # Build the tool definition
        tool_definition = {
            "type": "function",
            "function": {
                "name": "extract_structured_data",
                "description": description,
                "parameters": schema,
            },
        }

        return tool_definition

    def _build_messages(self, prompt: Union[str, MultimodalPrompt]) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        if isinstance(prompt, str):
            return [{"role": "user", "content": prompt}]
        else:
            for part in prompt.parts:
                if part.content_type == PromptPartContentType.TEXT:
                    messages.append({"role": "user", "content": part.content})
                elif part.content_type == PromptPartContentType.AUDIO:
                    format = str(get_audio_format_from_base64(part.content))
                    if format not in SUPPORTED_AUDIO_FORMATS:
                        raise PhoenixUnsupportedAudioFormat(f"Unsupported audio format: {format}")
                    messages.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_audio",
                                    "input_audio": {
                                        "data": part.content,
                                        "format": str(get_audio_format_from_base64(part.content)),
                                    },
                                }
                            ],
                        }
                    )
                elif part.content_type == PromptPartContentType.IMAGE:
                    if _is_base64(part.content):
                        content_url = f"data:image/jpeg;base64,{part.content}"
                    elif _is_url(part.content):
                        content_url = part.content
                    else:
                        raise ValueError("Only base64 encoded images or image URLs are supported")
                    messages.append(
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {"url": content_url},
                                }
                            ],
                        }
                    )
                else:
                    raise ValueError(f"Unsupported content type: {part.content_type}")
        return messages

    def _validate_schema(self, schema: Dict[str, Any]) -> None:
        """
        Validate that the schema is well-formed.

        Checks for common issues like required fields not matching properties.
        """
        if not isinstance(schema, dict):  # pyright: ignore
            raise ValueError(f"Schema must be a dictionary, got {type(schema)}")

        # Check if schema has properties and required fields
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        if properties and required:
            # Check that all required fields exist in properties
            property_names = set(properties.keys())
            required_names = set(required)

            missing_properties = required_names - property_names
            if missing_properties:
                raise ValueError(
                    f"Schema validation error: Required fields {list(missing_properties)} "
                    f"are not defined in properties. "
                    f"Properties: {list(property_names)}, Required: {list(required_names)}"
                )


def _is_url(url: str) -> bool:
    parsed_url = urlparse(url)
    return bool(parsed_url.scheme and parsed_url.netloc)


def _is_base64(s: str) -> bool:
    try:
        base64.b64decode(s, validate=True)
        return True
    except Exception:
        return False
