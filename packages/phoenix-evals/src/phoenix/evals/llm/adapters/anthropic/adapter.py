import copy
import json
import logging
from typing import Any, Dict, List, Type, cast

from ...prompts import (
    Message,
    MessageRole,
    PromptLike,
    classify_message_list_kind,
    normalize_role,
    validate_message_dict,
)
from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod
from ..tool_calling import TOOL_INSTRUCTION, TOOL_NAME
from .factories import AnthropicClientWrapper, create_anthropic_client

logger = logging.getLogger(__name__)


def _with_tool_instruction(system: Any) -> Any:
    if isinstance(system, list):
        return [*system, {"type": "text", "text": TOOL_INSTRUCTION}]
    return f"{system}\n\n{TOOL_INSTRUCTION}" if system else TOOL_INSTRUCTION


# Phrases in a 400 error that mean the model or endpoint doesn't accept native structured output,
# as opposed to a request that is wrong in some other way.
_NATIVE_OUTPUT_REJECTION_MARKERS = (
    "output_config",
    "output_format",
    "output format",
    "structured output",
)


def _rejects_native_output(error: Exception) -> bool:
    """Checks whether an API error means the model doesn't support native structured output."""
    from anthropic import BadRequestError

    message = str(error).lower()
    return isinstance(error, BadRequestError) and any(
        marker in message for marker in _NATIVE_OUTPUT_REJECTION_MARKERS
    )


