import logging
import warnings
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from phoenix.experimental.evals.models.base import BaseEvalModel

if TYPE_CHECKING:
    from tiktoken import Encoding

logger = logging.getLogger(__name__)


@dataclass
class LiteLLMModel(BaseEvalModel):
    model: str = "gpt-3.5-turbo"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    num_retries: int = 6
    """Maximum number to retry a model if an RateLimitError, OpenAIError, or
    ServiceUnavailableError occurs."""
    request_timeout: int = 60
    """Maximum number of seconds to wait when retrying."""
    model_kwargs: Dict[str, Any] = field(default_factory=dict)
    """Model specific params"""

    # non-LiteLLM params
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""

    # Deprecated fields
    model_name: Optional[str] = None
    """
    .. deprecated:: 3.0.0
       use `model` instead. This will be removed in a future release.
    """

    def __post_init__(self) -> None:
        self._migrate_model_name()
        self._init_environment()
        self._init_model_encoding()

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
            from litellm import validate_environment

            self._litellm = litellm
            env_info = validate_environment(self._litellm.utils.get_llm_provider(self.model))

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

    def _init_model_encoding(self) -> None:
        from litellm import decode, encode

        self._encoding = encode
        self._decoding = decode

    @property
    def max_context_size(self) -> int:
        context_size = self.max_content_size or self._litellm.get_max_tokens(self.model).get(
            "max_tokens", None
        )

        if context_size is None:
            raise ValueError(
                "Can't determine maximum context size. An unknown model was "
                + f"used: {self.model}."
            )

        return context_size

    @property
    def encoder(self) -> "Encoding":
        raise NotImplementedError

    def get_tokens_from_text(self, text: str) -> List[int]:
        result: List[int] = self._encoding(model=self.model, text=text)
        return result

    def get_text_from_tokens(self, tokens: List[int]) -> str:
        return str(self._decoding(model=self.model, tokens=tokens))

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
