import base64
import logging
import warnings
from dataclasses import dataclass, field, fields
from typing import (
    TYPE_CHECKING,
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
from urllib.parse import urlparse

from typing_extensions import assert_never, override

from phoenix.evals.legacy.exceptions import (
    PhoenixContextLimitExceeded,
    PhoenixUnsupportedAudioFormat,
)
from phoenix.evals.legacy.models.base import BaseModel, ExtraInfo, Usage
from phoenix.evals.legacy.models.rate_limiters import RateLimiter
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType
from phoenix.evals.legacy.utils import get_audio_format_from_base64

if TYPE_CHECKING:
    from openai.types import Completion
    from openai.types.chat import ChatCompletion

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
SUPPORTED_AUDIO_FORMATS = {"mp3", "wav"}
logger = logging.getLogger(__name__)


@dataclass
class AzureOptions:
    api_version: str
    azure_endpoint: str
    azure_deployment: Optional[str]
    azure_ad_token: Optional[str]
    azure_ad_token_provider: Optional[Callable[[], str]]


def _model_supports_temperature(model: str) -> bool:
    """OpenAI reasoning models do not support temperature."""
    if model.startswith("o1") or model.startswith("o3"):
        return False
    return True


@dataclass
class OpenAIModel(BaseModel):
    """
    An interface for using OpenAI models.

    This class wraps the OpenAI SDK library for use with Phoenix LLM evaluations. Calls to the
    OpenAI API are dynamically throttled when encountering rate limit errors. Requires the
    `openai` package to be installed.

    Additionally, OpenAIModel supports Azure OpenAI API. To use Azure OpenAI API, you need to
    provide the `azure_endpoint` and `azure_deployment` parameters. You can also provide the
    `azure_ad_token` or `azure_ad_token_provider` to authenticate with Azure OpenAI API.

    Supports Async: ✅
        If possible, makes LLM calls concurrently.

    Args:
        api_key (str, optional): Your OpenAI key. If not provided, will be read from the
            environment variable. Defaults to None.
        organization (str, optional): The organization to use for the OpenAI API. If not provided,
            will default to what's configured in OpenAI. Defaults to None.
        base_url (str, optional): An optional base URL to use for the OpenAI API. If not provided,
            will default to what's configured in OpenAI. Defaults to None.
        model (str, optional): Model name to use. In of azure, this is the deployment name such as
            gpt-35-instant. Defaults to "gpt-4".
        temperature (float, optional): What sampling temperature to use. Defaults to 0.0.
        max_tokens (int | None, optional): The maximum number of tokens to generate in the
            completion. To unset this limit, set `max_tokens` to `None`. Defaults to 256.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to 1.
        frequency_penalty (float, optional): Penalizes repeated tokens according to frequency.
            Defaults to 0.
        presence_penalty (float, optional): Penalizes repeated tokens. Defaults to 0.
        n (int, optional): How many completions to generate for each prompt. Defaults to 1.
        model_kwargs (Dict[str, Any], optional): Holds any model parameters valid for `create` call
            not explicitly specified. Defaults to an empty dictionary.
        request_timeout (Optional[Union[float, Tuple[float, float]]], optional): Timeout for
            requests to OpenAI completion API. Default is 30 seconds.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 10.
        timeout (int, optional): Pheonix timeout for API requests in seconds. Defaults to 120.
        api_version (str, optional): The version of the Azure API to use. Defaults to None.
            https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#rest-api-versioning
        azure_endpoint (str, optional): The endpoint to use for azure openai. Available in the
            Azure portal. Defaults to None.
        azure_deployment (str, optional): The deployment to use for azure openai. Defaults to None.
        azure_ad_token (str, optional): The azure AD token to use for azure openai. Defaults to
            None.
        azure_ad_token_provider (Callable[[], str], optional): A callable that returns the azure ad
            token to use for azure openai. Defaults to None.
        default_headers (Mapping[str, str], optional): Default headers required by AzureOpenAI.
            Defaults to None.

    Examples:
        After setting the OPENAI_API_KEY environment variable:
        .. code-block:: python

            from phoenix.evals import OpenAIModel
            model = OpenAIModel(model="gpt-4o")

        Using OpenAI models via Azure is similar (after setting the AZURE_OPENAI_API_KEY
        environment variable):

        .. code-block:: python

            from phoenix.evals import OpenAIModel
            model = OpenAIModel(
                model="gpt-35-turbo-16k",
                azure_endpoint="https://your-endpoint.azure.com/",
                api_version="2023-09-15-preview",
            )
    """

    api_key: Optional[str] = field(repr=False, default=None)
    organization: Optional[str] = field(repr=False, default=None)
    base_url: Optional[str] = field(repr=False, default=None)
    model: str = "gpt-4"
    temperature: float = 0.0
    max_tokens: Optional[int] = None
    top_p: float = 1
    frequency_penalty: float = 0
    presence_penalty: float = 0
    n: int = 1
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    request_timeout: Optional[Union[float, Tuple[float, float]]] = 30
    initial_rate_limit: int = 10
    timeout: int = 120

    # Azure options
    api_version: Optional[str] = field(default=None)
    azure_endpoint: Optional[str] = field(default=None)
    azure_deployment: Optional[str] = field(default=None)
    azure_ad_token: Optional[str] = field(default=None)
    azure_ad_token_provider: Optional[Callable[[], str]] = field(default=None)
    default_headers: Optional[Mapping[str, str]] = field(default=None)

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
                max_retries=0,
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
                max_retries=0,
            )
            # return early since we don't need to check the model
            return

        # The client is not azure, so it must be openai
        self._client = self._openai.OpenAI(
            api_key=self.api_key,
            organization=self.organization,
            base_url=(self.base_url or self._openai.base_url),
            default_headers=self.default_headers,
            max_retries=0,
        )

        # The client is not azure, so it must be openai
        self._async_client = self._openai.AsyncOpenAI(
            api_key=self.api_key,
            organization=self.organization,
            base_url=(self.base_url or self._openai.base_url),
            max_retries=0,
            default_headers=self.default_headers,
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
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    def _build_messages(
        self, prompt: MultimodalPrompt, system_instruction: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        system_role = self._system_role()
        messages: List[Dict[str, Any]] = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                messages.append({"role": system_role, "content": part.content})
            elif part.content_type == PromptPartContentType.AUDIO:
                format = str(get_audio_format_from_base64(part.content))
                if format not in SUPPORTED_AUDIO_FORMATS:
                    raise PhoenixUnsupportedAudioFormat(f"Unsupported audio format: {format}")
                messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_audio",
                                "input_audio": {
                                    "data": part.content,
                                    "format": str(get_audio_format_from_base64(part.content)),
                                },
                            }
                        ],
                    }
                )
            elif part.content_type == PromptPartContentType.IMAGE:
                if _is_base64(part.content):
                    content_url = f"data:image/jpeg;base64,{part.content}"
                elif _is_url(part.content):
                    content_url = part.content
                else:
                    raise ValueError("Only base64 encoded images or image URLs are supported")
                messages.append(
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": content_url},
                            }
                        ],
                    }
                )
            else:
                raise ValueError(
                    f"Unsupported content type for {OpenAIModel.__name__}: {part.content_type}"
                )
        if system_instruction:
            messages.insert(0, {"role": system_role, "content": str(system_instruction)})
        return messages

    def verbose_generation_info(self) -> str:
        return f"OpenAI invocation parameters: {self.public_invocation_params}"

    @override
    async def _async_generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Any
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        invoke_params = self.invocation_params
        messages = self._build_messages(prompt, kwargs.get("instruction"))
        if functions := kwargs.get("functions"):
            invoke_params["functions"] = functions
        if function_call := kwargs.get("function_call"):
            invoke_params["function_call"] = function_call
        return await self._async_rate_limited_completion(
            messages=messages,
            **invoke_params,
        )

    @override
    def _generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Any
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        invoke_params = self.invocation_params
        messages = self._build_messages(prompt=prompt, system_instruction=kwargs.get("instruction"))
        if functions := kwargs.get("functions"):
            invoke_params["functions"] = functions
        if function_call := kwargs.get("function_call"):
            invoke_params["function_call"] = function_call
        return self._rate_limited_completion(
            messages=messages,
            **invoke_params,
        )

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                if self._model_uses_legacy_completion_api:
                    if "prompt" not in kwargs:
                        kwargs["prompt"] = "\n\n".join(
                            (message.get("content") or "")
                            for message in (kwargs.pop("messages", None) or ())
                        )
                    res = await self._async_client.completions.create(**kwargs)
                else:
                    res = await self._async_client.chat.completions.create(**kwargs)
                return self._parse_output(res)
            except self._openai._exceptions.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "maximum context length" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return await _async_completion(**kwargs)

    def _rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                if self._model_uses_legacy_completion_api:
                    if "prompt" not in kwargs:
                        kwargs["prompt"] = "\n\n".join(
                            (message.get("content") or "")
                            for message in (kwargs.pop("messages", None) or ())
                        )
                    res = self._client.completions.create(**kwargs)
                else:
                    res = self._client.chat.completions.create(**kwargs)
                return self._parse_output(res)
            except self._openai._exceptions.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "maximum context length" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return _completion(**kwargs)

    def _system_role(self) -> str:
        # OpenAI uses different semantics for "system" roles for different models
        if "gpt" in self.model:
            return "system"
        if "o1-mini" in self.model:
            return "user"  # o1-mini does not support either "system" or "developer" roles
        if "o1-preview" in self.model:
            return "user"  # o1-preview does not support "system" or "developer" roles
        if "o1" in self.model:
            return "developer"
        if "o3" in self.model:
            return "developer"
        return "system"

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
        # token param str depends on provider and model
        token_param_str = _get_token_param_str(self._is_azure, self.model)
        params = {
            "frequency_penalty": self.frequency_penalty,
            "presence_penalty": self.presence_penalty,
            "top_p": self.top_p,
            "n": self.n,
            "timeout": self.request_timeout,
            token_param_str: self.max_tokens,
        }
        if _model_supports_temperature(self.model):
            params.update(
                {
                    "temperature": self.temperature,
                }
            )
        return params

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
        if self.model.startswith("o1"):
            return False
        return True

    def _extract_text(
        self,
        response: Union["ChatCompletion", "Completion"],
    ) -> str:
        from openai.types import Completion
        from openai.types.chat import ChatCompletion

        if isinstance(response, ChatCompletion):
            if not response.choices:
                return ""
            message = response.choices[0].message
            if tool_calls := message.tool_calls:
                for tool_call in tool_calls:
                    if tool_call.type != "function":
                        continue
                    if arguments := tool_call.function.arguments:
                        return str(arguments)
            if function_call := message.function_call:
                return str(function_call.arguments or "")
            return message.content or ""
        elif isinstance(response, Completion):
            if not response.choices:
                return ""
            return response.choices[0].text
        else:
            assert_never(response)

    def _parse_output(
        self,
        response: Union["ChatCompletion", "Completion"],
    ) -> Tuple[str, ExtraInfo]:
        text = self._extract_text(response)
        usage = (
            Usage(
                prompt_tokens=response_usage.prompt_tokens,
                completion_tokens=response_usage.completion_tokens,
                total_tokens=response_usage.total_tokens,
            )
            if (response_usage := response.usage)
            else None
        )
        return text, ExtraInfo(usage=usage)


def _is_url(url: str) -> bool:
    parsed_url = urlparse(url)
    return bool(parsed_url.scheme and parsed_url.netloc)


def _is_base64(s: str) -> bool:
    try:
        base64.b64decode(s, validate=True)
        return True
    except Exception:
        return False


def _get_token_param_str(is_azure: bool, model: str) -> str:
    """
    Get the token parameter string for the given model.
    OpenAI o1 and o3 models made a switch to use
    max_completion_tokens and now all the models support it.
    However, Azure OpenAI models currently do not support
    max_completion_tokens unless it's an o1 or o3 model.
    """
    azure_reasoning_models = ("o1", "o3", "o4", "gpt-5")
    if is_azure and not model.startswith(azure_reasoning_models):
        return "max_tokens"
    return "max_completion_tokens"
