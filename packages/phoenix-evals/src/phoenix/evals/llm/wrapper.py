from typing import Any, Dict, List, Optional, Union

from phoenix.evals.templates import MultimodalPrompt

from .adapters import register_adapters
from .registries import PROVIDER_REGISTRY, adapter_availability_table

register_adapters()


class LLMBase:
    def __init__(
        self,
        *,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        client: Optional[str] = None,
    ):
        self._is_async: bool = getattr(self, "_is_async", False)
        self.provider = provider
        self.model = model

        by_provider = provider is not None and model is not None

        if not by_provider:
            raise ValueError(
                "Must specify both 'provider' and 'model'. "
                "Examples:\n"
                "  LLM(provider='openai', model='gpt-4')"
            )

        if by_provider:
            if provider is None:
                raise ValueError("Provider must be specified for provider-based initialization")

            provider_registrations = PROVIDER_REGISTRY.get_provider_registrations(provider)
            if not provider_registrations:
                raise ValueError(f"Unknown provider '{provider}'. {adapter_availability_table()}")

            if client is not None:
                for r in provider_registrations:
                    if r.client_name == client:
                        registration = r
                        break
                else:
                    raise ValueError(f"Unknown client '{client}'. {adapter_availability_table()}")
            else:
                registration = provider_registrations[0]

            try:
                client = registration.client_factory(model=model, is_async=self._is_async)
                adapter_class = registration.adapter_class
            except Exception as e:
                raise ValueError(f"Failed to create client for provider '{provider}': {e}") from e

        else:
            # This should never happen due to the initial validation
            raise ValueError("Internal error: cannot initialize LLM wrapper.")

        self._client = client
        self._adapter = adapter_class(client)


