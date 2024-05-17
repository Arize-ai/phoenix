import logging
import os
import warnings
from dataclasses import dataclass, field, fields
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Mapping,
    Optional,
    Tuple,
    Union,
    get_args,
    get_origin,
)

from phoenix.evals.exceptions import PhoenixContextLimitExceeded
from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter

OPENAI_API_KEY_ENVVAR_NAME = "OPENAI_API_KEY"
MINIMUM_OPENAI_VERSION = "1.0.0"
MODEL_TOKEN_LIMIT_MAPPING = {
    "gpt-3.5-turbo-instruct": 4096,
    "gpt-3.5-turbo-0301": 4096,
    "gpt-3.5-turbo-0613": 4096,  # Current gpt-3.5-turbo default
    "gpt-3.5-turbo-16k-0613": 16385,
    "gpt-4-0314": 8192,
    "gpt-4-0613": 8192,  # Current gpt-4 default
    "gpt-4-32k-0314": 32768,
    "gpt-4-32k-0613": 32768,
    "gpt-4-1106-preview": 128000,
    "gpt-4-0125-preview": 128000,
    "gpt-4-turbo-preview": 128000,
    "gpt-4-vision-preview": 128000,
}
LEGACY_COMPLETION_API_MODELS = ("gpt-3.5-turbo-instruct",)
logger = logging.getLogger(__name__)


@dataclass
class AzureOptions:
    api_version: str
    azure_endpoint: str
    azure_deployment: Optional[str]
    azure_ad_token: Optional[str]
    azure_ad_token_provider: Optional[Callable[[], str]]


