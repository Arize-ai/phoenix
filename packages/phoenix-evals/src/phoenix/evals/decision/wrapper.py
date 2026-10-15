import functools
from typing import Any, Dict, List, Optional, Union

from phoenix.evals.rate_limiters import RateLimiter

from ..llm.prompts import PromptLike
from .adapters import register_adapters
from .registries import DECISION_PROVIDER_REGISTRY, adapter_availability_table

register_adapters()


class DecisionModel:
    """A decision model (e.g. TypeSafe's Jev) used as a classification judge.

    Unlike :class:`LLM`, a decision model only answers typed questions and cannot generate
    free-form text. A classification is routed through a single ``choice`` question whose
    options are the labels, so the result carries a label and the label probabilities (as
    metadata) but no explanation.

    Like :class:`LLM`, this wrapper delegates API access to SDK/client libraries installed in
    the active Python environment and selects the adapter by provider. To show supported
    providers, use ``show_decision_provider_availability()``.

    Example::

        from phoenix.evals import ClassificationEvaluator, DecisionModel

        evaluator = ClassificationEvaluator(
            name="sentiment",
            llm=DecisionModel(provider="typesafe", model="jev-latest"),
            prompt_template="Classify the sentiment: {text}",
            choices=["positive", "negative", "neutral"],
        )
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
        """Initialize the DecisionModel wrapper.

        Args:
            provider (str): The name of the decision provider to use (e.g. "typesafe").
            model (str): The name of the model to use (e.g. "jev-latest").
            client (Optional[str]): Optionally, name of the client to use. If not specified, the
                first available client for the provider will be used.
            initial_per_second_request_rate (Optional[float]): Optionally, the initial per-second
                request rate. If not specified, the default rate limit will be used.
            sync_client_kwargs (Optional[Dict[str, Any]]): Additional keyword arguments forwarded
                exclusively to the synchronous SDK client constructor.
            async_client_kwargs (Optional[Dict[str, Any]]): Additional keyword arguments forwarded
                exclusively to the asynchronous SDK client constructor.
            **kwargs (Any): Additional keyword arguments forwarded to both sync and async SDK
                client constructors (e.g. api_key, base_url). These are merged with
                sync_client_kwargs or async_client_kwargs, with the specific kwargs taking
                precedence.

        Example::

            from phoenix.evals import DecisionModel
            dm = DecisionModel(
                provider="typesafe",
                model="jev-latest",
                api_key="your-api-key",
            )
        """
        self.provider = provider
        self.model = model

        by_provider = provider is not None and model is not None

        if not by_provider:
            raise ValueError(
                "Must specify both 'provider' and 'model'. "
                "Examples:\n"
                "  DecisionModel(provider='typesafe', model='jev-latest')"
            )

        if provider is None:
            raise ValueError("Provider must be specified for provider-based initialization")

        provider_registrations = DECISION_PROVIDER_REGISTRY.get_provider_registrations(provider)
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
                registration.get_rate_limit_errors() if registration.get_rate_limit_errors else []
            )
            adapter_class = registration.adapter_class
        except Exception as e:
            raise ValueError(f"Failed to create client for provider '{provider}': {e}") from e

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

    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Classify a prompt by selecting exactly one of the labels.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to classify.
            labels (Union[List[str], Dict[str, str]]): Either a list of label strings, or a dict
                mapping each label to a description.
            **kwargs: Additional keyword arguments to pass to the decision SDK.

        Returns:
            Dict[str, Any]: A dict with a ``label`` key and an optional ``metadata`` key.
        """
        fn = self._sync_adapter.generate_classification
        rate_limited = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), self._rate_limiters, fn
        )
        return rate_limited(prompt, labels, **kwargs)

    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Asynchronously classify a prompt by selecting exactly one of the labels.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to classify.
            labels (Union[List[str], Dict[str, str]]): Either a list of label strings, or a dict
                mapping each label to a description.
            **kwargs: Additional keyword arguments to pass to the decision SDK.

        Returns:
            Dict[str, Any]: A dict with a ``label`` key and an optional ``metadata`` key.
        """
        fn = self._async_adapter.async_generate_classification
        rate_limited = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), self._rate_limiters, fn
        )
        return await rate_limited(prompt, labels, **kwargs)


def show_decision_provider_availability() -> None:
    """Show the availability of all decision providers.

    Prints a formatted table showing which providers are available and which are disabled
    due to missing dependencies.
    """
    print(adapter_availability_table())
