"""
LangChain adapter implementation for the Universal LLM Wrapper.
"""

import logging
from typing import Any, Dict, Optional, Union

from phoenix.evals.templates import MultimodalPrompt

from ...types import BaseLLMAdapter
from ...registries import register_adapter, register_provider
from .factories import (
    create_anthropic_langchain_client,
    create_openai_langchain_client,
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
    priority=10,
    name="langchain",
)
@register_provider(
    provider="openai",
    client_factory=create_openai_langchain_client,
    dependencies=["langchain", "langchain_openai"]
)
@register_provider(
    provider="anthropic",
    client_factory=create_anthropic_langchain_client,
    dependencies=["langchain", "langchain_anthropic"]
)
class LangChainModelAdapter(BaseLLMAdapter):
    """Adapter for LangChain model objects."""

    def __init__(self, client: Any):
        self.client = client
        self._validate_client()

    def _validate_client(self) -> None:
        # Check for common LangChain model methods
        if not (hasattr(self.client, "invoke") or hasattr(self.client, "predict")):
            raise ValueError(
                f"LangChainModelAdapter requires a LangChain model instance with 'invoke' or 'predict' method, "
                f"got {type(self.client)}"
            )

    def generate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Generate text using the LangChain model."""
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        if instruction:
            prompt_text = f"{instruction}\n\n{prompt_text}"

        # Try different LangChain invocation methods
        if hasattr(self.client, "invoke"):
            response = self.client.invoke(prompt_text, **kwargs)
        elif hasattr(self.client, "predict"):
            response = self.client.predict(prompt_text, **kwargs)
        else:
            # Fallback to direct call
            response = self.client(prompt_text, **kwargs)

        # Handle different response types
        if hasattr(response, "content"):
            return response.content
        elif isinstance(response, str):
            return response
        else:
            return str(response)

    async def agenerate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Async text generation using the LangChain model."""
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        if instruction:
            prompt_text = f"{instruction}\n\n{prompt_text}"

        # Try async methods
        if hasattr(self.client, "ainvoke"):
            response = await self.client.ainvoke(prompt_text, **kwargs)
        elif hasattr(self.client, "apredict"):
            response = await self.client.apredict(prompt_text, **kwargs)
        else:
            # Fallback to sync method
            response = self.generate_text(prompt, instruction, **kwargs)

        # Handle different response types
        if hasattr(response, "content"):
            return response.content
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
        """
        Generate structured output using LangChain model.

        Falls back to tool calling if structured output is not natively supported.

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        # Check if the model supports structured output natively
        if hasattr(self.client, "with_structured_output"):
            try:
                # Normalize schema for LangChain requirements
                normalized_schema = self._normalize_schema_for_langchain(schema)

                # Try native structured output - use standardized instruction
                structured_prompt = self._build_structured_instruction(prompt, schema)
                structured_model = self.client.with_structured_output(normalized_schema)

                response = structured_model.invoke(structured_prompt, **kwargs)

                # Handle different response formats
                if isinstance(response, dict):
                    return response
                else:
                    # Try to convert to dict
                    import json

                    if hasattr(response, "__dict__"):
                        data = response.__dict__
                    else:
                        data = json.loads(str(response))
                    return data

            except Exception as e:
                logger.warning(f"Structured output failed: {e}, falling back to tool calling")

        # Final fallback: try to parse JSON from text response with standardized instruction
        structured_prompt = self._build_structured_instruction(prompt, schema)
        text = self.generate_text(structured_prompt, None, **kwargs)
        import json

        try:
            data = json.loads(text)
            return data
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse JSON from text response, returning empty object")
            return {}

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Async generate structured output using LangChain model.

        Falls back to tool calling if structured output is not natively supported.

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        # Check if the model supports structured output natively
        if hasattr(self.client, "with_structured_output"):
            try:
                # Normalize schema for LangChain requirements
                normalized_schema = self._normalize_schema_for_langchain(schema)

                # Try native structured output - use standardized instruction
                structured_prompt = self._build_structured_instruction(prompt, schema)
                structured_model = self.client.with_structured_output(normalized_schema)

                if hasattr(structured_model, "ainvoke"):
                    response = await structured_model.ainvoke(structured_prompt, **kwargs)
                else:
                    response = structured_model.invoke(structured_prompt, **kwargs)

                # Handle different response formats
                if isinstance(response, dict):
                    return response
                else:
                    # Try to convert to dict
                    import json

                    if hasattr(response, "__dict__"):
                        data = response.__dict__
                    else:
                        data = json.loads(str(response))
                    return data

            except Exception as e:
                logger.warning(f"Async structured output failed: {e}, falling back to tool calling")

        # Final fallback: try to parse JSON from text response with standardized instruction
        structured_prompt = self._build_structured_instruction(prompt, schema)
        text = await self.agenerate_text(structured_prompt, None, **kwargs)
        import json

        try:
            data = json.loads(text)
            return data
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse JSON from async text response, returning empty object")
            return {}

    @property
    def model_name(self) -> str:
        """Return the LangChain model name."""
        if hasattr(self.client, "model_name"):
            return self.client.model_name
        elif hasattr(self.client, "model"):
            return self.client.model
        else:
            return f"langchain-{type(self.client).__name__}"

    def _build_structured_instruction(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
    ) -> str:
        """
        Build a standardized instruction for structured output generation.

        This ensures consistent instruction format regardless of whether we're using
        native structured output, tool calling, or different SDK implementations.
        """
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        # Validate schema before processing
        self._validate_schema(schema)

        # Build the structured output instruction
        structured_instruction = (
            "You must respond with valid JSON that conforms to the provided schema. "
            "Do not include any additional text, explanations, or formatting outside of the JSON response."
        )

        # Add schema information if available
        if schema:
            import json

            try:
                schema_str = json.dumps(schema, indent=2)
                structured_instruction += f"\n\nRequired JSON Schema:\n{schema_str}"
            except (TypeError, ValueError):
                # If schema can't be serialized, provide a general instruction
                structured_instruction += (
                    f"\n\nThe response must conform to the provided schema structure."
                )

        # Combine instruction with prompt
        return f"{structured_instruction}\n\n{prompt_text}"

    def _normalize_schema_for_langchain(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize JSON schema for LangChain's with_structured_output requirements.

        LangChain requires JSON schemas to have 'title' and 'description' at the top level.
        This method automatically adds them if missing.
        """
        normalized = schema.copy()

        # Add title if missing
        if "title" not in normalized:
            normalized["title"] = "GeneratedResponse"

        # Add description if missing
        if "description" not in normalized:
            normalized["description"] = "Structured response from the model"

        return normalized

    def _validate_schema(self, schema: Dict[str, Any]) -> None:
        """
        Validate that the schema is well-formed.

        Checks for common issues like required fields not matching properties.
        """
        if not isinstance(schema, dict):
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
