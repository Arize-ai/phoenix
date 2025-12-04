import logging
from typing import Any, Dict, List, Type, Union, cast

from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

from ...prompts import Message, MessageRole, PromptLike
from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod
from .factories import AnthropicClientWrapper, create_anthropic_client

logger = logging.getLogger(__name__)


def identify_anthropic_client(client: Any) -> bool:
    if isinstance(client, AnthropicClientWrapper):
        return True

    return (
        hasattr(client, "__module__")
        and client.__module__ is not None
        and (
            "anthropic" in client.__module__
            or (hasattr(client, "messages") and hasattr(client.messages, "create"))
        )
    )


def get_anthropic_rate_limit_errors() -> list[Type[Exception]]:
    from anthropic import RateLimitError

    return [RateLimitError]


@register_adapter(
    identifier=identify_anthropic_client,
    name="anthropic",
)
@register_provider(
    provider="anthropic",
    client_factory=create_anthropic_client,
    get_rate_limit_errors=get_anthropic_rate_limit_errors,
    dependencies=["anthropic"],
)
class AnthropicAdapter(BaseLLMAdapter):
    def __init__(self, client: Any, model: str):
        super().__init__(client, model)
        self._validate_client()
        self._is_async = self._check_if_async_client()

    @classmethod
    def client_name(cls) -> str:
        return "anthropic"

    def _validate_client(self) -> None:
        actual_client = getattr(self.client, "client", self.client)
        if not (hasattr(actual_client, "messages") and hasattr(actual_client.messages, "create")):
            raise ValueError(
                "AnthropicAdapter requires an Anthropic client instance with messages.create, got "
                f"{type(self.client)}"
            )

    def _check_if_async_client(self) -> bool:
        actual_client = getattr(self.client, "client", self.client)

        if hasattr(actual_client, "__module__") and actual_client.__module__:
            if "anthropic" in actual_client.__module__:
                class_name = actual_client.__class__.__name__
                return "Async" in class_name

        create_method = actual_client.messages.create
        import inspect

        return inspect.iscoroutinefunction(create_method)

    def generate_text(self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any) -> str:
        if self._is_async:
            raise ValueError("Cannot call sync method generate_text() on async Anthropic client.")
        messages, system = self._build_messages(prompt)
        required_kwargs = {"max_tokens": 4096}  # max_tokens is required for Anthropic
        kwargs = {**required_kwargs, **kwargs}

        # Add system message if present
        if system:
            kwargs["system"] = system

        try:
            response = self.client.messages.create(model=self.model, messages=messages, **kwargs)
            if hasattr(response.content[0], "text"):
                return cast(str, response.content[0].text)
            else:
                raise ValueError(
                    f"Anthropic returned unexpected content format: {response.content}"
                )
        except Exception as e:
            logger.error(f"Anthropic completion failed: {e}")
            raise

    async def async_generate_text(
        self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any
    ) -> str:
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_text() on sync Anthropic client."
            )
        messages, system = self._build_messages(prompt)
        required_kwargs = {"max_tokens": 4096}  # max_tokens is required for Anthropic
        kwargs = {**required_kwargs, **kwargs}

        # Add system message if present
        if system:
            kwargs["system"] = system

        try:
            response = await self.client.messages.create(
                model=self.model, messages=messages, **kwargs
            )
            if hasattr(response.content[0], "text"):
                return cast(str, response.content[0].text)
            else:
                raise ValueError("Anthropic returned unexpected content format")
        except Exception as e:
            logger.error(f"Anthropic async completion failed: {e}")
            raise

    def generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        if self._is_async:
            raise ValueError(
                "Cannot call sync method generate_object() on async Anthropic client. "
                "Use async_generate_object() instead or provide a sync Anthropic client."
            )
        self._validate_schema(schema)

        required_kwargs = {"max_tokens": 4096}  # max_tokens is required for Anthropic
        kwargs = {**required_kwargs, **kwargs}

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            raise ValueError(
                "Anthropic does not support native structured output. Use TOOL_CALLING or AUTO."
            )

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return self._generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
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
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_object() on sync Anthropic client."
            )
        self._validate_schema(schema)

        required_kwargs = {"max_tokens": 4096}  # max_tokens is required for Anthropic
        kwargs = {**required_kwargs, **kwargs}

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            raise ValueError(
                "Anthropic does not support native structured output. Use TOOL_CALLING or AUTO."
            )
        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)
        elif method == ObjectGenerationMethod.AUTO:
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)

    def _generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        messages, system = self._build_messages(prompt)
        tool_definition = self._schema_to_tool(schema)

        # Add system message if present
        if system:
            kwargs["system"] = system

        response = self.client.messages.create(
            model=self.model,
            messages=messages,
            tools=[tool_definition],
            tool_choice={"type": "tool", "name": "extract_structured_data"},
            **kwargs,
        )

        for content_block in response.content:
            if hasattr(content_block, "type") and content_block.type == "tool_use":
                return cast(Dict[str, Any], content_block.input)

        raise ValueError("No tool use in response")

    async def _async_generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        messages, system = self._build_messages(prompt)
        tool_definition = self._schema_to_tool(schema)

        # Add system message if present
        if system:
            kwargs["system"] = system

        response = await self.client.messages.create(
            model=self.model,
            messages=messages,
            tools=[tool_definition],
            tool_choice={"type": "tool", "name": "extract_structured_data"},
            **kwargs,
        )

        for content_block in response.content:
            if hasattr(content_block, "type") and content_block.type == "tool_use":
                return cast(Dict[str, Any], content_block.input)

        raise ValueError("No tool use in response")

    def _schema_to_tool(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        description = schema.get("description", "Respond in a format matching the provided schema")

        tool_definition = {
            "name": "extract_structured_data",
            "description": description,
            "input_schema": schema,
        }

        return tool_definition

    def _extract_text_from_content(self, content: Any) -> str:
        """Extract text from content, handling both string and structured content.

        Args:
            content: Either a string, a list of ContentPart dictionaries, or None.

        Returns:
            Extracted text content, joined with newlines if multiple parts. Returns empty string
            if content is None or empty.
        """
        if content is None:
            return ""

        if isinstance(content, str):
            return content

        # Extract text from TextContentPart items only
        text_parts = []
        for part in content:
            if part.get("type") == "text" and "text" in part:
                text_parts.append(part["text"])

        # Join all text parts with newlines
        return "\n".join(text_parts)

    def _transform_messages_to_anthropic(self, messages: List[Message]) -> list[dict[str, Any]]:
        """Transform List[Message] TypedDict to Anthropic message format.

        Note: System messages are NOT included in the returned messages.
        They should be extracted separately and passed as the 'system' parameter.

        Args:
            messages: List of Message TypedDicts with MessageRole enum.

        Returns:
            List of Anthropic-formatted message dicts (excluding system messages).
        """
        anthropic_messages: list[dict[str, Any]] = []

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            # Skip system messages - they should be handled separately
            if role == MessageRole.SYSTEM:
                continue

            # Map MessageRole enum to Anthropic role strings
            if role == MessageRole.AI:
                anthropic_role = "assistant"
            elif role == MessageRole.USER:
                anthropic_role = "user"
            else:
                # Fallback
                anthropic_role = role.value if isinstance(role, MessageRole) else str(role)

            # Handle content - can be string or List[ContentPart]
            text_content = self._extract_text_from_content(content)
            anthropic_messages.append({"role": anthropic_role, "content": text_content})

        return anthropic_messages

    def _build_messages(
        self, prompt: Union[PromptLike, MultimodalPrompt]
    ) -> tuple[list[dict[str, Any]], str]:
        """Build messages for Anthropic API.

        Returns:
            Tuple of (messages, system_content) where system_content is extracted system messages
        """
        if isinstance(prompt, str):
            return [{"role": "user", "content": prompt}], ""

        if isinstance(prompt, list):
            # Check if this is List[Message] with MessageRole enum
            if prompt and isinstance(prompt[0].get("role"), MessageRole):
                # Extract system messages first
                messages_typed = cast(List[Message], prompt)
                system_messages = [
                    msg for msg in messages_typed if msg["role"] == MessageRole.SYSTEM
                ]
                system_content = "\n".join(
                    self._extract_text_from_content(msg["content"]) for msg in system_messages
                )
                # Transform List[Message] to Anthropic format (excludes system messages)
                anthropic_messages = self._transform_messages_to_anthropic(messages_typed)
                return anthropic_messages, system_content

            # Otherwise, plain dict format - extract system messages
            system_messages_dicts: List[Dict[str, Any]] = [
                msg for msg in cast(List[Dict[str, Any]], prompt) if msg.get("role") == "system"
            ]
            non_system_messages_dicts: List[Dict[str, Any]] = [
                msg for msg in cast(List[Dict[str, Any]], prompt) if msg.get("role") != "system"
            ]
            system_content = "\n".join(
                self._extract_text_from_content(msg.get("content", ""))
                for msg in system_messages_dicts
            )
            return non_system_messages_dicts, system_content

        # Handle legacy MultimodalPrompt
        if isinstance(prompt, MultimodalPrompt):
            text_parts = []
            for part in prompt.parts:
                if part.content_type == PromptPartContentType.TEXT:
                    text_parts.append(part.content)

            combined_text = "\n".join(text_parts)
            return [{"role": "user", "content": combined_text}], ""

        # If we get here, prompt is an unexpected type
        raise ValueError(
            f"Expected prompt to be str, list, or MultimodalPrompt, got {type(prompt).__name__}"
        )

    def _validate_schema(self, schema: Dict[str, Any]) -> None:
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
