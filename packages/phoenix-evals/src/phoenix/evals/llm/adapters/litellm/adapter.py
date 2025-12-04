import base64
import json
import logging
from typing import Any, Dict, List, Type, Union, cast
from urllib.parse import urlparse

from phoenix.evals.exceptions import PhoenixUnsupportedAudioFormat
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType
from phoenix.evals.utils import SUPPORTED_AUDIO_FORMATS, get_audio_format_from_base64

from ...prompts import Message, MessageRole, PromptLike
from ...registries import register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod
from .client import LiteLLMClient
from .factories import (
    create_anthropic_client,
    create_bedrock_client,
    create_litellm_client,
    create_openai_client,
    create_vertex_client,
)

logger = logging.getLogger(__name__)


def get_litellm_rate_limit_errors() -> list[Type[Exception]]:
    from litellm import RateLimitError as LiteLLMRateLimitError

    return [LiteLLMRateLimitError]


@register_provider(
    provider="openai",
    client_factory=create_openai_client,
    get_rate_limit_errors=get_litellm_rate_limit_errors,
    dependencies=["litellm"],
)
@register_provider(
    provider="anthropic",
    client_factory=create_anthropic_client,
    get_rate_limit_errors=get_litellm_rate_limit_errors,
    dependencies=["litellm"],
)
@register_provider(
    provider="vertex",
    client_factory=create_vertex_client,
    get_rate_limit_errors=get_litellm_rate_limit_errors,
    dependencies=["litellm"],
)
@register_provider(
    provider="bedrock",
    client_factory=create_bedrock_client,
    get_rate_limit_errors=get_litellm_rate_limit_errors,
    dependencies=["litellm", "boto3"],
)
@register_provider(
    provider="litellm",
    client_factory=create_litellm_client,
    get_rate_limit_errors=get_litellm_rate_limit_errors,
    dependencies=["litellm"],
)
class LiteLLMAdapter(BaseLLMAdapter):
    def __init__(self, client: LiteLLMClient, model: str):
        super().__init__(client, model)
        self._validate_client()
        self._import_litellm()

    @classmethod
    def client_name(cls) -> str:
        return "litellm"

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

    def generate_text(self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any) -> str:
        """Generate text using LiteLLM."""
        messages = self._build_messages(prompt)

        try:
            response = self._litellm.completion(  # pyright: ignore
                model=self.client.model_string, messages=messages, **kwargs
            )
            content = response.choices[0].message.content  # pyright: ignore
            if content is None:
                raise ValueError("LiteLLM returned None content")
            return cast(str, content)
        except Exception as e:
            logger.error(f"LiteLLM completion failed: {e}")
            raise

    async def async_generate_text(
        self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any
    ) -> str:
        """Async text generation using LiteLLM."""
        messages = self._build_messages(prompt)

        try:
            response = await self._litellm.acompletion(  # pyright: ignore
                model=self.client.model_string, messages=messages, **kwargs
            )
            content = response.choices[0].message.content  # pyright: ignore
            if content is None:
                raise ValueError("LiteLLM returned None content")
            return cast(str, content)
        except Exception as e:
            logger.error(f"LiteLLM async completion failed: {e}")
            raise

    def generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        self._validate_schema(schema)

        try:
            supported_params = getattr(
                self._litellm,
                "get_supported_openai_params",
                lambda model: ["response_format", "tools"],
            )(model=self.client.model)
            supported_params_list = (
                supported_params
                if isinstance(supported_params, list)
                else ["response_format", "tools"]
            )
        except Exception:
            supported_params_list = ["response_format", "tools"]

        supports_structured_output = "response_format" in supported_params_list
        supports_tool_calls = "tools" in supported_params_list

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            if not supports_structured_output:
                raise ValueError(
                    f"LiteLLM model {self.client.model} does not support structured output"
                )
            return self._generate_with_structured_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            if not supports_tool_calls:
                raise ValueError(f"LiteLLM model {self.client.model} does not support tool calls")
            return self._generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            if not supports_structured_output and not supports_tool_calls:
                raise ValueError(
                    f"LiteLLM model {self.client.model} does not support structured "
                    "output or tool calls"
                )
            # Prefer structured output when available
            if supports_structured_output:
                return self._generate_with_structured_output(prompt, schema, **kwargs)
            else:
                return self._generate_with_tool_calling(prompt, schema, **kwargs)

        else:
            raise ValueError(f"Unsupported object generation method: {method}")

    async def async_generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        self._validate_schema(schema)

        try:
            supported_params = getattr(
                self._litellm,
                "get_supported_openai_params",
                lambda model: ["response_format", "tools"],
            )(model=self.client.model)
            supported_params_list = (
                supported_params
                if isinstance(supported_params, list)
                else ["response_format", "tools"]
            )
        except Exception:
            # If the function doesn't exist or fails, assume both are supported
            supported_params_list = ["response_format", "tools"]

        supports_structured_output = "response_format" in supported_params_list
        supports_tool_calls = "tools" in supported_params_list

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            if not supports_structured_output:
                raise ValueError(
                    f"LiteLLM model {self.client.model} does not support structured output"
                )
            return await self._async_generate_with_structured_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            if not supports_tool_calls:
                raise ValueError(f"LiteLLM model {self.client.model} does not support tool calls")
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            if not supports_structured_output and not supports_tool_calls:
                raise ValueError(
                    f"LiteLLM model {self.client.model} does not support structured "
                    "output or tool calls"
                )
            # Prefer structured output when available
            if supports_structured_output:
                return await self._async_generate_with_structured_output(prompt, schema, **kwargs)
            else:
                return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)

        else:
            raise ValueError(f"Unsupported object generation method: {method}")

    def _generate_with_structured_output(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate object using structured output."""
        formatted_schema = self._ensure_additional_properties_false(schema)

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "extract_structured_data",
                "schema": formatted_schema,
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
        return cast(Dict[str, Any], json.loads(content))

    def _generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate object using tool calling."""
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
            return cast(Dict[str, Any], json.loads(arguments))
        else:
            return cast(Dict[str, Any], arguments)

    async def _async_generate_with_structured_output(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Async generate object using structured output."""
        formatted_schema = self._ensure_additional_properties_false(schema)

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "extract_structured_data",
                "schema": formatted_schema,
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
        return cast(Dict[str, Any], json.loads(content))

    async def _async_generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Async generate object using tool calling."""
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
            return cast(Dict[str, Any], json.loads(arguments))
        else:
            return cast(Dict[str, Any], arguments)

    @property
    def model_name(self) -> str:
        """Return the LiteLLM model name."""
        return cast(str, self.client.model_string)

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

    def _transform_messages_to_openai(self, messages: List[Message]) -> list[dict[str, Any]]:
        """Transform List[Message] TypedDict to OpenAI/LiteLLM format.

        LiteLLM uses OpenAI message format and handles provider-specific conversions internally.

        Args:
            messages: List of Message TypedDicts with MessageRole enum.

        Returns:
            List of OpenAI-formatted message dicts.
        """
        openai_messages: list[dict[str, Any]] = []

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            # Map MessageRole enum to OpenAI role strings
            if role == MessageRole.AI:
                openai_role = "assistant"
            elif role == MessageRole.USER:
                openai_role = "user"
            elif role == MessageRole.SYSTEM:
                openai_role = "system"
            else:
                # Fallback for any unexpected roles
                openai_role = role.value if isinstance(role, MessageRole) else str(role)

            # Handle content - can be string or List[ContentPart]
            if isinstance(content, str):
                openai_messages.append({"role": openai_role, "content": content})
            else:
                # Extract text from TextContentPart items only
                text_parts = []
                for part in content:
                    if part.get("type") == "text" and "text" in part:
                        text_parts.append(part["text"])

                # Join all text parts with newlines
                combined_text = "\n".join(text_parts)
                openai_messages.append({"role": openai_role, "content": combined_text})

        return openai_messages

    def _build_messages(self, prompt: Union[PromptLike, MultimodalPrompt]) -> list[dict[str, Any]]:
        if isinstance(prompt, str):
            return [{"role": "user", "content": prompt}]

        if isinstance(prompt, list):
            # Check if this is List[Message] with MessageRole enum
            if prompt and isinstance(prompt[0].get("role"), MessageRole):
                # Transform List[Message] to OpenAI format
                return self._transform_messages_to_openai(cast(List[Message], prompt))
            # Already in OpenAI message format (backward compatibility)
            return cast(list[dict[str, Any]], prompt)

        # Handle legacy MultimodalPrompt
        messages: list[dict[str, Any]] = []
        if isinstance(prompt, MultimodalPrompt):
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

        # If we get here, prompt is an unexpected type
        raise ValueError(
            f"Expected prompt to be str, list, or MultimodalPrompt, got {type(prompt).__name__}"
        )

    def _ensure_additional_properties_false(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensure that additionalProperties is set to false for structured output.

        This normalization ensures compatibility with OpenAI's structured output API
        requirements and is generally harmless for other providers.

        Args:
            schema: The original JSON schema

        Returns:
            Schema with additionalProperties: false added where needed
        """
        import json

        # Use JSON serialization for deep copy to avoid type issues
        schema_str = json.dumps(schema)
        formatted_schema = json.loads(schema_str)

        def add_additional_properties_false(obj: Any) -> None:
            if isinstance(obj, dict):
                # If this is an object type, ensure additionalProperties is false
                if obj.get("type") == "object" and "additionalProperties" not in obj:  # pyright: ignore
                    obj["additionalProperties"] = False  # pyright: ignore

                # Recursively process nested objects
                for value in obj.values():  # pyright: ignore
                    add_additional_properties_false(value)

            elif isinstance(obj, list):
                for item in obj:  # pyright: ignore
                    add_additional_properties_false(item)

        add_additional_properties_false(formatted_schema)

        # Ensure the root level has additionalProperties: false if it's an object
        if (
            formatted_schema.get("type") == "object"
            and "additionalProperties" not in formatted_schema
        ):
            formatted_schema["additionalProperties"] = False

        return cast(Dict[str, Any], formatted_schema)

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