@dataclass
class OpenAIModel(BaseModel):
    api_key: Optional[str] = field(repr=False, default=None)
    """Your OpenAI key. If not provided, will be read from the environment variable"""
    organization: Optional[str] = field(repr=False, default=None)
    """
    The organization to use for the OpenAI API. If not provided, will default
    to what's configured in OpenAI
    """
    base_url: Optional[str] = field(repr=False, default=None)
    """
    An optional base URL to use for the OpenAI API. If not provided, will default
    to what's configured in OpenAI
    """
    model: str = "gpt-4"
    """
    Model name to use. In of azure, this is the deployment name such as gpt-35-instant
    """
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion.
    -1 returns as many tokens as possible given the prompt and
    the models maximal context size."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    frequency_penalty: float = 0
    """Penalizes repeated tokens according to frequency."""
    presence_penalty: float = 0
    """Penalizes repeated tokens."""
    n: int = 1
    """How many completions to generate for each prompt."""
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    """Holds any model parameters valid for `create` call not explicitly specified."""
    batch_size: int = 20
    # TODO: IMPLEMENT BATCHING
    """Batch size to use when passing multiple documents to generate."""
    request_timeout: Optional[Union[float, Tuple[float, float]]] = None
    """Timeout for requests to OpenAI completion API. Default is 600 seconds."""

    # Azure options
    api_version: Optional[str] = field(default=None)
    """https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#rest-api-versioning"""
    azure_endpoint: Optional[str] = field(default=None)
    """
    The endpoint to use for azure openai. Available in the azure portal.
    https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource?pivots=web-portal#create-a-resource
    """
    azure_deployment: Optional[str] = field(default=None)
    azure_ad_token: Optional[str] = field(default=None)
    azure_ad_token_provider: Optional[Callable[[], str]] = field(default=None)
    default_headers: Optional[Mapping[str, str]] = field(default=None)
    """Default headers required by AzureOpenAI"""

    # Deprecated fields
    model_name: Optional[str] = field(default=None)
    """
    .. deprecated:: 3.0.0
       use `model` instead. This will be removed
    """

    def __post_init__(self) -> None:
        self._migrate_model_name()
        self._init_environment()
        self._init_open_ai()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model

    def reload_client(self) -> None:
        self._init_open_ai()

    def _migrate_model_name(self) -> None:
        if self.model_name:
            warning_message = "The `model_name` field is deprecated. Use `model` instead. \
                This will be removed in a future release."
            print(
                warning_message,
            )
            warnings.warn(warning_message, DeprecationWarning)
            self.model = self.model_name
            self.model_name = None

    def _init_environment(self) -> None:
        try:
            import openai
            import openai._utils as openai_util

            self._openai = openai
            self._openai_util = openai_util
        except ImportError:
            self._raise_import_error(
                package_display_name="OpenAI",
                package_name="openai",
                package_min_version=MINIMUM_OPENAI_VERSION,
            )

    def _init_open_ai(self) -> None:
        # For Azure, you need to provide the endpoint and the endpoint
        self._is_azure = bool(self.azure_endpoint)

        self._model_uses_legacy_completion_api = self.model.startswith(LEGACY_COMPLETION_API_MODELS)
        if self.api_key is None:
            api_key = os.getenv(OPENAI_API_KEY_ENVVAR_NAME)
            if api_key is None:
                # TODO: Create custom AuthenticationError
                raise RuntimeError(
                    "OpenAI's API key not provided. Pass it as an argument to 'api_key' "
                    "or set it in your environment: 'export OPENAI_API_KEY=sk-****'"
                )
            self.api_key = api_key

        # Set the version, organization, and base_url - default to openAI
        self.api_version = self.api_version or self._openai.api_version
        self.organization = self.organization or self._openai.organization

        # Initialize specific clients depending on the API backend
        # Set the type first
        self._client: Union[self._openai.OpenAI, self._openai.AzureOpenAI]  # type: ignore
        self._async_client: Union[self._openai.AsyncOpenAI, self._openai.AsyncAzureOpenAI]  # type: ignore
        if self._is_azure:
            # Validate the azure options and construct a client
            azure_options = self._get_azure_options()
            self._client = self._openai.AzureOpenAI(
                azure_endpoint=azure_options.azure_endpoint,
                azure_deployment=azure_options.azure_deployment,
                api_version=azure_options.api_version,
                azure_ad_token=azure_options.azure_ad_token,
                azure_ad_token_provider=azure_options.azure_ad_token_provider,
                api_key=self.api_key,
                organization=self.organization,
                default_headers=self.default_headers,
            )
            self._async_client = self._openai.AsyncAzureOpenAI(
                azure_endpoint=azure_options.azure_endpoint,
                azure_deployment=azure_options.azure_deployment,
                api_version=azure_options.api_version,
                azure_ad_token=azure_options.azure_ad_token,
                azure_ad_token_provider=azure_options.azure_ad_token_provider,
                api_key=self.api_key,
                organization=self.organization,
                default_headers=self.default_headers,
            )
            # return early since we don't need to check the model
            return

        # The client is not azure, so it must be openai
        self._client = self._openai.OpenAI(
            api_key=self.api_key,
            organization=self.organization,
            base_url=(self.base_url or self._openai.base_url),
        )

        # The client is not azure, so it must be openai
        self._async_client = self._openai.AsyncOpenAI(
            api_key=self.api_key,
            organization=self.organization,
            base_url=(self.base_url or self._openai.base_url),
            max_retries=0,
        )

    def _get_azure_options(self) -> AzureOptions:
        options = {}
        for option in fields(AzureOptions):
            if (value := getattr(self, option.name)) is not None:
                options[option.name] = value
            else:
                # raise ValueError if field is not optional
                # See if the field is optional - e.g. get_origin(Optional[T])  = typing.Union
                option_is_optional = get_origin(option.type) is Union and type(None) in get_args(
                    option.type
                )
                if not option_is_optional:
                    raise ValueError(
                        f"Option '{option.name}' must be set when using Azure OpenAI API"
                    )
                options[option.name] = None
        return AzureOptions(**options)

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=self._openai.RateLimitError,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=5,
            maximum_per_second_request_rate=20,
            enforcement_window_minutes=1,
        )

    @staticmethod
    def _build_messages(
        prompt: str, system_instruction: Optional[str] = None
    ) -> List[Dict[str, str]]:
        messages = [{"role": "user", "content": prompt}]
        if system_instruction:
            messages.insert(0, {"role": "system", "content": str(system_instruction)})
        return messages

    def verbose_generation_info(self) -> str:
        return f"OpenAI invocation parameters: {self.public_invocation_params}"

    async def _async_generate(self, prompt: str, **kwargs: Any) -> str:
        invoke_params = self.invocation_params
        messages = self._build_messages(prompt, kwargs.get("instruction"))
        if functions := kwargs.get("functions"):
            invoke_params["functions"] = functions
        if function_call := kwargs.get("function_call"):
            invoke_params["function_call"] = function_call
        response = await self._async_rate_limited_completion(
            messages=messages,
            **invoke_params,
        )
        choice = response["choices"][0]
        if self._model_uses_legacy_completion_api:
            return str(choice["text"])
        message = choice["message"]
        if function_call := message.get("function_call"):
            return str(function_call.get("arguments") or "")
        return str(message["content"])

    def _generate(self, prompt: str, **kwargs: Any) -> str:
        invoke_params = self.invocation_params
        messages = self._build_messages(prompt, kwargs.get("instruction"))
        if functions := kwargs.get("functions"):
            invoke_params["functions"] = functions
        if function_call := kwargs.get("function_call"):
            invoke_params["function_call"] = function_call
        response = self._rate_limited_completion(
            messages=messages,
            **invoke_params,
        )
        choice = response["choices"][0]
        if self._model_uses_legacy_completion_api:
            return str(choice["text"])
        message = choice["message"]
        if function_call := message.get("function_call"):
            return str(function_call.get("arguments") or "")
        return str(message["content"])

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Any:
            try:
                if self._model_uses_legacy_completion_api:
                    if "prompt" not in kwargs:
                        kwargs["prompt"] = "\n\n".join(
                            (message.get("content") or "")
                            for message in (kwargs.pop("messages", None) or ())
                        )
                    # OpenAI 1.0.0 API responses are pydantic objects, not dicts
                    # We must dump the model to get the dict
                    res = await self._async_client.completions.create(**kwargs)
                else:
                    res = await self._async_client.chat.completions.create(**kwargs)
                return res.model_dump()
            except self._openai._exceptions.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "maximum context length" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return await _async_completion(**kwargs)

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                if self._model_uses_legacy_completion_api:
                    if "prompt" not in kwargs:
                        kwargs["prompt"] = "\n\n".join(
                            (message.get("content") or "")
                            for message in (kwargs.pop("messages", None) or ())
                        )
                    # OpenAI 1.0.0 API responses are pydantic objects, not dicts
                    # We must dump the model to get the dict
                    return self._client.completions.create(**kwargs).model_dump()
                return self._client.chat.completions.create(**kwargs).model_dump()
            except self._openai._exceptions.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "maximum context length" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return _completion(**kwargs)

    @property
    def public_invocation_params(self) -> Dict[str, Any]:
        return {
            **({"model": self.model}),
            **self._default_params,
            **self.model_kwargs,
        }

    @property
    def invocation_params(self) -> Dict[str, Any]:
        return {
            **self.public_invocation_params,
        }

    @property
    def _default_params(self) -> Dict[str, Any]:
        """Get the default parameters for calling OpenAI API."""
        return {
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "frequency_penalty": self.frequency_penalty,
            "presence_penalty": self.presence_penalty,
            "top_p": self.top_p,
            "n": self.n,
            "timeout": self.request_timeout,
        }

    @property
    def supports_function_calling(self) -> bool:
        if (
            self._is_azure
            and self.api_version
            # The first api version supporting function calling is 2023-07-01-preview.
            # See https://github.com/Azure/azure-rest-api-specs/blob/58e92dd03733bc175e6a9540f4bc53703b57fcc9/specification/cognitiveservices/data-plane/AzureOpenAI/inference/preview/2023-07-01-preview/inference.json#L895 # noqa E501
            and self.api_version[:10] < "2023-07-01"
        ):
            return False
        if self._model_uses_legacy_completion_api:
            return False
        return True