def _with_closed_objects(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Returns a copy of the schema with `additionalProperties: false` on every object.

    Native structured output requires it on every object type.
    """
    closed = copy.deepcopy(schema)

    def close(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object":
                node.setdefault("additionalProperties", False)
            for value in node.values():
                close(value)
        elif isinstance(node, list):
            for item in node:
                close(item)

    close(closed)
    return closed


def _parse_native_output(response: Any) -> Any:
    """Returns the JSON value in a native structured output response.

    Raises:
        ValueError: If the model refused, ran out of tokens, or returned text that isn't JSON.
    """
    if response.stop_reason == "refusal":
        raise ValueError(
            f"Anthropic refused to generate the object: {getattr(response, 'stop_details', None)}"
        )
    if response.stop_reason == "max_tokens":
        raise ValueError(
            "Anthropic stopped at max_tokens before the object was complete. Raise max_tokens."
        )
    text = "".join(block.text for block in response.content if block.type == "text")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Anthropic returned output that isn't valid JSON: {text!r}") from e


def _validate_object(result: Any, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Returns the result if it has the schema's required fields and allowed enum values.

    Raises:
        ValueError: If the result isn't an object, misses a required field, or has a top-level
            value outside its enum.
    """
    if not isinstance(result, dict):
        raise ValueError(f"Expected a JSON object from Anthropic, got {type(result).__name__}")
    missing = [name for name in schema.get("required", []) if name not in result]
    if missing:
        raise ValueError(f"Anthropic output is missing required fields {missing}: {result}")
    for name, prop in schema.get("properties", {}).items():
        if isinstance(prop, dict) and "enum" in prop and name in result:
            if result[name] not in prop["enum"]:
                raise ValueError(
                    f"Anthropic output field {name!r} is {result[name]!r}, "
                    f"which isn't one of {prop['enum']}"
                )
    return cast(Dict[str, Any], result)


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
        # Set once the model rejects native structured output, so AUTO stops trying it.
        self._preferred_method: ObjectGenerationMethod | None = None

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

    def generate_text(self, prompt: PromptLike, **kwargs: Any) -> str:
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

    async def async_generate_text(self, prompt: PromptLike, **kwargs: Any) -> str:
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
        prompt: PromptLike,
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
            return self._generate_with_native_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return self._generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            if self._preferred_method == ObjectGenerationMethod.TOOL_CALLING:
                return self._generate_with_tool_calling(prompt, schema, **kwargs)
            try:
                return self._generate_with_native_output(prompt, schema, **kwargs)
            except Exception as error:
                if not _rejects_native_output(error):
                    raise
                self._fall_back_to_tool_calling(error)
            return self._generate_with_tool_calling(prompt, schema, **kwargs)

        else:
            raise ValueError(f"Unsupported object generation method: {method}")

    async def async_generate_object(
        self,
        prompt: PromptLike,
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
            return await self._async_generate_with_native_output(prompt, schema, **kwargs)
        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)
        elif method == ObjectGenerationMethod.AUTO:
            if self._preferred_method == ObjectGenerationMethod.TOOL_CALLING:
                return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)
            try:
                return await self._async_generate_with_native_output(prompt, schema, **kwargs)
            except Exception as error:
                if not _rejects_native_output(error):
                    raise
                self._fall_back_to_tool_calling(error)
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)
        else:
            raise ValueError(f"Unsupported object generation method: {method}")

    def _fall_back_to_tool_calling(self, error: Exception) -> None:
        logger.debug(
            f"Native structured output rejected by {self.model}, falling back to tool calling: "
            f"{error}"
        )
        self._preferred_method = ObjectGenerationMethod.TOOL_CALLING

    def _generate_with_native_output(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = self.client.messages.create(**self._native_output_params(prompt, schema, kwargs))
        return _validate_object(_parse_native_output(response), schema)

    async def _async_generate_with_native_output(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = await self.client.messages.create(
            **self._native_output_params(prompt, schema, kwargs)
        )
        return _validate_object(_parse_native_output(response), schema)

    def _native_output_params(
        self, prompt: PromptLike, schema: Dict[str, Any], kwargs: Dict[str, Any]
    ) -> Dict[str, Any]:
        messages, system = self._build_messages(prompt)
        params = {
            **kwargs,
            "model": self.model,
            "messages": messages,
            "output_config": {
                # Keep other output settings the caller passed, such as `effort`.
                **kwargs.get("output_config", {}),
                "format": {"type": "json_schema", "schema": _with_closed_objects(schema)},
            },
        }
        # A system message in the prompt takes precedence over a `system` kwarg.
        if system:
            params["system"] = system
        return params

    def _generate_with_tool_calling(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = self.client.messages.create(**self._tool_calling_params(prompt, schema, kwargs))
        return _validate_object(self._tool_input(response), schema)

    async def _async_generate_with_tool_calling(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = await self.client.messages.create(
            **self._tool_calling_params(prompt, schema, kwargs)
        )
        return _validate_object(self._tool_input(response), schema)

    def _tool_input(self, response: Any) -> Any:
        for content_block in response.content:
            if (
                getattr(content_block, "type", None) == "tool_use"
                and content_block.name == TOOL_NAME
            ):
                return content_block.input

        raise ValueError("No tool use in response")

    def _tool_calling_params(
        self, prompt: PromptLike, schema: Dict[str, Any], kwargs: Dict[str, Any]
    ) -> Dict[str, Any]:
        messages, system = self._build_messages(prompt)
        return {
            "tool_choice": {"type": "auto", "disable_parallel_tool_use": True},
            **kwargs,
            "model": self.model,
            "messages": messages,
            "tools": [self._schema_to_tool(schema)],
            # A system message in the prompt takes precedence over a `system` kwarg.
            "system": _with_tool_instruction(system or kwargs.get("system")),
        }

    def _schema_to_tool(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        description = schema.get("description", "Respond in a format matching the provided schema")

        tool_definition = {
            "name": TOOL_NAME,
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

            # Skip system messages - they should be handled separately.
            # Anthropic has no "developer" role, so DEVELOPER folds into the
            # same system-extraction path as SYSTEM.
            if role in (MessageRole.SYSTEM, MessageRole.DEVELOPER):
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

    def _build_messages(self, prompt: PromptLike) -> tuple[list[dict[str, Any]], str]:
        """Build messages for Anthropic API.

        Returns:
            Tuple of (messages, system_content) where system_content is extracted system messages
        """
        if isinstance(prompt, str):
            return [{"role": "user", "content": prompt}], ""

        if isinstance(prompt, list):
            if not prompt:
                raise ValueError("Prompt message list cannot be empty.")
            # Reject mixed lists (typed Message + raw dict) up front.
            #
            # ``extras_per_msg`` mirrors ``messages_typed`` index-for-index and
            # captures any caller-supplied keys other than ``role``/``content``
            # on the dict path (e.g. the documented OpenAI ``name`` field).
            # The typed-input branch can't carry extras, so we pad with empty
            # dicts to keep the indexing parallel.
            extras_per_msg: List[Dict[str, Any]] = []
            if classify_message_list_kind(prompt) == "typed":
                messages_typed = cast(List[Message], prompt)
                extras_per_msg = [{} for _ in messages_typed]
            else:
                # OpenAI-style dict messages — validate and canonicalize before
                # routing through the typed transform.  Normalizing here means
                # ``developer`` aliases are treated as system and get
                # correctly extracted into the Anthropic ``system`` string.
                messages_typed = []
                for i, msg in enumerate(cast(List[Dict[str, Any]], prompt)):
                    validate_message_dict(msg, index=i)
                    role = normalize_role(msg["role"])
                    messages_typed.append(Message(role=role, content=msg["content"]))
                    extras_per_msg.append(
                        {k: v for k, v in msg.items() if k not in ("role", "content")}
                    )

            # Extract system messages first (DEVELOPER folds into SYSTEM here —
            # Anthropic has no separate wire role for it).
            system_messages = [
                msg
                for msg in messages_typed
                if msg["role"] in (MessageRole.SYSTEM, MessageRole.DEVELOPER)
            ]
            system_content = "\n".join(
                self._extract_text_from_content(msg["content"]) for msg in system_messages
            )
            anthropic_messages = self._transform_messages_to_anthropic(messages_typed)
            # Re-attach extras for non-system messages (system extras are
            # discarded since they fold into the ``system`` string).  The
            # transform preserves the order of non-system messages, so we walk
            # both lists together.
            non_system_extras = [
                extras
                for extras, msg in zip(extras_per_msg, messages_typed)
                if msg["role"] not in (MessageRole.SYSTEM, MessageRole.DEVELOPER)
            ]
            anthropic_messages = [
                {**extras, **out} for extras, out in zip(non_system_extras, anthropic_messages)
            ]
            return anthropic_messages, system_content

        # If we get here, prompt is an unexpected type
        raise ValueError(f"Expected prompt to be str or list, got {type(prompt).__name__}")

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