class LLM(LLMBase):
    """
    An LLM wrapper that simplifies the API for generating text and objects.

    This wrapper delegates API access to SDK/client libraries that are installed in the active
    Python environment. To show supported providers, use `show_provider_availability()`.

    Args:
        provider: The name of the provider to use.
        model: The name of the model to use.
        client: Optionally, name of the client to use. If not specified, the first available client
            for the provider will be used.

    Examples:
        >>> from phoenix.evals.llm import LLM, show_provider_availability
        >>> show_provider_availability()
        >>> llm = LLM(provider="openai", model="gpt-4o")
        >>> llm.generate_text(prompt="Hello, world!")
        "Hello, world!"
        >>> llm.generate_object(
        ...     prompt="Hello, world!",
        ...     schema={
        ...     "type": "object",
        ...     "properties": {
        ...         "text": {"type": "string"}
        ...     },
        ...     "required": ["text"]
        ... })
        {"text": "Hello, world!"}
    """

    def __init__(self, *args: Any, **kwargs: Any):
        self._is_async = False
        super().__init__(*args, **kwargs)

    def generate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """
        Generate text given a prompt.

        Args:
            prompt: The prompt to generate text from.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated text.
        """
        return self._adapter.generate_text(prompt, **kwargs)

    def generate_object(
        self, prompt: Union[str, MultimodalPrompt], schema: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Generate an object given a prompt and a schema.

        Args:
            prompt: The prompt to generate the object from.
            schema: A JSON schema that describes the generated object.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated object.
        """
        return self._adapter.generate_object(prompt, schema, **kwargs)

    def generate_classification(
        self,
        prompt: Union[str, MultimodalPrompt],
        labels: Union[List[str], Dict[str, str]],
        include_explanation: bool = True,
        description: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate a classification given a prompt and a set of labels.

        Args:
            prompt: The prompt template to go with the tool call.
            labels: Either:
                - A list of strings, where each string is a label
                - A dictionary where keys are labels and values are descriptions
            include_explanation: Whether to prompt the LLM for an explanation.
            description: A description of the classification task.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated classification.

        Examples:
            >>> from phoenix.evals.llm import LLM
            >>> llm = LLM(provider="openai", model="gpt-4o", client="openai")
            >>> llm.generate_classification(
            ...     prompt="Hello, world!",
            ...     labels=["yes", "no"],
            ... )
            {"label": "yes", "explanation": "The answer is yes."}
            >>> llm.generate_classification(
            ...     prompt="Hello, world!",
            ...     labels={"yes": "Positive response", "no": "Negative response"},
            ...     include_explanation=False,
            ... )
            {"label": "yes"}
        """
        # Generate schema from labels
        schema = generate_classification_schema(labels, include_explanation, description)

        return self.generate_object(prompt, schema, **kwargs)


class AsyncLLM(LLMBase):
    """
    An asynchronous LLM wrapper that simplifies the API for generating text and objects.

    This wrapper delegates API access to SDK/client libraries that are installed in the active
    Python environment. To show supported providers, use `show_provider_availability()`.

    Args:
        provider: The name of the provider to use.
        model: The name of the model to use.
        client: Optionally, name of the client to use. If not specified, the first available client
            for the provider will be used.

    Examples:
        >>> from phoenix.evals.llm import AsyncLLM, show_provider_availability
        >>> show_provider_availability()
        >>> llm = AsyncLLM(provider="openai", model="gpt-4o")
        >>> await llm.generate_text(prompt="Hello, world!")
        "Hello, world!"
        >>> await llm.generate_object(
        ...     prompt="Hello, world!",
        ...     schema={
        ...     "type": "object",
        ...     "properties": {
        ...         "text": {"type": "string"}
        ...     },
        ...     "required": ["text"]
        ... })
        {"text": "Hello, world!"}
    """

    def __init__(self, *args: Any, **kwargs: Any):
        self._is_async = True
        super().__init__(*args, **kwargs)

    async def generate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """
        Asynchronously generate text given a prompt.

        Args:
            prompt: The prompt to generate text from.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated text.
        """
        return await self._adapter.agenerate_text(prompt, **kwargs)

    async def generate_object(
        self, prompt: Union[str, MultimodalPrompt], schema: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Asynchronously generate an object given a prompt and a schema.

        Args:
            prompt: The prompt to generate the object from.
            schema: A JSON schema that describes the generated object.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated object.
        """
        return await self._adapter.agenerate_object(prompt, schema, **kwargs)

    async def generate_classification(
        self,
        prompt: Union[str, MultimodalPrompt],
        labels: Union[List[str], Dict[str, str]],
        include_explanation: bool = True,
        description: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Asynchronously generate a classification given a prompt and a set of labels.

        Args:
            prompt: The prompt template to go with the tool call.
            labels: Either:
                - A list of strings, where each string is a label
                - A dictionary where keys are labels and values are descriptions
            include_explanation: Whether to prompt the LLM for an explanation.
            description: A description of the classification task.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated classification.
        """
        # Generate schema from labels
        schema = generate_classification_schema(labels, include_explanation, description)
        return await self.generate_object(prompt, schema, **kwargs)


def show_provider_availability() -> None:
    """Show the availability of all providers."""
    print(adapter_availability_table())


def generate_classification_schema(
    labels: Union[List[str], Dict[str, str]],
    include_explanation: bool = True,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a JSON Schema for an LLM function/structured output call that classifies
    a single criterion.

    Args:
        labels (Union[List[str], Dict[str, str]]): Either:
            - A list of strings, where each string is a label
            - A dictionary where keys are labels and values are descriptions
        include_explanation (bool): Whether to include an explanation field in the schema.
        description (str): A description of the classification task.
    Returns:
        dict: A JSON Schema dict ready for use in an LLM function/structured output call.
    """

    # Validate labels
    if not labels:
        raise ValueError("Labels must be a non-empty list or dictionary.")

    # Determine label type and validate consistency
    if isinstance(labels, dict):
        # Validate that all keys are strings
        if not all(isinstance(key, str) for key in labels.keys()):
            raise ValueError("Labels must be a list of strings or a dictionary.")
        is_str_labels = False
    elif isinstance(labels, list) and all(isinstance(label, str) for label in labels):
        is_str_labels = True
    else:
        raise ValueError("Labels must be a list of strings or a dictionary.")

    # Build label schema base
    label_schema: Dict[str, Any] = {"type": "string"}
    if description:
        label_schema["description"] = description

    # Add labels to schema, either enum or oneOf
    if is_str_labels:
        # Cast to List[str] since we've validated all labels are strings
        str_labels: List[str] = [label for label in labels if isinstance(label, str)]
        label_schema["enum"] = str_labels
    else:
        # Handle dictionary input
        if isinstance(labels, dict):
            one_of_list: List[Dict[str, str]] = []
            for label_name, label_description in labels.items():
                entry = {"const": label_name}
                if label_description:
                    entry["description"] = label_description
                one_of_list.append(entry)
            label_schema["oneOf"] = one_of_list

    # Build final schema
    properties: Dict[str, Any] = {}
    required: List[str] = []

    # Add explanation if requested
    if include_explanation:
        properties["explanation"] = {
            "type": "string",
            "description": "A brief explanation of your reasoning.",
        }
        required.append("explanation")

    properties["label"] = label_schema
    required.append("label")

    return {"type": "object", "properties": properties, "required": required}
