"""
LiteLLM adapter implementation for the Universal LLM Wrapper.
"""

import json
import logging
from typing import Any, Dict, Optional, Union

from phoenix.evals.templates import MultimodalPrompt

from ...types import BaseLLMAdapter
from ...registries import register_provider
from .client import LiteLLMClient
from .factories import (
    create_anthropic_client,
    create_litellm_client,
    create_openai_client,
)

logger = logging.getLogger(__name__)


@register_provider(
    provider="anthropic", client_factory=create_anthropic_client, dependencies=["litellm"]
)
@register_provider(provider="openai", client_factory=create_openai_client, dependencies=["litellm"])
@register_provider(
    provider="litellm", client_factory=create_litellm_client, dependencies=["litellm"]
)
class LiteLLMAdapter(BaseLLMAdapter):
    """Adapter for LiteLLM function-based interface."""

    def __init__(self, client: LiteLLMClient):
        self.client = client
        self._validate_client()
        self._import_litellm()

    def _validate_client(self) -> None:
        """Validate that the client is a LiteLLMClient."""
        if not isinstance(self.client, LiteLLMClient):
            raise ValueError(
                f"LiteLLMAdapter requires a LiteLLMClient instance, got {type(self.client)}"
            )

    def _import_litellm(self) -> None:
        """Initialize LiteLLM library."""
        try:
            import litellm

            self._litellm = litellm
        except ImportError:
            raise ImportError("LiteLLM package not installed. Run: pip install litellm")

    def generate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Generate text using LiteLLM."""
        # Convert multimodal prompt to text
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        # Build messages for LiteLLM
        messages = []
        if instruction:
            messages.append({"role": "system", "content": instruction})
        messages.append({"role": "user", "content": prompt_text})

        # Merge client config with call-specific kwargs
        call_kwargs = {**self.client.config, **kwargs}

        try:
            response = self._litellm.completion(
                model=self.client.model_string, messages=messages, **call_kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LiteLLM completion failed: {e}")
            raise

    async def agenerate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Async text generation using LiteLLM."""
        # Convert multimodal prompt to text
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        # Build messages for LiteLLM
        messages = []
        if instruction:
            messages.append({"role": "system", "content": instruction})
        messages.append({"role": "user", "content": prompt_text})

        # Merge client config with call-specific kwargs
        call_kwargs = {**self.client.config, **kwargs}

        try:
            response = await self._litellm.acompletion(
                model=self.client.model_string, messages=messages, **call_kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LiteLLM async completion failed: {e}")
            raise

    def generate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate structured output using LiteLLM.

        Since LiteLLM doesn't have native structured output, we use JSON parsing.

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        # Build structured instruction
        structured_prompt = self._build_structured_instruction(prompt, schema)

        # Generate text response
        text = self.generate_text(structured_prompt, None, **kwargs)

        # Parse JSON from response
        try:
            data = json.loads(text)
            return data
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse JSON from LiteLLM response: {e}")
            logger.warning(f"Raw response: {text}")
            return {}

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Async generate structured output using LiteLLM.

        Since LiteLLM doesn't have native structured output, we use JSON parsing.

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        # Build structured instruction
        structured_prompt = self._build_structured_instruction(prompt, schema)

        # Generate text response
        text = await self.agenerate_text(structured_prompt, None, **kwargs)

        # Parse JSON from response
        try:
            data = json.loads(text)
            return data
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to parse JSON from LiteLLM async response: {e}")
            logger.warning(f"Raw response: {text}")
            return {}

    @property
    def model_name(self) -> str:
        """Return the LiteLLM model name."""
        return self.client.model_string

    def _build_structured_instruction(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
    ) -> str:
        """
        Build a standardized instruction for structured output generation.
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
            try:
                schema_str = json.dumps(schema, indent=2)
                structured_instruction += f"\n\nRequired JSON Schema:\n{schema_str}"
            except (TypeError, ValueError):
                # If schema can't be serialized, provide a general instruction
                structured_instruction += (
                    "\n\nThe response must conform to the provided schema structure."
                )

        # Combine instruction with prompt
        return f"{structured_instruction}\n\n{prompt_text}"

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
