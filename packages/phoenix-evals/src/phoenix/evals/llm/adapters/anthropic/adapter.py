import json
import logging
import re
from typing import Any, Dict, List, Optional, Type, cast

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
from ..json_schema import close_objects, walk_schema
from ..tool_calling import TOOL_INSTRUCTION, TOOL_NAME
from .factories import AnthropicClientWrapper, create_anthropic_client

logger = logging.getLogger(__name__)


def _with_tool_instruction(system: Any) -> Any:
    if isinstance(system, list):
        return [*system, {"type": "text", "text": TOOL_INSTRUCTION}]
    return f"{system}\n\n{TOOL_INSTRUCTION}" if system else TOOL_INSTRUCTION


# A 400 error that names `output_config.format`, the whole `output_config`, `output_format`, or
# structured output means the model or endpoint doesn't accept native structured output. An error
# about another `output_config` field, such as `effort`, doesn't.
_NATIVE_OUTPUT_UNSUPPORTED = re.compile(
    r"output_config(?:\.format|(?![.\w]))|output_format|output format|structured output",
    re.IGNORECASE,
)
# A 400 error about `output_config.format.schema` means native output can't take this schema, but
# can still take others.
_SCHEMA_UNSUPPORTED = re.compile(r"output_config\.format\.schema", re.IGNORECASE)
# Keywords that native structured output rejects.
_UNSUPPORTED_KEYWORDS = frozenset(
    {
        "exclusiveMaximum",
        "exclusiveMinimum",
        "maxLength",
        "maximum",
        "minLength",
        "minimum",
        "multipleOf",
    }
)


