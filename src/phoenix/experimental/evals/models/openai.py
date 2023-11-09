import logging
import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Tuple, Union

from phoenix.experimental.evals.models.base import BaseEvalModel

if TYPE_CHECKING:
    from tiktoken import Encoding

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
}
LEGACY_COMPLETION_API_MODELS = ("gpt-3.5-turbo-instruct",)
logger = logging.getLogger(__name__)


AZURE_REQUIRED_OPTIONS = ["api_version", "azure_endpoint"]
AZURE_ADDITIONAL_OPTIONS = [
    "azure_deployment",
    "azure_ad_token",
    "azure_ad_token_provider",
]


@dataclass
class AzureOptions:
    api_version: str
    azure_endpoint: str
    azure_deployment: Optional[str]
    azure_ad_token: Optional[str]
    azure_ad_token_provider: Optional[Callable[[], str]]


@dataclass
class OpenAIModel(BaseEvalModel):
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
    model_name: str = "gpt-4"
    """Model name to use. In of azure, this is the deployment name such as gpt-35-instant"""
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
    max_retries: int = 20
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""

    # Azure options
    api_version: Optional[str] = field(default=None)
    """https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#rest-api-versioning"""
    azure_endpoint: Optional[str] = field(default=None)
    """
    The endpoint to use for the OpenAI API.
    Note, this field is required when using Azure OpenAI API.
    https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource?pivots=web-portal#create-a-resource
    """
    azure_deployment: Optional[str] = field(default=None)
    azure_ad_token: Optional[str] = field(default=None)
    azure_ad_token_provider: Optional[Callable[[], str]] = field(default=None)

    def __post_init__(self) -> None:
        self._init_environment()
        self._init_open_ai()
        self._init_tiktoken()

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
        try:
            import tiktoken

            self._tiktoken = tiktoken
        except ImportError:
            self._raise_import_error(
                package_name="tiktoken",
            )

    def _init_open_ai(self) -> None:
        # For Azure, you need to provide the endpoint and the endpoint
        self._is_azure = bool(self.azure_endpoint)

        self._model_uses_legacy_completion_api = self.model_name.startswith(
            LEGACY_COMPLETION_API_MODELS
        )
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
            )
        else:
            self._client = self._openai.OpenAI(
                api_key=self.api_key,
                organization=self.organization,
                base_url=(self.base_url or self._openai.base_url),
            )

        if self.model_name in MODEL_TOKEN_LIMIT_MAPPING.keys():
            self._openai_api_model_name = self.model_name
        elif "gpt-3.5-turbo" in self.model_name:
            self._openai_api_model_name = "gpt-3.5-turbo-0613"
        elif "gpt-4" in self.model_name:
            self._openai_api_model_name = "gpt-4-0613"
        else:
            raise NotImplementedError(
                f"openai_api_model_name not available for model {self.model_name}. "
            )

    def _init_tiktoken(self) -> None:
        try:
            encoding = self._tiktoken.encoding_for_model(self.openai_api_model_name)
        except KeyError:
            logger.warning("Warning: model not found. Using cl100k_base encoding.")
            encoding = self._tiktoken.get_encoding("cl100k_base")
        self._tiktoken_encoding = encoding

    def _get_azure_options(self) -> AzureOptions:
        options = {}
        for option in AZURE_REQUIRED_OPTIONS:
            value = getattr(self, option)
            if value is None:
                raise ValueError(f"Option '{option}' must be set when using Azure OpenAI API")
            options[option] = value
        for option in AZURE_ADDITIONAL_OPTIONS:
            value = getattr(self, option)
            options[option] = value
        return AzureOptions(**options)

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

    def _generate(self, prompt: str, **kwargs: Any) -> str:
        invoke_params = self.invocation_params
        messages = self._build_messages(prompt, kwargs.get("instruction"))
        if functions := kwargs.get("functions"):
            invoke_params["functions"] = functions
        if function_call := kwargs.get("function_call"):
            invoke_params["function_call"] = function_call
        response = self._generate_with_retry(
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

    def _generate_with_retry(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""
        openai_retry_errors = [
            self._openai.APITimeoutError,
            self._openai.APIError,
            self._openai.APIConnectionError,
            self._openai.RateLimitError,
            self._openai.InternalServerError,
        ]

        @self.retry(
            error_types=openai_retry_errors,
            min_seconds=self.retry_min_seconds,
            max_seconds=self.retry_max_seconds,
            max_retries=self.max_retries,
        )
        def _completion_with_retry(**kwargs: Any) -> Any:
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

        return _completion_with_retry(**kwargs)

    @property
    def max_context_size(self) -> int:
        model_name = self.openai_api_model_name
        # handling finetuned models
        if "ft-" in model_name:
            model_name = self.model_name.split(":")[0]

        context_size = MODEL_TOKEN_LIMIT_MAPPING.get(model_name, None)

        if context_size is None:
            raise ValueError(
                "Can't determine maximum context size. An unknown model name was "
                f"used: {model_name}. Please provide a valid OpenAI model name. "
                "Known models are: " + ", ".join(MODEL_TOKEN_LIMIT_MAPPING.keys())
            )

        return context_size

    @property
    def public_invocation_params(self) -> Dict[str, Any]:
        return {
            **({"model": self.model_name}),
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
    def openai_api_model_name(self) -> str:
        return self._openai_api_model_name

    @property
    def encoder(self) -> "Encoding":
        return self._tiktoken_encoding

    def get_token_count_from_messages(self, messages: List[Dict[str, str]]) -> int:
        """Return the number of tokens used by a list of messages.

        Official documentation: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
        """  # noqa
        model_name = self.openai_api_model_name
        if model_name == "gpt-3.5-turbo-0301":
            tokens_per_message = 4  # every message follows <|start|>{role/name}\n{content}<|end|>\n
            tokens_per_name = -1  # if there's a name, the role is omitted
        else:
            tokens_per_message = 3
            tokens_per_name = 1

        token_count = 0
        for message in messages:
            token_count += tokens_per_message
            for key, text in message.items():
                token_count += len(self.get_tokens_from_text(text))
                if key == "name":
                    token_count += tokens_per_name
        # every reply is primed with <|start|>assistant<|message|>
        token_count += 3
        return token_count

    def get_tokens_from_text(self, text: str) -> List[int]:
        return self.encoder.encode(text)

    def get_text_from_tokens(self, tokens: List[int]) -> str:
        return self.encoder.decode(tokens)

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
