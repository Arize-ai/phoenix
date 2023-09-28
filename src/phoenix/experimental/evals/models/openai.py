import logging
import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union

from .base import BaseEvalModel, create_base_retry_decorator

if TYPE_CHECKING:
    import tiktoken

OPENAI_API_KEY_ENVVAR_NAME = "OPENAI_API_KEY"
MINIMUM_OPENAI_VERSION = "0.26.4"
TOKEN_BUFFER_FOR_RESPONSE = 10
MODEL_TOKEN_LIMIT_MAPPING = {
    "gpt-3.5-turbo-0301": 4096,
    "gpt-3.5-turbo-0613": 4096,  # Current gpt-3.5-turbo default
    "gpt-3.5-turbo-16k-0613": 16385,
    "gpt-4-0314": 8192,
    "gpt-4-0613": 8192,  # Current gpt-4 default
    "gpt-4-32k-0314": 32768,
    "gpt-4-32k-0613": 32768,
}

logger = logging.getLogger(__name__)


@dataclass
class OpenAIModel(BaseEvalModel):
    openai_api_key: Optional[str] = field(repr=False, default=None)
    openai_api_base: Optional[str] = field(repr=False, default=None)
    openai_organization: Optional[str] = field(repr=False, default=None)
    model_name: str = "gpt-4"
    """Model name to use."""
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
    max_retries: int = 6
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""

    def __post_init__(self) -> None:
        self._init_environment()
        self._init_open_ai()
        self._init_tiktoken()

    def _init_environment(self) -> None:
        try:
            import openai
            from openai import error as openai_error

            self._openai = openai
            self._openai_error = openai_error
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
                package_display_name="tiktoken",
                package_name="tiktoken",
                package_min_version=MINIMUM_OPENAI_VERSION,
            )

    def _init_open_ai(self) -> None:
        if self.openai_api_key is None:
            api_key = os.getenv(OPENAI_API_KEY_ENVVAR_NAME)
            if api_key is None:
                # TODO: Create custom AuthenticationError
                raise RuntimeError(
                    "OpenAI's API key not provided. Pass it as an argument to 'openai_api_key' "
                    "or set it in your environment: 'export OPENAI_API_KEY=sk-****'"
                )
            self.openai_api_key = api_key

        if self.model_name in MODEL_TOKEN_LIMIT_MAPPING.keys():
            self._openai_api_model_name = self.model_name
        elif "gpt-3.5-turbo" in self.model_name:
            logger.warning(
                "gpt-3.5-turbo may update over time. Returning num tokens assuming gpt-3.5-turbo-0613."
            )
            self._openai_api_model_name = "gpt-3.5-turbo-0613"
        elif "gpt-4" in self.model_name:
            logger.warning("gpt-4 may update over time. Returning num tokens assuming gpt-4-0613.")
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

    @staticmethod
    def _build_messages(
        prompt: str, system_instruction: Optional[str] = None
    ) -> List[Dict[str, str]]:
        messages = [{"role": "user", "content": prompt}]
        if system_instruction:
            messages.insert(0, {"role": "system", "content": str(system_instruction)})
        return messages

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        invoke_params = self.invocation_params
        messages = self._build_messages(prompt, kwargs.get("instruction"))  # type:ignore

        token_count = self.get_token_count_from_messages(messages)
        if token_count > self.max_context_size - TOKEN_BUFFER_FOR_RESPONSE:
            prompt = prompt[: self.max_context_size - TOKEN_BUFFER_FOR_RESPONSE]
            messages = self._build_messages(prompt, kwargs.get("instruction"))  # type:ignore

        response = self._generate_with_retry(
            messages=messages,
            **invoke_params,
        )
        # TODO: This is a bit rudimentary, should improve
        resp_text = str(response["choices"][0]["message"]["content"])
        return resp_text

    def _generate_with_retry(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""
        openai_retry_errors = [
            self._openai_error.Timeout,
            self._openai_error.APIError,
            self._openai_error.APIConnectionError,
            self._openai_error.RateLimitError,
            self._openai_error.ServiceUnavailableError,
        ]
        retry_decorator = create_base_retry_decorator(
            error_types=openai_retry_errors,
            min_seconds=self.retry_min_seconds,
            max_seconds=self.retry_max_seconds,
            max_retries=self.max_retries,
        )

        @retry_decorator
        def _completion_with_retry(**kwargs: Any) -> Any:
            return self._openai.ChatCompletion.create(**kwargs)

        return _completion_with_retry(**kwargs)

    @property
    def max_context_size(self) -> int:
        model_name = self.model_name
        # handling finetuned models
        if "ft-" in model_name:
            model_name = self.model_name.split(":")[0]

        context_size = MODEL_TOKEN_LIMIT_MAPPING.get(model_name, None)

        if context_size is None:
            raise ValueError(
                f"Can't determine maximum context size. An unknown model name was used: {model_name}. "
                "Please provide a valid OpenAI model name. "
                "Known models are: " + ", ".join(MODEL_TOKEN_LIMIT_MAPPING.keys())
            )

        return context_size

    @property
    def invocation_params(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            **self._default_params,
            **self._credentials,
            **self.model_kwargs,
        }

    @property
    def _credentials(self) -> Dict[str, Any]:
        """Get the default parameters for calling OpenAI API."""
        return {
            "api_key": self.openai_api_key,
            "api_base": self.openai_api_base,
            "organization": self.openai_organization,
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
            "request_timeout": self.request_timeout,
        }

    @property
    def openai_api_model_name(self) -> str:
        return self._openai_api_model_name

    @property
    def tiktoken_encoding(self) -> tiktoken.Encoding:
        return self._tiktoken_encoding

    def get_token_count_from_messages(self, messages: List[Dict[str, str]]) -> int:
        """Return the number of tokens used by a list of messages.

        Official documentation: https://github.com/openai/
        openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
        """
        model_name = self.openai_api_model_name
        if model_name == "gpt-3.5-turbo-0301":
            tokens_per_message = 4  # every message follows <|start|>{role/name}\n{content}<|end|>\n
            tokens_per_name = -1  # if there's a name, the role is omitted
        else:
            tokens_per_message = 3
            tokens_per_name = 1

        encoding = self.tiktoken_encoding

        token_count = 0
        for message in messages:
            token_count += tokens_per_message
            for key, value in message.items():
                token_count += len(encoding.encode(value))
                if key == "name":
                    token_count += tokens_per_name
        # every reply is primed with <|start|>assistant<|message|>
        token_count += 3
        return token_count
