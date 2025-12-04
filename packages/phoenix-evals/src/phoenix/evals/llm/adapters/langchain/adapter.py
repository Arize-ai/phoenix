import logging
from typing import Any, Dict, List, Type, Union, cast

from phoenix.evals.legacy.templates import MultimodalPrompt

from ...prompts import ContentPart, Message, MessageRole, PromptLike, TextContentPart
from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter, ObjectGenerationMethod
from .factories import (
    create_anthropic_langchain_client,  # pyright: ignore
    create_openai_langchain_client,  # pyright: ignore
)

logger = logging.getLogger(__name__)


def identify_langchain_client(client: Any) -> bool:
    return (
        hasattr(client, "__module__")
        and client.__module__ is not None
        and (
            "langchain" in client.__module__
            or (hasattr(client, "invoke") or hasattr(client, "predict"))
        )
    )


def get_anthropic_langchain_rate_limit_errors() -> list[Type[Exception]]:
    from anthropic import RateLimitError as AnthropicRateLimitError

    return [AnthropicRateLimitError]


def get_openai_langchain_rate_limit_errors() -> list[Type[Exception]]:
    from openai import RateLimitError as OpenAIRateLimitError

    return [OpenAIRateLimitError]


@register_adapter(
    identifier=identify_langchain_client,
    name="langchain",
)
@register_provider(
    provider="openai",
    client_factory=create_openai_langchain_client,  # pyright: ignore
    get_rate_limit_errors=get_openai_langchain_rate_limit_errors,
    dependencies=["langchain", "langchain-openai"],
)
@register_provider(
    provider="anthropic",
    client_factory=create_anthropic_langchain_client,  # pyright: ignore
    get_rate_limit_errors=get_anthropic_langchain_rate_limit_errors,
    dependencies=["langchain", "langchain-anthropic"],
)
class LangChainModelAdapter(BaseLLMAdapter):
    def __init__(self, client: Any, model: str):
        super().__init__(client, model)
        self._validate_client()

    @classmethod
    def client_name(cls) -> str:
        return "langchain"

    def _validate_client(self) -> None:
        if not (hasattr(self.client, "invoke") or hasattr(self.client, "predict")):
            raise ValueError(
                f"LangChainModelAdapter requires a LangChain model instance with 'invoke' or "
                f"'predict' method, got {type(self.client)}"
            )

    def generate_text(self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any) -> str:
        prompt_input = self._build_prompt(prompt)

        if hasattr(self.client, "invoke"):
            response = self.client.invoke(prompt_input, **kwargs)
        elif hasattr(self.client, "predict"):
            response = self.client.predict(prompt_input, **kwargs)
        else:
            response = self.client(prompt_input, **kwargs)

        if hasattr(response, "content"):
            return str(response.content)  # pyright: ignore
        elif isinstance(response, str):
            return response
        else:
            return str(response)

    async def async_generate_text(
        self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any
    ) -> str:
        prompt_input = self._build_prompt(prompt)

        if hasattr(self.client, "ainvoke"):
            response = await self.client.ainvoke(prompt_input, **kwargs)
        elif hasattr(self.client, "apredict"):
            response = await self.client.apredict(prompt_input, **kwargs)
        else:
            response = self.generate_text(prompt, **kwargs)

        if hasattr(response, "content"):
            return str(response.content)  # pyright: ignore
        elif isinstance(response, str):
            return response
        else:
            return str(response)

    def generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        self._validate_schema(schema)

        supports_structured_output = hasattr(self.client, "with_structured_output")
        supports_tool_calls = hasattr(self.client, "bind_tools") or hasattr(
            self.client, "bind_functions"
        )

        if not supports_structured_output and not supports_tool_calls:
            raise ValueError(
                f"LangChain model {type(self.client).__name__} does not support structured "
                "output or tool calls"
            )

        def _generate_structured_output() -> Dict[str, Any]:
            normalized_schema = self._normalize_schema_for_langchain(schema)
            prompt_input = self._build_prompt(prompt)
            structured_model = self.client.with_structured_output(normalized_schema)
            response = structured_model.invoke(prompt_input, **kwargs)
            if isinstance(response, dict):
                return response  # pyright: ignore[reportReturnType,reportUnknownVariableType]
            else:
                # If not a dict, this is unexpected for object schemas
                raise ValueError(
                    f"Expected dict from structured output with object schema, "
                    f"got {type(response).__name__}: {response}"
                )

        def _generate_tool_call_output() -> Dict[str, Any]:
            tool_definition = self._schema_to_tool(schema)
            prompt_input = self._build_prompt(prompt)

            if hasattr(self.client, "bind_tools"):
                tool_model = self.client.bind_tools([tool_definition])
                response = tool_model.invoke(prompt_input, **kwargs)
            elif hasattr(self.client, "bind_functions"):
                tool_model = self.client.bind_functions([tool_definition])
                response = tool_model.invoke(prompt_input, **kwargs)
            else:
                raise ValueError("No tool binding method available")

            if hasattr(response, "tool_calls") and response.tool_calls:
                tool_call = response.tool_calls[0]
                if isinstance(tool_call, dict) and "args" in tool_call:
                    return cast(Dict[str, Any], tool_call["args"])
                elif hasattr(tool_call, "args"):  # pyright: ignore[reportArgumentType,reportUnknownArgumentType]
                    return cast(Dict[str, Any], tool_call.args)  # pyright: ignore[reportAttributeAccessIssue]
                else:
                    raise ValueError("Tool call format not supported")
            else:
                raise ValueError("No tool calls found in response")

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            return _generate_structured_output()
        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return _generate_tool_call_output()

        if supports_structured_output:
            try:
                return _generate_structured_output()
            except Exception as e:
                logger.warning(f"Structured output failed: {e}, falling back to tool calling")

        if supports_tool_calls:
            try:
                return _generate_tool_call_output()
            except Exception as e:
                logger.warning(f"Tool calling failed: {e}")

        raise ValueError(
            "Failed to generate structured output: neither structured output nor tool "
            "calling succeeded"
        )

    async def async_generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        self._validate_schema(schema)

        supports_structured_output = hasattr(self.client, "with_structured_output")
        supports_tool_calls = hasattr(self.client, "bind_tools") or hasattr(
            self.client, "bind_functions"
        )

        if not supports_structured_output and not supports_tool_calls:
            raise ValueError(
                f"LangChain model {type(self.client).__name__} does not support structured "
                "output or tool calls"
            )

        async def _async_generate_structured_output() -> Dict[str, Any]:
            normalized_schema = self._normalize_schema_for_langchain(schema)
            prompt_input = self._build_prompt(prompt)
            structured_model = self.client.with_structured_output(normalized_schema)

            if hasattr(structured_model, "ainvoke"):
                response = await structured_model.ainvoke(prompt_input, **kwargs)
            else:
                response = structured_model.invoke(prompt_input, **kwargs)

            if isinstance(response, dict):
                return response  # pyright: ignore[reportReturnType,reportUnknownVariableType]
            else:
                raise ValueError(
                    f"Expected dict from structured output with object schema, "
                    f"got {type(response).__name__}: {response}"
                )

        async def _async_generate_tool_call_output() -> Dict[str, Any]:
            tool_definition = self._schema_to_tool(schema)
            prompt_input = self._build_prompt(prompt)

            if hasattr(self.client, "bind_tools"):
                tool_model = self.client.bind_tools([tool_definition])
            elif hasattr(self.client, "bind_functions"):
                tool_model = self.client.bind_functions([tool_definition])
            else:
                raise ValueError("No tool binding method available")

            if hasattr(tool_model, "ainvoke"):
                response = await tool_model.ainvoke(prompt_input, **kwargs)
            else:
                response = tool_model.invoke(prompt_input, **kwargs)

            if hasattr(response, "tool_calls") and response.tool_calls:
                tool_call = response.tool_calls[0]
                if isinstance(tool_call, dict) and "args" in tool_call:
                    return cast(Dict[str, Any], tool_call["args"])
                elif hasattr(tool_call, "args"):  # pyright: ignore[reportArgumentType,reportUnknownArgumentType]
                    return cast(Dict[str, Any], tool_call.args)  # pyright: ignore[reportAttributeAccessIssue]
                else:
                    raise ValueError("Tool call format not supported")
            else:
                raise ValueError("No tool calls found in response")

        if method == ObjectGenerationMethod.STRUCTURED_OUTPUT:
            return await _async_generate_structured_output()
        elif method == ObjectGenerationMethod.TOOL_CALLING:
            return await _async_generate_tool_call_output()

        if supports_structured_output:
            try:
                return await _async_generate_structured_output()
            except Exception as e:
                logger.warning(f"Async structured output failed: {e}, falling back to tool calling")

        if supports_tool_calls:
            try:
                return await _async_generate_tool_call_output()
            except Exception as e:
                logger.warning(f"Async tool calling failed: {e}")

        raise ValueError(
            "Failed to generate structured output: neither structured output nor tool "
            "calling succeeded"
        )

    @property
    def model_name(self) -> str:
        if hasattr(self.client, "model_name"):
            return str(self.client.model_name)
        elif hasattr(self.client, "model"):
            return str(self.client.model)
        else:
            return f"langchain-{type(self.client).__name__}"

    def _is_text_content_part(self, part: ContentPart) -> bool:
        """Type guard to check if a content part is a TextContentPart."""
        return part.get("type") == "text" and "text" in part

    def _transform_messages_to_langchain(self, messages: List[Message]) -> List[Any]:
        """Transform List[Message] TypedDict to LangChain message objects.

        Args:
            messages: List of Message TypedDicts with MessageRole enum.

        Returns:
            List of LangChain message objects.
        """
        from langchain_core.messages import (
            AIMessage,
            HumanMessage,
            SystemMessage,
        )

        lc_messages: List[Any] = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            # Extract text content
            if isinstance(content, str):
                text_content = content
            else:
                # Extract text from TextContentPart items only
                text_parts = []
                for part in content:
                    if self._is_text_content_part(part):
                        text_parts.append(cast(TextContentPart, part)["text"])
                text_content = "\n".join(text_parts)

            # Map MessageRole enum to LangChain message classes
            if role == MessageRole.USER:
                lc_messages.append(HumanMessage(content=text_content))
            elif role == MessageRole.AI:
                lc_messages.append(AIMessage(content=text_content))
            elif role == MessageRole.SYSTEM:
                lc_messages.append(SystemMessage(content=text_content))
            else:
                # Default to HumanMessage for unknown roles
                lc_messages.append(HumanMessage(content=text_content))

        return lc_messages

    def _build_prompt(self, prompt: Union[PromptLike, MultimodalPrompt]) -> Union[str, List[Any]]:
        if isinstance(prompt, str):
            return prompt
        elif isinstance(prompt, list):
            # Check if this is List[Message] with MessageRole enum
            if prompt and isinstance(prompt[0].get("role"), MessageRole):
                # Transform List[Message] to LangChain format
                # Type narrowing: prompt is List[Message] here
                return self._transform_messages_to_langchain(cast(List[Message], prompt))
            # Convert OpenAI-style messages to LangChain messages (backward compatibility)
            try:
                from langchain_community.adapters.openai import (
                    convert_openai_messages,
                )

                return convert_openai_messages(prompt)  # type: ignore[no-any-return]
            except ImportError:
                # Fallback: manual conversion if langchain_community not available
                from langchain_core.messages import (
                    AIMessage,
                    HumanMessage,
                    SystemMessage,
                )

                lc_messages: List[Any] = []
                for msg in prompt:
                    role = msg["role"]
                    content = msg["content"]

                    # Extract text content (matching logic from _transform_messages_to_langchain)
                    if isinstance(content, str):
                        text_content = content
                    else:
                        # Extract text from TextContentPart items only
                        text_parts = []
                        for part in content:
                            if self._is_text_content_part(part):
                                text_parts.append(cast(TextContentPart, part)["text"])
                        text_content = "\n".join(text_parts)

                    if role == "user":
                        lc_messages.append(HumanMessage(content=text_content))
                    elif role == "assistant":
                        lc_messages.append(AIMessage(content=text_content))
                    elif role == "system":
                        lc_messages.append(SystemMessage(content=text_content))
                    else:
                        # Default to HumanMessage for unknown roles
                        lc_messages.append(HumanMessage(content=text_content))
                return lc_messages
        elif isinstance(prompt, MultimodalPrompt):
            # Handle legacy MultimodalPrompt
            return prompt.to_text_only_prompt()
        else:
            # If we get here, prompt is an unexpected type
            # This should never happen given the type hints, but we raise an error to be explicit
            raise ValueError(
                f"Expected prompt to be str, list, or MultimodalPrompt, got {type(prompt).__name__}"
            )

    def _schema_to_tool(self, schema: Dict[str, Any]) -> Dict[str, Any]:
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

    def _normalize_schema_for_langchain(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        normalized = schema.copy()

        if "title" not in normalized:
            normalized["title"] = "GeneratedResponse"

        if "description" not in normalized:
            normalized["description"] = "Structured response from the model"

        return normalized

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
