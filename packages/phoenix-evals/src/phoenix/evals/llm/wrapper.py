import functools
import json
from inspect import BoundArguments
from typing import Any, Dict, List, Optional, Union

from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.trace import Tracer

from phoenix.evals.legacy.templates import MultimodalPrompt
from phoenix.evals.rate_limiters import RateLimiter
from phoenix.evals.tracing import trace

from .adapters import register_adapters
from .prompts import PromptLike
from .registries import PROVIDER_REGISTRY, adapter_availability_table

register_adapters()


def _get_llm_model_name(bound: BoundArguments) -> str:
    """Extract model name from bound function arguments.

    Args:
        bound (BoundArguments): Bound arguments from function call inspection.

    Returns:
        str: Model name from the 'self.model' attribute, or empty string if not found.
    """
    return bound.arguments["self"].model or ""


def _get_prompt(bound: BoundArguments) -> str:
    """Extract prompt text from bound function arguments.

    Converts PromptLike (str, List[Message], or List[Dict]) to a string representation
    suitable for tracing. Message lists are converted to JSON format.

    Args:
        bound (BoundArguments): Bound arguments from function call inspection.

    Returns:
        str: Prompt text from arguments as a string, or empty string if not found.
    """
    prompt = bound.arguments.get("prompt", "")

    # Handle empty/falsy values
    if not prompt:
        return ""

    # If it's already a string, return as-is
    if isinstance(prompt, str):
        return prompt

    # If it's a list (List[Message] or List[Dict]), convert to JSON string
    if isinstance(prompt, list):
        # Convert Message objects to serializable format
        serializable_prompt = []
        for msg in prompt:
            if isinstance(msg, dict):
                # Handle Message TypedDict or plain dict
                serializable_msg = dict(msg)
                # Convert MessageRole enum to string if present
                if "role" in serializable_msg and hasattr(serializable_msg["role"], "value"):
                    serializable_msg["role"] = serializable_msg["role"].value
                serializable_prompt.append(serializable_msg)
            else:
                serializable_prompt.append(msg)
        return json.dumps(serializable_prompt, indent=2)

    # Fallback: convert to string representation
    return str(prompt)


def _get_output(result: Any) -> Any:
    """Pass-through function for output processing in tracing.

    Args:
        result (Any): The raw result from function execution.

    Returns:
        Any: The unmodified result.
    """
    return result


def _jsonify_output(result: Any) -> str:
    """Convert result to JSON string representation.

    Args:
        result (Any): The result to convert to JSON.

    Returns:
        str: JSON string representation of the result.
    """
    return json.dumps(result)


