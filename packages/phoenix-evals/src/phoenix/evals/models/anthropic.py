from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from phoenix.evals.exceptions import PhoenixContextLimitExceeded
from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter

MINIMUM_ANTHROPIC_VERSION = "0.18.0"


def anthropic_version(version_str: str) -> Tuple[int, ...]:
    return tuple(map(int, version_str.split(".")))


@dataclass
class AnthropicModel(BaseModel):
    model: str = "claude-2.1"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    top_k: int = 256
    """The cutoff where the model no longer selects the words."""
    stop_sequences: List[str] = field(default_factory=list)
    """If the model encounters a stop sequence, it stops generating further tokens."""
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    """Any extra parameters to add to the request body (e.g., countPenalty for a21 models)"""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""

    def __post_init__(self) -> None:
        self._init_client()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model

    def _init_client(self) -> None:
        try:
            import anthropic
        except ImportError:
            self._raise_import_error(
                package_name="anthropic",
                package_min_version=MINIMUM_ANTHROPIC_VERSION,
            )

        installed_version = anthropic_version(anthropic.__version__)
        minimum_version = anthropic_version(MINIMUM_ANTHROPIC_VERSION)

        if installed_version <= minimum_version:
            raise ImportError(
                "The installed version of `anthropic` is no longer supported. "
                "Please upgrade to the latest version with "
                f"`pip install -U anthropic>={MINIMUM_ANTHROPIC_VERSION}`"
            )

        self._anthropic = anthropic
        self.client = self._anthropic.Anthropic()
        self.async_client = self._anthropic.AsyncAnthropic()

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=self._anthropic.RateLimitError,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=20,
            enforcement_window_minutes=1,
        )

    def invocation_parameters(self) -> Dict[str, Any]:
        return {
            "max_tokens": self.max_tokens,
            "stop_sequences": self.stop_sequences,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "top_k": self.top_k,
        }

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        # instruction is an invalid input to Anthropic models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        response = self._rate_limited_completion(
            model=self.model,
            messages=self._format_prompt_for_claude(prompt),
            **invocation_parameters,
        )

        return str(response)

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                response = self.client.messages.create(**kwargs)
                return response.content[0].text
            except self._anthropic.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "prompt is too long" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return _completion(**kwargs)

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        # instruction is an invalid input to Anthropic models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        response = await self._async_rate_limited_completion(
            model=self.model,
            messages=self._format_prompt_for_claude(prompt),
            **invocation_parameters,
        )

        return str(response)

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Any:
            try:
                response = await self.async_client.messages.create(**kwargs)
                return response.content[0].text
            except self._anthropic.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "prompt is too long" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return await _async_completion(**kwargs)

    def _format_prompt_for_claude(self, prompt: str) -> List[Dict[str, str]]:
        # the Anthropic messages API expects a list of messages
        return [
            {"role": "user", "content": prompt},
        ]
