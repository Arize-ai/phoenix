import logging
from typing import Any, Dict, List, Type, Union, cast

from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

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

    def generate_text(self, prompt: Union[str, List[Dict[str, Any]]], **kwargs: Any) -> str:
        if self._is_async:
            raise ValueError("Cannot call sync method generate_text() on async Anthropic client.")
        messages = self._build_messages(prompt)
        required_kwargs = {"max_tokens": 4096}  # max_tokens is required for Anthropic
        kwargs = {**required_kwargs, **kwargs}

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
        self, prompt: Union[str, List[Dict[str, Any]]], **kwargs: Any
    ) -> str:
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_text() on sync Anthropic client."
            )
        messages = self._build_messages(prompt)

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
        prompt: Union[str, List[Dict[str, Any]]],
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
        prompt: Union[str, List[Dict[str, Any]]],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_object() on sync Anthropic client."
            )
        self._validate_schema(schema)

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
        prompt: Union[str, List[Dict[str, Any]]],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        messages = self._build_messages(prompt)
        tool_definition = self._schema_to_tool(schema)

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
        prompt: Union[str, List[Dict[str, Any]]],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        messages = self._build_messages(prompt)
        tool_definition = self._schema_to_tool(schema)

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

    def _build_messages(
        self, prompt: Union[str, List[Dict[str, Any]], MultimodalPrompt]
    ) -> list[dict[str, Any]]:
        if isinstance(prompt, str):
            return [{"role": "user", "content": prompt}]

        if isinstance(prompt, list):
            # Already in Anthropic-compatible message format
            return prompt

        # Handle legacy MultimodalPrompt
        text_parts = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                text_parts.append(part.content)

        combined_text = "\n".join(text_parts)
        return [{"role": "user", "content": combined_text}]

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
