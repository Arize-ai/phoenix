import json
import logging
from typing import Any, Dict, List, Type, Union, cast

from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

from ...prompts import Message, MessageRole, PromptLike
from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod
from .factories import GoogleGenAIClientWrapper, create_google_genai_client

logger = logging.getLogger(__name__)


class GoogleGenAIRateLimitError(Exception):
    pass


def identify_google_genai_client(client: Any) -> bool:
    if isinstance(client, GoogleGenAIClientWrapper):
        return True
    if hasattr(client, "models") and hasattr(client, "chats"):
        return True
    return False


def get_google_genai_rate_limit_errors() -> list[Type[Exception]]:
    return [GoogleGenAIRateLimitError]


@register_adapter(
    identifier=identify_google_genai_client,
    name="google-genai",
)
@register_provider(
    provider="google",
    client_factory=create_google_genai_client,
    get_rate_limit_errors=get_google_genai_rate_limit_errors,
    dependencies=["google-genai"],
)
class GoogleGenAIAdapter(BaseLLMAdapter):
    def __init__(self, client: Any, model: str):
        super().__init__(client, model)
        self._validate_client()
        self._is_async = self._check_if_async_client()

    @classmethod
    def client_name(cls) -> str:
        return "google-genai"

    def _validate_client(self) -> None:
        if not hasattr(self.client, "models"):
            raise ValueError("GoogleGenAIAdapter requires a Google GenAI client.")

    def _check_if_async_client(self) -> bool:
        if hasattr(self.client, "aio"):
            return False
        return True

    def _safe_extract_config_params(self, config: Any) -> Dict[str, Any]:
        """Safely extract parameters from a GenerateContentConfig object.

        This method avoids using config.__dict__ directly, which may contain
        private attributes, internal state, or computed properties that the
        constructor doesn't accept.

        Args:
            config: A GenerateContentConfig object (or similar config object).

        Returns:
            A dictionary of public attributes that can be safely passed to the constructor.
        """
        # Try Pydantic v2 model_dump() method first
        if hasattr(config, "model_dump"):
            try:
                return config.model_dump()  # type: ignore[no-any-return]
            except Exception:
                pass

        # Try Pydantic v1 dict() method
        if hasattr(config, "dict"):
            try:
                return config.dict()  # type: ignore[no-any-return]
            except Exception:
                pass

        # Try to_dict() method (common in dataclasses and other models)
        if hasattr(config, "to_dict"):
            try:
                return config.to_dict()  # type: ignore[no-any-return]
            except Exception:
                pass

        # Fallback: filter __dict__ to exclude private attributes
        # This excludes attributes starting with _ (private) or __ (dunder)
        config_dict = {}
        for key, value in getattr(config, "__dict__", {}).items():
            # Only include public attributes (not starting with _)
            if not key.startswith("_"):
                config_dict[key] = value

        return config_dict

    def generate_text(self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any) -> str:
        if self._is_async:
            raise ValueError(
                "Cannot call sync method generate_text() on async Google GenAI client."
            )

        content, system_instruction = self._build_content(prompt)

        # Add system_instruction to config if present
        if system_instruction:
            from google import genai

            config = kwargs.get("config")
            if config is None:
                config = genai.types.GenerateContentConfig(system_instruction=system_instruction)
            elif isinstance(config, dict):
                config["system_instruction"] = system_instruction
            else:
                # It's a GenerateContentConfig object, we need to merge
                config_params = self._safe_extract_config_params(config)
                config_params["system_instruction"] = system_instruction
                config = genai.types.GenerateContentConfig(**config_params)
            kwargs["config"] = config

        try:
            response = self.client.models.generate_content(
                model=self.client.model, contents=content, **kwargs
            )
            if hasattr(response, "text"):
                return cast(str, response.text)
            else:
                raise ValueError("Google GenAI returned unexpected content format")
        except Exception as e:
            self._handle_api_error(e)
            logger.error(f"Google GenAI completion failed: {e}")
            raise

    async def async_generate_text(
        self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any
    ) -> str:
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_text() on sync Google GenAI client."
            )

        content, system_instruction = self._build_content(prompt)

        # Add system_instruction to config if present
        if system_instruction:
            from google import genai

            config = kwargs.get("config")
            if config is None:
                config = genai.types.GenerateContentConfig(system_instruction=system_instruction)
            elif isinstance(config, dict):
                config["system_instruction"] = system_instruction
            else:
                # It's a GenerateContentConfig object, we need to merge
                config_params = self._safe_extract_config_params(config)
                config_params["system_instruction"] = system_instruction
                config = genai.types.GenerateContentConfig(**config_params)
            kwargs["config"] = config

        try:
            response = await self.client.models.generate_content(
                model=self.client.model, contents=content, **kwargs
            )
            if hasattr(response, "text"):
                return cast(str, response.text)
            else:
                raise ValueError("Google GenAI returned unexpected content format")
        except Exception as e:
            self._handle_api_error(e)
            logger.error(f"Google GenAI async completion failed: {e}")
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
                "Cannot call sync method generate_object() on async Google GenAI client. "
                "Use async_generate_object() instead or provide a sync Google GenAI client."
            )
        self._validate_schema(schema)

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            return self._generate_with_structured_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return self._generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            try:
                return self._generate_with_structured_output(prompt, schema, **kwargs)
            except Exception as structured_error:
                logger.debug(
                    f"Structured output failed for {self.client.model}, falling back to tool "
                    f"calling: {structured_error}"
                )
                try:
                    return self._generate_with_tool_calling(prompt, schema, **kwargs)
                except Exception as tool_error:
                    raise ValueError(
                        f"Google GenAI model {self.client.model} failed with both structured "
                        f"output and tool calling. Tool calling error: {tool_error}"
                    ) from tool_error

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
                "Cannot call async method async_generate_object() on sync Google GenAI client."
            )
        self._validate_schema(schema)

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            return await self._async_generate_with_structured_output(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)

        elif method == ObjectGenerationMethod.AUTO:
            try:
                return await self._async_generate_with_structured_output(prompt, schema, **kwargs)
            except Exception as structured_error:
                logger.debug(
                    f"Structured output failed for {self.client.model}, falling back to tool "
                    f"calling: {structured_error}"
                )
                try:
                    return await self._async_generate_with_tool_calling(prompt, schema, **kwargs)
                except Exception as tool_error:
                    raise ValueError(
                        f"Google GenAI model {self.client.model} failed with both structured "
                        f"output and tool calling. Tool calling error: {tool_error}"
                    ) from tool_error

        else:
            raise ValueError(f"Unsupported object generation method: {method}")

    def _generate_with_structured_output(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content, system_instruction = self._build_content(prompt)

        config = genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            system_instruction=system_instruction if system_instruction else None,
        )

        try:
            response = self.client.models.generate_content(
                model=self.client.model, contents=content, config=config, **kwargs
            )

            if hasattr(response, "text"):
                return cast(Dict[str, Any], json.loads(response.text))
            else:
                raise ValueError("Google GenAI returned no content")
        except Exception as e:
            self._handle_api_error(e)
            raise

    async def _async_generate_with_structured_output(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content, system_instruction = self._build_content(prompt)

        config = genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
            system_instruction=system_instruction if system_instruction else None,
        )

        try:
            response = await self.client.models.generate_content(
                model=self.client.model, contents=content, config=config, **kwargs
            )

            if hasattr(response, "text"):
                return cast(Dict[str, Any], json.loads(response.text))
            else:
                raise ValueError("Google GenAI returned no content")
        except Exception as e:
            self._handle_api_error(e)
            raise

    def _generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content, system_instruction = self._build_content(prompt)
        tool = self._schema_to_tool(schema)
        any_config_mode = genai.types.FunctionCallingConfigMode("ANY")

        config = genai.types.GenerateContentConfig(
            tools=[tool],
            tool_config=genai.types.ToolConfig(
                function_calling_config=genai.types.FunctionCallingConfig(mode=any_config_mode)
            ),
            system_instruction=system_instruction if system_instruction else None,
        )

        try:
            response = self.client.models.generate_content(
                model=self.client.model, contents=content, config=config, **kwargs
            )

            if hasattr(response, "candidates") and response.candidates:
                for candidate in response.candidates:
                    if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                        for part in candidate.content.parts:
                            if hasattr(part, "function_call"):
                                return cast(Dict[str, Any], dict(part.function_call.args))

            raise ValueError("No function call in response")
        except Exception as e:
            self._handle_api_error(e)
            raise

    async def _async_generate_with_tool_calling(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content, system_instruction = self._build_content(prompt)
        tool = self._schema_to_tool(schema)
        any_config_mode = genai.types.FunctionCallingConfigMode("ANY")

        config = genai.types.GenerateContentConfig(
            tools=[tool],
            tool_config=genai.types.ToolConfig(
                function_calling_config=genai.types.FunctionCallingConfig(mode=any_config_mode)
            ),
            system_instruction=system_instruction if system_instruction else None,
        )

        try:
            response = await self.client.models.generate_content(
                model=self.client.model, contents=content, config=config, **kwargs
            )

            if hasattr(response, "candidates") and response.candidates:
                for candidate in response.candidates:
                    if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                        for part in candidate.content.parts:
                            if hasattr(part, "function_call"):
                                return cast(Dict[str, Any], dict(part.function_call.args))

            raise ValueError("No function call in response")
        except Exception as e:
            self._handle_api_error(e)
            raise

    def _schema_to_tool(self, schema: Dict[str, Any]) -> Any:
        from google import genai

        description = schema.get(
            "description", "Extract structured data according to the provided schema"
        )

        function_declaration = genai.types.FunctionDeclaration(
            name="extract_structured_data",
            description=description,
            parameters_json_schema=schema,
        )

        return genai.types.Tool(function_declarations=[function_declaration])

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
            if part.get("type") == "text":
                text_parts.append(part["text"])

        # Join all text parts with newlines
        return "\n".join(text_parts)

    def _transform_messages_to_google(self, messages: List[Message]) -> List[Dict[str, Any]]:
        """Transform List[Message] TypedDict to Google GenAI format.

        Note: System messages are NOT included in the returned messages.
        They should be extracted separately and passed as the 'system_instruction' parameter.

        Args:
            messages: List of Message TypedDicts with MessageRole enum.

        Returns:
            List of Google-formatted message dicts with 'parts' structure (without system messages).
        """
        google_messages = []

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            # Skip system messages - they should be handled separately
            if role == MessageRole.SYSTEM:
                continue

            # Map MessageRole enum to Google role strings
            # Google uses "model" instead of "assistant"
            if role == MessageRole.AI:
                google_role = "model"
            elif role == MessageRole.USER:
                google_role = "user"
            else:
                # Fallback
                google_role = role.value if isinstance(role, MessageRole) else str(role)
                # Special case for "assistant" string
                if google_role == "assistant":
                    google_role = "model"

            # Handle content - can be string or List[ContentPart]
            text_content = self._extract_text_from_content(content)
            google_messages.append({"role": google_role, "parts": [{"text": text_content}]})

        return google_messages

    def _build_content(
        self, prompt: Union[PromptLike, MultimodalPrompt]
    ) -> tuple[Union[str, List[Dict[str, Any]]], str]:
        """Build content for Google GenAI API.

        Returns:
            Tuple of (content, system_instruction) where system_instruction is extracted
            from system messages
        """
        if isinstance(prompt, str):
            return prompt, ""

        if isinstance(prompt, list):
            # Check if this is List[Message] with MessageRole enum
            if prompt and isinstance(prompt[0].get("role"), MessageRole):
                # Extract system messages first
                messages_typed = cast(List[Message], prompt)
                system_messages = [
                    msg for msg in messages_typed if msg["role"] == MessageRole.SYSTEM
                ]
                system_instruction = "\n".join(
                    self._extract_text_from_content(msg["content"]) for msg in system_messages
                )
                # Transform List[Message] to Google format (will skip system messages)
                google_messages = self._transform_messages_to_google(messages_typed)
                return google_messages, system_instruction

            # Convert plain dict messages to Google format
            # Extract system messages for system_instruction parameter
            system_messages_dicts: List[Dict[str, Any]] = [
                msg for msg in cast(List[Dict[str, Any]], prompt) if msg.get("role") == "system"
            ]
            non_system_messages_dicts: List[Dict[str, Any]] = [
                msg for msg in cast(List[Dict[str, Any]], prompt) if msg.get("role") != "system"
            ]
            system_instruction = "\n".join(
                self._extract_text_from_content(msg.get("content", ""))
                for msg in system_messages_dicts
            )

            google_messages = []
            for msg in non_system_messages_dicts:
                role = msg["role"]
                content = msg["content"]

                # Convert assistant role to model
                if role == "assistant":
                    role = "model"

                # Handle content - can be string or List[ContentPart]
                if isinstance(content, str):
                    google_messages.append({"role": role, "parts": [{"text": content}]})
                else:
                    # Extract text from structured content parts
                    msg_text_parts = []
                    for part in content:
                        if part.get("type") == "text":
                            msg_text_parts.append(str(part.get("text", "")))

                    # Join all text parts
                    combined_text = "\n".join(msg_text_parts)
                    google_messages.append({"role": role, "parts": [{"text": combined_text}]})
            return google_messages, system_instruction

        # Handle legacy MultimodalPrompt
        if isinstance(prompt, MultimodalPrompt):
            text_parts: list[str] = []
            for part in prompt.parts:
                if part.content_type == PromptPartContentType.TEXT:
                    text_parts.append(str(part.content))

            return [{"role": "user", "parts": [{"text": "\n".join(text_parts)}]}], ""

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

    def _handle_api_error(self, error: Exception) -> None:
        try:
            from google.genai.errors import APIError

            if isinstance(error, APIError):
                if (
                    getattr(error, "code", None) == 429
                    or getattr(error, "status", "") == "RESOURCE_EXHAUSTED"
                ):
                    raise GoogleGenAIRateLimitError(str(error)) from error
        except ImportError:
            pass
