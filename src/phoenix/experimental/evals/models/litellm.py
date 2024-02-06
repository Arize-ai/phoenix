import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from phoenix.experimental.evals.models.base import BaseEvalModel

logger = logging.getLogger(__name__)


@dataclass
class LiteLLMModel(BaseEvalModel):
    model_name: str = "gpt-3.5-turbo"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    num_retries: int = 0
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

    def __post_init__(self) -> None:
        self._init_environment()

    def _init_environment(self) -> None:
        try:
            import litellm
            from litellm import validate_environment

            self._litellm = litellm
            env_info = validate_environment(self._litellm.utils.get_llm_provider(self.model_name))

            if not env_info["keys_in_environment"]:
                raise RuntimeError(
                    f"Missing environment variable(s): '{str(env_info['missing_keys'])}', for "
                    f"model: {self.model_name}. \nFor additional information about the right "
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
            model=self.model_name,
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