def _native_output_schema(schema: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Returns the schema in the form native structured output accepts, or None if it can't.

    Adds `additionalProperties: false` to every object and turns a `oneOf` of `const` values, which
    `generate_classification` builds for labels with descriptions, into the equivalent `anyOf`.
    Returns None for numeric and string-length constraints, any other `oneOf`, and
    `additionalProperties` set to anything but false.
    """
    native = close_objects(schema)
    supported = True

    def convert(node: Dict[str, Any]) -> None:
        nonlocal supported
        one_of = node.pop("oneOf", None)
        if one_of is not None:
            if "anyOf" not in node and all(
                isinstance(branch, dict) and "const" in branch for branch in one_of
            ):
                node["anyOf"] = one_of
            else:
                supported = False
        if (
            _UNSUPPORTED_KEYWORDS & node.keys()
            or node.get("additionalProperties", False) is not False
        ):
            supported = False

    walk_schema(native, convert)
    return native if supported else None


def _raise_if_incomplete(response: Any) -> None:
    """Raises a ValueError if the model refused or ran out of tokens before finishing."""
    if response.stop_reason == "refusal":
        raise ValueError(
            f"Anthropic refused to generate the object: {getattr(response, 'stop_details', None)}"
        )
    if response.stop_reason == "max_tokens":
        raise ValueError(
            "Anthropic stopped at max_tokens before the object was complete. Raise max_tokens."
        )


def _native_output(response: Any) -> Any:
    """Returns the JSON value in a native structured output response.

    Raises:
        ValueError: If the model refused, ran out of tokens, or returned text that isn't JSON.
    """
    _raise_if_incomplete(response)
    text = "".join(block.text for block in response.content if block.type == "text")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Anthropic returned output that isn't valid JSON: {text!r}") from e


def _tool_input(response: Any) -> Any:
    """Returns the input of the `extract_structured_data` tool call in a response.

    Raises:
        ValueError: If the model refused, ran out of tokens, or didn't call the tool.
    """
    _raise_if_incomplete(response)
    for content_block in response.content:
        if getattr(content_block, "type", None) == "tool_use" and content_block.name == TOOL_NAME:
            return content_block.input

    raise ValueError("No tool use in response")


def _allowed_values(prop: Dict[str, Any]) -> Optional[List[Any]]:
    """Returns the values an `enum` or a choice of `const` values allows, or None."""
    if "enum" in prop:
        return cast(List[Any], prop["enum"])
    choices = prop.get("anyOf") or prop.get("oneOf")
    if choices and all(isinstance(branch, dict) and "const" in branch for branch in choices):
        return [branch["const"] for branch in choices]
    return None


def _validate_object(result: Any, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Returns the result after a partial check against the schema.

    Checks that the result is an object with every required field, and that each top-level field
    with an `enum` or a choice of `const` values holds one of them. Nested objects and types aren't
    checked.

    Raises:
        ValueError: If the result fails one of these checks.
    """
    if not isinstance(result, dict):
        raise ValueError(f"Expected a JSON object from Anthropic, got {type(result).__name__}")
    missing = [name for name in schema.get("required", []) if name not in result]
    if missing:
        raise ValueError(f"Anthropic output is missing required fields {missing}: {result}")
    for name, prop in schema.get("properties", {}).items():
        allowed = _allowed_values(prop) if isinstance(prop, dict) else None
        if allowed is not None and name in result and result[name] not in allowed:
            raise ValueError(
                f"Anthropic output field {name!r} is {result[name]!r}, which isn't one of {allowed}"
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
        self._native_output_rejected = False

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
            from anthropic import BadRequestError

            if self._can_use_native_output(schema):
                try:
                    return self._generate_with_native_output(prompt, schema, **kwargs)
                except BadRequestError as error:
                    self._fall_back_or_raise(error)
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
            from anthropic import BadRequestError

            if self._can_use_native_output(schema):
                try:
                    return await self._async_generate_with_native_output(prompt, schema, **kwargs)
                except BadRequestError as error:
                    self._fall_back_or_raise(error)
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)
        else:
            raise ValueError(f"Unsupported object generation method: {method}")

    def _can_use_native_output(self, schema: Dict[str, Any]) -> bool:
        return not self._native_output_rejected and _native_output_schema(schema) is not None

    def _fall_back_or_raise(self, error: Exception) -> None:
        """Re-raises the error unless it means native output can't serve the request.

        A rejection of native output as a whole sends every later AUTO call to tool calling. A
        rejection of one schema affects only the current call.
        """
        if _SCHEMA_UNSUPPORTED.search(str(error)):
            logger.debug(
                f"Native structured output rejected the schema, using tool calling: {error}"
            )
        elif _NATIVE_OUTPUT_UNSUPPORTED.search(str(error)):
            logger.debug(
                f"Native structured output rejected by {self.model}, using tool calling: {error}"
            )
            self._native_output_rejected = True
        else:
            raise error

    def _generate_with_native_output(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = self.client.messages.create(**self._native_output_params(prompt, schema, kwargs))
        return _validate_object(_native_output(response), schema)

    async def _async_generate_with_native_output(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = await self.client.messages.create(
            **self._native_output_params(prompt, schema, kwargs)
        )
        return _validate_object(_native_output(response), schema)

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
                # An explicit STRUCTURED_OUTPUT request sends a schema native output may reject, and
                # the API's error says why.
                "format": {
                    "type": "json_schema",
                    "schema": _native_output_schema(schema) or close_objects(schema),
                },
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
        return _validate_object(_tool_input(response), schema)

    async def _async_generate_with_tool_calling(
        self,
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        response = await self.client.messages.create(
            **self._tool_calling_params(prompt, schema, kwargs)
        )
        return _validate_object(_tool_input(response), schema)

    def _tool_calling_params(
        self, prompt: PromptLike, schema: Dict[str, Any], kwargs: Dict[str, Any]
    ) -> Dict[str, Any]:
        messages, system = self._build_messages(prompt)
        return {
            **kwargs,
            "model": self.model,
            "messages": messages,
            "tools": [self._schema_to_tool(schema)],
            # Merge into a caller's `tool_choice` so the response still holds one tool call.
            "tool_choice": {
                **kwargs.get("tool_choice", {"type": "auto"}),
                "disable_parallel_tool_use": True,
            },
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
