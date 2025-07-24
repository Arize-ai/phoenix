import logging
from typing import Any, Dict, Union, cast

from phoenix.evals.templates import MultimodalPrompt

from ...registries import register_adapter, register_provider
from ...types import BaseLLMAdapter
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


@register_adapter(
    identifier=identify_langchain_client,
    name="langchain",
)
@register_provider(
    provider="openai",
    client_factory=create_openai_langchain_client,  # pyright: ignore
    dependencies=["langchain", "langchain_openai"],
)
@register_provider(
    provider="anthropic",
    client_factory=create_anthropic_langchain_client,  # pyright: ignore
    dependencies=["langchain", "langchain_anthropic"],
)
class LangChainModelAdapter(BaseLLMAdapter):
    def __init__(self, client: Any):
        self.client = client
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

    def generate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
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

    async def agenerate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
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
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
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

        if supports_structured_output:
            try:
                normalized_schema = self._normalize_schema_for_langchain(schema)
                prompt_input = self._build_prompt(prompt)
                structured_model = self.client.with_structured_output(normalized_schema)

                response = structured_model.invoke(prompt_input, **kwargs)

                if isinstance(response, dict):
                    return response
                else:
                    import json

                    if hasattr(response, "__dict__"):
                        result = response.__dict__
                        return cast(Dict[str, Any], result)
                    else:
                        return cast(Dict[str, Any], json.loads(str(response)))

            except Exception as e:
                logger.warning(f"Structured output failed: {e}, falling back to tool calling")

        if supports_tool_calls:
            try:
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
                    elif hasattr(tool_call, "args"):
                        return cast(Dict[str, Any], tool_call.args)

            except Exception as e:
                logger.warning(f"Tool calling failed: {e}")

        raise ValueError(
            "Failed to generate structured output: neither structured output nor tool "
            "calling succeeded"
        )

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
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

        if supports_structured_output:
            try:
                normalized_schema = self._normalize_schema_for_langchain(schema)
                prompt_input = self._build_prompt(prompt)
                structured_model = self.client.with_structured_output(normalized_schema)

                if hasattr(structured_model, "ainvoke"):
                    response = await structured_model.ainvoke(prompt_input, **kwargs)
                else:
                    response = structured_model.invoke(prompt_input, **kwargs)

                if isinstance(response, dict):
                    return response
                else:
                    import json

                    if hasattr(response, "__dict__"):
                        result = response.__dict__
                        return cast(Dict[str, Any], result)
                    else:
                        return cast(Dict[str, Any], json.loads(str(response)))

            except Exception as e:
                logger.warning(f"Async structured output failed: {e}, falling back to tool calling")

        if supports_tool_calls:
            try:
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
                    elif hasattr(tool_call, "args"):
                        return cast(Dict[str, Any], tool_call.args)

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

    def _build_prompt(self, prompt: Union[str, MultimodalPrompt]) -> str:
        if isinstance(prompt, MultimodalPrompt):
            return prompt.to_text_only_prompt()
        else:
            return prompt

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
