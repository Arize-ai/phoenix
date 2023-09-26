import os
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple, Union

from .base import BaseEvalModel, create_base_retry_decorator

OPENAI_API_KEY_ENVVAR_NAME = "OPENAI_API_KEY"
MINIMUM_OPENAI_VERSION = "0.26.4"


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

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        invoke_params = self.invocation_params
        messages = [{"role": "user", "content": prompt}]
        if kwargs.get("instruction"):
            messages.insert(0, {"role": "system", "content": str(kwargs.get("instruction"))})
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
