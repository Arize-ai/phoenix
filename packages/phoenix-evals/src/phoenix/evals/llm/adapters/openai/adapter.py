import base64
import json
import logging
from typing import Any, Dict, List, Type, Union, cast
from urllib.parse import urlparse

from phoenix.evals.exceptions import PhoenixUnsupportedAudioFormat
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType
from phoenix.evals.utils import SUPPORTED_AUDIO_FORMATS, get_audio_format_from_base64

from ...prompts import Message, MessageRole, PromptLike
from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod
from .factories import OpenAIClientWrapper, create_azure_openai_client, create_openai_client

logger = logging.getLogger(__name__)


def identify_openai_client(client: Any) -> bool:
    if isinstance(client, OpenAIClientWrapper):
        return True

    return (
        hasattr(client, "__module__")
        and client.__module__ is not None
        and (
            "openai" in client.__module__
            or (hasattr(client, "chat") and hasattr(client.chat, "completions"))
        )
    )


def get_openai_rate_limit_errors() -> list[Type[Exception]]:
    from openai import RateLimitError as OpenAIRateLimitError

    return [OpenAIRateLimitError]


@register_adapter(
    identifier=identify_openai_client,
    name="openai",
)
@register_provider(
    provider="openai",
    client_factory=create_openai_client,
    get_rate_limit_errors=get_openai_rate_limit_errors,
    dependencies=["openai"],
)
@register_provider(
    provider="azure",
    client_factory=create_azure_openai_client,
    get_rate_limit_errors=get_openai_rate_limit_errors,
    dependencies=["openai"],
)
class OpenAIAdapter(BaseLLMAdapter):
    def __init__(self, client: Any, model: str):
        super().__init__(client, model)
        self._validate_client()
        self._is_async = self._check_if_async_client()

    @classmethod
    def client_name(cls) -> str:
        return "openai"

    def _validate_client(self) -> None:
        actual_client = getattr(self.client, "client", self.client)
        if not (hasattr(actual_client, "chat") and hasattr(actual_client.chat, "completions")):
            raise ValueError(
                "OpenAIAdapter requires an OpenAI client instance with chat.completions, got "
                f"{type(self.client)}"
            )

    def _check_if_async_client(self) -> bool:
        actual_client = getattr(self.client, "client", self.client)

        if hasattr(actual_client, "__module__") and actual_client.__module__:
            if "openai" in actual_client.__module__:
                class_name = actual_client.__class__.__name__
                return "Async" in class_name

        create_method = actual_client.chat.completions.create
        import inspect

        return inspect.iscoroutinefunction(create_method)

    def generate_text(self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any) -> str:
        """Generate text using OpenAI client."""
        if self._is_async:
            raise ValueError("Cannot call sync method generate_text() on async OpenAI client.")
        messages = self._build_messages(prompt)

        try:
            response = self.client.chat.completions.create(
                model=self.model_name, messages=messages, **kwargs
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("OpenAI returned None content")
            return cast(str, content)
        except Exception as e:
            logger.error(f"OpenAI completion failed: {e}")
            raise

    async def async_generate_text(
        self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any
    ) -> str:
        """Async text generation using OpenAI client."""
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_text() on sync OpenAI client."
            )
        messages = self._build_messages(prompt)

        try:
            response = await self.client.chat.completions.create(
                model=self.model_name, messages=messages, **kwargs
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("OpenAI returned None content")
            return cast(str, content)
        except Exception as e:
            logger.error(f"OpenAI async completion failed: {e}")
            raise

    def generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate structured output using OpenAI client."""
        if self._is_async:
            raise ValueError(
                "Cannot call sync method generate_object() on async OpenAI client. "
                "Use async_generate_object() instead or provide a sync OpenAI client."
            )
        self._validate_schema(schema)

        supports_structured_output = self._supports_structured_output()
        supports_tool_calls = self._supports_tool_calls()

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            if not supports_structured_output:
                raise ValueError(
                    f"OpenAI model {self.model_name} does not support structured output"
                )
            return self._generate_with_structured_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            if not supports_tool_calls:
                raise ValueError(f"OpenAI model {self.model_name} does not support tool calls")
            return self._generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            if not supports_structured_output and not supports_tool_calls:
                raise ValueError(
                    f"OpenAI model {self.model_name} does not support structured "
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
        """Async structured output generation using OpenAI client."""
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_object() on sync OpenAI client."
            )
        self._validate_schema(schema)

        supports_structured_output = self._supports_structured_output()
        supports_tool_calls = self._supports_tool_calls()

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            if not supports_structured_output:
                raise ValueError(
                    f"OpenAI model {self.model_name} does not support structured output"
                )
            return await self._async_generate_with_structured_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            if not supports_tool_calls:
                raise ValueError(f"OpenAI model {self.model_name} does not support tool calls")
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            if not supports_structured_output and not supports_tool_calls:
                raise ValueError(
                    f"OpenAI model {self.model_name} does not support structured "
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
        messages = self._build_messages(prompt)
        formatted_schema = self._ensure_additional_properties_false(schema)

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "extract_structured_data",
                "schema": formatted_schema,
                "strict": True,
            },
        }
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            response_format=response_format,
            **kwargs,
        )
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("OpenAI returned no content")
        return cast(Dict[str, Any], json.loads(content))

    def _generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate object using tool calling."""
        messages = self._build_messages(prompt)
        tool_definition = self._schema_to_tool(schema)

        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            tools=[tool_definition],
            tool_choice={
                "type": "function",
                "function": {"name": "extract_structured_data"},
            },
            **kwargs,
        )

        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls:
            raise ValueError("No tool calls in response")

        tool_call = tool_calls[0]
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
        messages = self._build_messages(prompt)
        formatted_schema = self._ensure_additional_properties_false(schema)

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "extract_structured_data",
                "schema": formatted_schema,
                "strict": True,
            },
        }
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            response_format=response_format,
            **kwargs,
        )
        content = response.choices[0].message.content
        if content is None:
            raise ValueError("OpenAI returned no content")
        return cast(Dict[str, Any], json.loads(content))

    async def _async_generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Async generate object using tool calling."""
        messages = self._build_messages(prompt)
        tool_definition = self._schema_to_tool(schema)

        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            tools=[tool_definition],
            tool_choice={
                "type": "function",
                "function": {"name": "extract_structured_data"},
            },
            **kwargs,
        )

        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls:
            raise ValueError("No tool calls in response")

        tool_call = tool_calls[0]
        arguments = tool_call.function.arguments
        if isinstance(arguments, str):
            return cast(Dict[str, Any], json.loads(arguments))
        else:
            return cast(Dict[str, Any], arguments)

    @property
    def model_name(self) -> str:
        if hasattr(self.client, "model"):
            return str(self.client.model)
        elif hasattr(self.client, "_default_params") and "model" in self.client._default_params:
            return str(self.client._default_params["model"])
        else:
            return "openai-model"

    def _supports_structured_output(self) -> bool:
        model_name = self.model_name.lower()
        structured_output_models = ["gpt-4o", "gpt-4o-mini", "gpt-4o-2024", "chatgpt-4o-latest"]
        return any(model in model_name for model in structured_output_models)

    def _supports_tool_calls(self) -> bool:
        model_name = self.model_name.lower()
        if any(model in model_name for model in ["o1-preview", "o1-mini", "o1", "o3"]):
            return False
        return True

    def _schema_to_tool(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a JSON schema to a tool definition for OpenAI.

        Args:
            schema: JSON schema defining the expected structure

        Returns:
            Tool definition in OpenAI format
        """
        description = schema.get(
            "description", "Extract structured data according to the provided schema"
        )

        tool_definition = {
            "type": "function",
            "function": {
                "name": "extract_structured_data",
                "description": description,
                "parameters": schema,
            },
        }

        return tool_definition

    def _system_role(self) -> str:
        # OpenAI uses different semantics for "system" roles for different models
        if "gpt" in self.model_name:
            return "system"
        if "o1-mini" in self.model_name:
            return "user"  # o1-mini does not support either "system" or "developer" roles
        if "o1-preview" in self.model_name:
            return "user"  # o1-preview does not support "system" or "developer" roles
        if "o1" in self.model_name:
            return "developer"
        if "o3" in self.model_name:
            return "developer"
        return "system"

    def _transform_messages_to_openai(self, messages: List[Message]) -> list[dict[str, Any]]:
        """Transform List[Message] TypedDict to OpenAI message format.

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
                openai_role = self._system_role()
            else:
                # Fallback for any unexpected roles
                openai_role = role.value if isinstance(role, MessageRole) else str(role)

            # Handle content - can be string or List[ContentPart]
            if isinstance(content, str):
                openai_messages.append({"role": openai_role, "content": content})
            else:
                # Extract text from TextContentPart items only
                # For now, skip image_url parts (as per plan)
                text_parts = []
                for part in content:
                    if part.get("type") == "text" and "text" in part:
                        text_parts.append(part["text"])

                # Join all text parts with newlines
                combined_text = "\n".join(text_parts)
                openai_messages.append({"role": openai_role, "content": combined_text})

        return openai_messages

    def _build_messages(self, prompt: Union[PromptLike, MultimodalPrompt]) -> list[dict[str, Any]]:
        """Build messages for OpenAI API from prompt."""
        if isinstance(prompt, str):
            return [{"role": "user", "content": prompt}]

        if isinstance(prompt, list):
            # Check if this is List[Message] with MessageRole enum
            if prompt and isinstance(prompt[0].get("role"), MessageRole):
                # Transform List[Message] to OpenAI format
                return self._transform_messages_to_openai(cast(List[Message], prompt))
            # Otherwise, already in OpenAI message format (backward compatibility)
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
                                        "format": format,
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
        Ensure that additionalProperties is set to false for OpenAI structured output.

        OpenAI's structured output API requires additionalProperties: false to be
        explicitly set on all object types in the schema.

        Args:
            schema: The original JSON schema

        Returns:
            Schema with additionalProperties: false added where needed
        """
        import json

        schema_str = json.dumps(schema)
        formatted_schema = json.loads(schema_str)

        def add_additional_properties_false(obj: Any) -> None:
            if isinstance(obj, dict):
                if obj.get("type") == "object" and "additionalProperties" not in obj:  # pyright: ignore
                    obj["additionalProperties"] = False  # pyright: ignore

                for value in obj.values():  # pyright: ignore
                    add_additional_properties_false(value)

            elif isinstance(obj, list):
                for item in obj:  # pyright: ignore
                    add_additional_properties_false(item)

        add_additional_properties_false(formatted_schema)

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
        if not schema:
            raise ValueError(f"Schema must be a non-empty dictionary, got {type(schema)}")

        properties = schema.get("properties", {})
        required = schema.get("required", [])

        if properties and required:
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
    """Check if a string is a valid URL.

    Args:
        url (str): The string to check for URL validity.

    Returns:
        bool: True if the string is a valid URL with scheme and netloc, False otherwise.
    """
    parsed_url = urlparse(url)
    return bool(parsed_url.scheme and parsed_url.netloc)


def _is_base64(s: str) -> bool:
    """Check if a string is valid base64.

    Args:
        s (str): The string to check for base64 validity.

    Returns:
        bool: True if the string is valid base64, False otherwise.
    """
    try:
        base64.b64decode(s, validate=True)
        return True
    except Exception:
        return False
