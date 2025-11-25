import json
import logging
from typing import Any, Dict, List, Type, Union, cast

from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

from ...prompts import Message, MessageRole
from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod, PromptLike
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

    def generate_text(self, prompt: PromptLike, **kwargs: Any) -> str:
        if self._is_async:
            raise ValueError(
                "Cannot call sync method generate_text() on async Google GenAI client."
            )

        content = self._build_content(prompt)

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

    async def async_generate_text(self, prompt: PromptLike, **kwargs: Any) -> str:
        if not self._is_async:
            raise ValueError(
                "Cannot call async method async_generate_text() on sync Google GenAI client."
            )

        content = self._build_content(prompt)

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
        prompt: PromptLike,
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
        prompt: PromptLike,
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
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content = self._build_content(prompt)

        config = genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
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
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content = self._build_content(prompt)

        config = genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
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
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content = self._build_content(prompt)
        tool = self._schema_to_tool(schema)
        any_config_mode = genai.types.FunctionCallingConfigMode("ANY")

        config = genai.types.GenerateContentConfig(
            tools=[tool],
            tool_config=genai.types.ToolConfig(
                function_calling_config=genai.types.FunctionCallingConfig(mode=any_config_mode)
            ),
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
        prompt: PromptLike,
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from google import genai

        content = self._build_content(prompt)
        tool = self._schema_to_tool(schema)
        any_config_mode = genai.types.FunctionCallingConfigMode("ANY")

        config = genai.types.GenerateContentConfig(
            tools=[tool],
            tool_config=genai.types.ToolConfig(
                function_calling_config=genai.types.FunctionCallingConfig(mode=any_config_mode)
            ),
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

    def _transform_messages_to_google(self, messages: List[Message]) -> List[Dict[str, Any]]:
        """Transform List[Message] TypedDict to Google GenAI format.

        Args:
            messages: List of Message TypedDicts with MessageRole enum.

        Returns:
            List of Google-formatted message dicts with 'parts' structure.
        """
        google_messages = []

        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            # Map MessageRole enum to Google role strings
            # Google uses "model" instead of "assistant"
            if role == MessageRole.AI:
                google_role = "model"
            elif role == MessageRole.USER:
                google_role = "user"
            elif role == MessageRole.SYSTEM:
                # Google doesn't have a system role, map to user
                google_role = "user"
            else:
                # Fallback
                google_role = role.value if isinstance(role, MessageRole) else str(role)
                # Special case for "assistant" string
                if google_role == "assistant":
                    google_role = "model"

            # Handle content - can be string or List[ContentPart]
            if isinstance(content, str):
                google_messages.append({"role": google_role, "parts": [{"text": content}]})
            else:
                # Extract text from TextContentPart items only
                text_parts = []
                for part in content:
                    if part.get("type") == "text":
                        text_parts.append(part["text"])

                # Join all text parts with newlines
                combined_text = "\n".join(text_parts)
                google_messages.append({"role": google_role, "parts": [{"text": combined_text}]})

        return google_messages

    def _build_content(
        self, prompt: Union[str, List[Dict[str, Any]], MultimodalPrompt]
    ) -> Union[str, List[Dict[str, Any]]]:
        if isinstance(prompt, str):
            return prompt

        if isinstance(prompt, list):
            # Check if this is List[Message] with MessageRole enum
            if prompt and isinstance(prompt[0].get("role"), MessageRole):
                # Transform List[Message] to Google format
                return self._transform_messages_to_google(prompt)
            # Convert OpenAI-style messages to Google format (backward compatibility)
            # Google uses "model" instead of "assistant" for role
            google_messages = []
            for msg in prompt:
                role = msg["role"]
                content = msg["content"]
                # Convert assistant role to model
                if role == "assistant":
                    role = "model"
                google_messages.append({"role": role, "parts": [{"text": content}]})
            return google_messages

        # Handle legacy MultimodalPrompt
        text_parts: list[str] = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                text_parts.append(str(part.content))

        return "\n".join(text_parts)

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
