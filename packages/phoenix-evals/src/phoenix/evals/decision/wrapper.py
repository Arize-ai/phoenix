import functools
import json
from inspect import BoundArguments
from typing import Any, Dict, List, Optional, Union

import opentelemetry.trace as trace_api
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.trace import Tracer

from phoenix.evals.rate_limiters import RateLimiter
from phoenix.evals.tracing import trace

from ..llm.prompts import PromptLike
from .adapters import register_adapters
from .registries import DECISION_PROVIDER_REGISTRY, adapter_availability_table
from .types import BaseDecisionAdapter

register_adapters()


def _get_decision_system(bound: BoundArguments) -> str:
    """The decision API shape (the adapter's ``client_name()``), e.g. ``typesafe``."""
    return getattr(bound.arguments["self"], "_client_name", "") or ""


def _get_decision_provider(bound: BoundArguments) -> str:
    """The host that serves the model (the ``provider`` argument), e.g. ``typesafe``."""
    return bound.arguments["self"].provider or ""


def _get_decision_model_name(bound: BoundArguments) -> str:
    """The requested model name, e.g. ``jev-latest``."""
    return bound.arguments["self"].model or ""


def _get_decision_input(bound: BoundArguments) -> str:
    """A JSON view of the request: the flattened state, the model, and the labels."""
    prompt = bound.arguments.get("prompt")
    payload = {
        "state": BaseDecisionAdapter._to_state(prompt) if prompt is not None else "",
        "model": bound.arguments["self"].model,
        "questions": bound.arguments.get("labels"),
    }
    return json.dumps(payload, default=str)


def _jsonify_output(result: Any) -> str:
    """Convert the classification result to a JSON string for the span output."""
    return json.dumps(result, default=str)


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
        self._client_name = registration.client_name
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

    @staticmethod
    def _record_usage_on_span(result: Dict[str, Any]) -> None:
        """Move per-call telemetry from the result onto the current DECISION span.

        ``@trace`` makes its span current while the method runs, so this pops ``usage`` off the
        result (keeping it out of ``Score.metadata``) and sets the response model name and token
        counts on the span, where they show up once per call in the trace.
        """
        usage = result.pop("usage", None) or {}
        span = trace_api.get_current_span()
        attributes = {
            SpanAttributes.DECISION_RESPONSE_MODEL_NAME: result.get("metadata", {}).get("model_id"),
            SpanAttributes.DECISION_TOKEN_COUNT_INPUT: usage.get("input_tokens"),
            SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT: usage.get("output_tokens"),
        }
        for key, value in attributes.items():
            if value is not None:
                span.set_attribute(key, value)

    @trace(
        span_kind=OpenInferenceSpanKindValues.DECISION,
        process_input={
            SpanAttributes.DECISION_SYSTEM: _get_decision_system,
            SpanAttributes.DECISION_PROVIDER: _get_decision_provider,
            SpanAttributes.DECISION_REQUEST_MODEL_NAME: _get_decision_model_name,
            SpanAttributes.INPUT_VALUE: _get_decision_input,
        },
        process_output={SpanAttributes.OUTPUT_VALUE: _jsonify_output},
    )
    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        include_explanation: bool = True,
        method: Any = None,
        tracer: Optional[Tracer] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Classify a prompt by selecting exactly one of the labels.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to classify.
            labels (Union[List[str], Dict[str, str]]): Either a list of label strings, or a dict
                mapping each label to a description.
            include_explanation (bool): Sent by ``ClassificationEvaluator`` but not used by
                decision models, which are decision-only and return no explanation.
            method (Any): Sent by ``ClassificationEvaluator`` (the object-generation method) but
                not used by decision models.
            tracer (Optional[Tracer]): Optional tracer for the DECISION span. If not provided,
                the global tracer provider is used.
            **kwargs: Additional keyword arguments forwarded to the decision SDK call (e.g.
                ``timeout``, ``retry``, ``extra_headers``, ``extra_body``).

        Returns:
            Dict[str, Any]: A dict with a ``label`` key and an optional ``metadata`` key.
        """
        fn = self._sync_adapter.generate_classification
        rate_limited = functools.reduce(
            lambda fn, limiter: limiter.limit(fn), self._rate_limiters, fn
        )
        result: Dict[str, Any] = rate_limited(prompt, labels, **kwargs)
        self._record_usage_on_span(result)
        return result

    @trace(
        span_kind=OpenInferenceSpanKindValues.DECISION,
        process_input={
            SpanAttributes.DECISION_SYSTEM: _get_decision_system,
            SpanAttributes.DECISION_PROVIDER: _get_decision_provider,
            SpanAttributes.DECISION_REQUEST_MODEL_NAME: _get_decision_model_name,
            SpanAttributes.INPUT_VALUE: _get_decision_input,
        },
        process_output={SpanAttributes.OUTPUT_VALUE: _jsonify_output},
    )
    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        include_explanation: bool = True,
        method: Any = None,
        tracer: Optional[Tracer] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Asynchronously classify a prompt by selecting exactly one of the labels.

        Args:
            prompt (Union[str, List[Dict[str, Any]]]): The prompt to classify.
            labels (Union[List[str], Dict[str, str]]): Either a list of label strings, or a dict
                mapping each label to a description.
            include_explanation (bool): Sent by ``ClassificationEvaluator`` but not used by
                decision models, which are decision-only and return no explanation.
            method (Any): Sent by ``ClassificationEvaluator`` (the object-generation method) but
                not used by decision models.
            tracer (Optional[Tracer]): Optional tracer for the DECISION span. If not provided,
                the global tracer provider is used.
            **kwargs: Additional keyword arguments forwarded to the decision SDK call (e.g.
                ``timeout``, ``retry``, ``extra_headers``, ``extra_body``).

        Returns:
            Dict[str, Any]: A dict with a ``label`` key and an optional ``metadata`` key.
        """
        fn = self._async_adapter.async_generate_classification
        rate_limited = functools.reduce(
            lambda fn, limiter: limiter.alimit(fn), self._rate_limiters, fn
        )
        result: Dict[str, Any] = await rate_limited(prompt, labels, **kwargs)
        self._record_usage_on_span(result)
        return result


def show_decision_provider_availability() -> None:
    """Show the availability of all decision providers.

    Prints a formatted table showing which providers are available and which are disabled
    due to missing dependencies.
    """
    print(adapter_availability_table())