class LLM:
    """An LLM wrapper that simplifies the API for generating text and objects.

    This wrapper delegates API access to SDK/client libraries that are installed in the active
    Python environment. To show supported providers, use `show_provider_availability()`.

    The LLM class provides both synchronous and asynchronous methods for all operations.

    Examples::

        from phoenix.evals.llm import LLM, show_provider_availability
        show_provider_availability()
        llm = LLM(provider="openai", model="gpt-4o")
        llm.generate_text(prompt="Hello, world!")
        "Hello, world!"
        llm.generate_object(
            prompt="Hello, world!",
            schema={
                "type": "object",
                "properties": {
                    "text": {"type": "string"}
                },
                "required": ["text"]
            })
        {"text": "Hello, world!"}
    """

    def __init__(
        self,
        *,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        client: Optional[str] = None,
        initial_per_second_request_rate: Optional[float] = None,
        sync_client_kwargs: Optional[Dict[str, Any]] = None,
        async_client_kwargs: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ):
        """Initialize the LLM wrapper.

        Args:
            provider (str): The name of the provider to use.
            model (str): The name of the model to use.
            client (Optional[str]): Optionally, name of the client to use. If not specified, the
                first available client for the provider will be used.
            initial_per_second_request_rate (Optional[float]): Optionally, the initial per-second
                request rate. If not specified, the default rate limit will be used.
            sync_client_kwargs (Optional[Dict[str, Any]]): Additional keyword arguments forwarded
                exclusively to the synchronous SDK client constructor. For providers that create
                separate sync and async SDK clients (e.g., OpenAI, Anthropic), these kwargs are
                passed only when constructing the sync client. This allows configuring sync-specific
                options such as different timeouts or HTTP clients. Values here override any
                matching keys in **kwargs for the sync client only.
            async_client_kwargs (Optional[Dict[str, Any]]): Additional keyword arguments forwarded
                exclusively to the asynchronous SDK client constructor. For providers that create
                separate sync and async SDK clients (e.g., OpenAI, Anthropic), these kwargs are
                passed only when constructing the async client. This allows configuring
                async-specific options such as different timeouts or HTTP clients. Values here
                override any matching keys in **kwargs for the async client only.
            **kwargs (Any): Additional keyword arguments forwarded to both sync and async SDK
                client constructors. Use this to pass shared provider/client-specific options such
                as API keys, base URLs, etc. These are merged with sync_client_kwargs or
                async_client_kwargs, with the specific kwargs taking precedence.

        Example::

            from phoenix.evals import LLM
            llm = LLM(
                provider="azure",
                model="gpt-5o",
                api_key="your-api-key",
                api_version="api-version",
                base_url="base-url",
            )

            # Using sync_client_kwargs and async_client_kwargs for different timeouts
            llm = LLM(
                provider="openai",
                model="gpt-4o",
                api_key="your-api-key",
                sync_client_kwargs={"timeout": 60.0},
                async_client_kwargs={"timeout": 120.0},
            )
        """
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
                sync_client = registration.client_factory(
                    model=model, is_async=False, **kwargs, **(sync_client_kwargs or {})
                )
                async_client = registration.client_factory(
                    model=model, is_async=True, **kwargs, **(async_client_kwargs or {})
                )
                rate_limit_errors = (
                    registration.get_rate_limit_errors()
                    if registration.get_rate_limit_errors
                    else []
                )
                adapter_class = registration.adapter_class
            except Exception as e:
                raise ValueError(f"Failed to create client for provider '{provider}': {e}") from e

        else:
            # This should never happen due to the initial validation
            raise ValueError("Internal error: cannot initialize LLM wrapper.")

        assert model is not None, "The model needs to be specified along with the provider."
        self._sync_client = sync_client
        self._async_client = async_client
        self._sync_adapter = adapter_class(sync_client, model=model)
        self._async_adapter = adapter_class(async_client, model=model)
        self._rate_limit_errors = rate_limit_errors
        rate_limit_args: Dict[str, Any] = {}
        if initial_per_second_request_rate is not None:
            rate_limit_args["initial_per_second_request_rate"] = initial_per_second_request_rate
        self._rate_limiters = [
            RateLimiter(
                rate_limit_error=error,
                **rate_limit_args,
            )
            for error in rate_limit_errors
        ]

    @trace(
        span_kind=OpenInferenceSpanKindValues.LLM,
        process_input={
            SpanAttributes.LLM_MODEL_NAME: _get_llm_model_name,
            SpanAttributes.INPUT_VALUE: _get_prompt,
        },
        process_output={SpanAttributes.OUTPUT_VALUE: _get_output},
    )
    def generate_text(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        tracer: Optional[Tracer] = None,
        **kwargs: Any,
    ) -> str:
        """Generate text given a prompt.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to generate text from.
            tracer (Optional[Tracer]): Optional tracer for tracing operations.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            str: The generated text.
        """
        fn = self._sync_adapter.generate_text
        rate_limited_generate = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), self._rate_limiters, fn
        )
        return rate_limited_generate(prompt, **kwargs)

    @trace(
        span_kind=OpenInferenceSpanKindValues.LLM,
        process_input={
            SpanAttributes.LLM_MODEL_NAME: _get_llm_model_name,
            SpanAttributes.INPUT_VALUE: _get_prompt,
        },
        process_output={SpanAttributes.OUTPUT_VALUE: _jsonify_output},
    )
    def generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        tracer: Optional[Tracer] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate an object given a prompt and a schema.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to generate the object from.
            schema (Dict[str, Any]): A JSON schema that describes the generated object.
            tracer (Optional[Tracer]): Optional tracer for tracing operations.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            Dict[str, Any]: The generated object.
        """
        fn = self._sync_adapter.generate_object
        rate_limited_generate = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), self._rate_limiters, fn
        )
        return rate_limited_generate(prompt, schema, **kwargs)

    def generate_classification(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        labels: Union[List[str], Dict[str, str]],
        include_explanation: bool = True,
        description: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate a classification given a prompt and a set of labels.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt template to go with the tool call.
            labels (Union[List[str], Dict[str, str]]): Either:
                - A list of strings, where each string is a label
                - A dictionary where keys are labels and values are descriptions
            include_explanation (bool): Whether to prompt the LLM for an explanation.
            description (Optional[str]): A description of the classification task.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            Dict[str, Any]: The generated classification.

        Examples::

            from phoenix.evals import LLM
            llm = LLM(provider="openai", model="gpt-4o", client="openai")
            llm.generate_classification(
                prompt="Hello, world!",
                labels=["yes", "no"],
            )
            {"label": "yes", "explanation": "The answer is yes."}
            llm.generate_classification(
                prompt="Hello, world!",
                labels={"yes": "Positive response", "no": "Negative response"},
                include_explanation=False,
            )
            {"label": "yes"}
        """
        # Generate schema from labels
        schema = generate_classification_schema(labels, include_explanation, description)
        result: Dict[str, Any] = self.generate_object(prompt, schema, **kwargs)
        return result

    @trace(
        span_kind=OpenInferenceSpanKindValues.LLM,
        process_input={
            SpanAttributes.LLM_MODEL_NAME: _get_llm_model_name,
            SpanAttributes.INPUT_VALUE: _get_prompt,
        },
        process_output={SpanAttributes.OUTPUT_VALUE: _get_output},
    )
    async def async_generate_text(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        tracer: Optional[Tracer] = None,
        **kwargs: Any,
    ) -> str:
        """Asynchronously generate text given a prompt.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to generate text from.
            tracer (Optional[Tracer]): The tracer to use for tracing.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            str: The generated text.
        """
        fn = self._async_adapter.async_generate_text
        rate_limited_generate = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), self._rate_limiters, fn
        )
        return await rate_limited_generate(prompt, **kwargs)

    @trace(
        span_kind=OpenInferenceSpanKindValues.LLM,
        process_input={
            SpanAttributes.LLM_MODEL_NAME: _get_llm_model_name,
            SpanAttributes.INPUT_VALUE: _get_prompt,
        },
        process_output={SpanAttributes.OUTPUT_VALUE: _jsonify_output},
    )
    async def async_generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        tracer: Optional[Tracer] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Asynchronously generate an object given a prompt and a schema.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to generate the object from.
            schema (Dict[str, Any]): A JSON schema that describes the generated object.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            Dict[str, Any]: The generated object.
        """
        fn = self._async_adapter.async_generate_object
        rate_limited_generate = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), self._rate_limiters, fn
        )
        return await rate_limited_generate(prompt, schema, **kwargs)

    async def async_generate_classification(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        labels: Union[List[str], Dict[str, str]],
        include_explanation: bool = True,
        description: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Asynchronously generate a classification given a prompt and a set of labels.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt template to go with the tool call.
            labels (Union[List[str], Dict[str, str]]): Either:
                - A list of strings, where each string is a label
                - A dictionary where keys are labels and values are descriptions
            include_explanation (bool): Whether to prompt the LLM for an explanation.
            description (Optional[str]): A description of the classification task.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            Dict[str, Any]: The generated classification.
        """
        # Generate schema from labels
        schema = generate_classification_schema(labels, include_explanation, description)
        result: Dict[str, Any] = await self.async_generate_object(prompt, schema, **kwargs)
        return result


def show_provider_availability() -> None:
    """Show the availability of all providers.

    Prints a formatted table showing which providers are available and which are disabled
    due to missing dependencies.
    """
    print(adapter_availability_table())


def generate_classification_schema(
    labels: Union[List[str], Dict[str, str]],
    include_explanation: bool = True,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a JSON Schema for an LLM function/structured output call that classifies
    a single criterion.

    Args:
        labels (Union[List[str], Dict[str, str]]): Either:
            - A list of strings, where each string is a label
            - A dictionary where keys are labels and values are descriptions
        include_explanation (bool): Whether to include an explanation field in the schema.
        description (Optional[str]): A description of the classification task.

    Returns:
        Dict[str, Any]: A JSON Schema dict ready for use in an LLM function/structured output call.

    Raises:
        ValueError: If labels is empty or invalid.
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
