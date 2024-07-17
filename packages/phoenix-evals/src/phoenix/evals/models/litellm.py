import logging
import warnings
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from phoenix.evals.models.base import BaseModel

logger = logging.getLogger(__name__)


@dataclass
class LiteLLMModel(BaseModel):
    """
    An interface for using LLM models with the LiteLLM interface.

    This class wraps the LiteLLM library for use with Phoenix LLM evaluations. Requires the
    `litellm` package to be installed.

    ⚠️ Warning: Due to the number of supported models and variations in rate limit handling, we
    do not catch rate limit exceptions and throttle requests.

    Supports Async: ❌
        `litellm` provides an async interface for making LLM calls. However, because we cannot
        reliably catch and throttle requests when encountering rate limit errors, we do not
        asyncronously make requests using `litellm` to avoid exceeding rate limits.

    Args:
        model (str): The model name to use.
        temperature (float, optional): Sampling temperature to use. Defaults to 0.0.
        max_tokens (int, optional): Maximum number of tokens to generate in the completion.
            Defaults to 256.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to 1.
        num_retries (int, optional): Maximum number to retry a model if a RateLimitError,
            OpenAIError, or ServiceUnavailableError occurs. Defaults to 0.
        request_timeout (int, optional): Maximum number of seconds to wait when retrying.
            Defaults to 60.
        model_kwargs (Dict[str, Any], optional): Model specific params. Defaults to an empty dict.

    Example:
        .. code-block:: python

            # configuring a local llm via litellm
            os.environ["OLLAMA_API_BASE"] = "http://localhost:11434"

            from phoenix.evals import LiteLLMModel
            model = LiteLLMModel(model="ollama/llama3")
    """

    model: str = "gpt-3.5-turbo"
    temperature: float = 0.0
    max_tokens: int = 256
    top_p: float = 1
    num_retries: int = 0
    request_timeout: int = 60
    model_kwargs: Dict[str, Any] = field(default_factory=dict)

    # Deprecated fields
    model_name: Optional[str] = None
    """
    .. deprecated:: 3.0.0
       use `model` instead. This will be removed in a future release.
    """

    def __post_init__(self) -> None:
        self._migrate_model_name()
        self._init_environment()

    @property
    def _model_name(self) -> str:
        return self.model

    def _migrate_model_name(self) -> None:
        if self.model_name is not None:
            warning_message = "The `model_name` field is deprecated. Use `model` instead. \
                This will be removed in a future release."
            warnings.warn(
                warning_message,
                DeprecationWarning,
            )
            print(warning_message)
            self.model = self.model_name
            self.model_name = None

    def _init_environment(self) -> None:
        try:
            import litellm
            from litellm.utils import validate_environment

            self._litellm = litellm
            env_info = validate_environment(self.model)

            if not env_info["keys_in_environment"] and env_info["missing_keys"]:
                raise RuntimeError(
                    f"Missing environment variable(s): '{str(env_info['missing_keys'])}', for "
                    f"model: {self.model}. \nFor additional information about the right "
                    "environment variables for specific model providers:\n"
                    "https://docs.litellm.ai/docs/completion/input#provider-specific-params."
                )
        except ImportError:
            self._raise_import_error(
                package_display_name="LiteLLM",
                package_name="litellm",
            )

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        return self._generate(prompt, **kwargs)

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        messages = self._get_messages_from_prompt(prompt)
        response = self._litellm.completion(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            top_p=self.top_p,
            num_retries=self.num_retries,
            request_timeout=self.request_timeout,
            **self.model_kwargs,
        )
        return str(response.choices[0].message.content)

    def _get_messages_from_prompt(self, prompt: str) -> List[Dict[str, str]]:
        # LiteLLM requires prompts in the format of messages
        # messages=[{"content": "ABC?","role": "user"}]
        return [{"content": prompt, "role": "user"}]
