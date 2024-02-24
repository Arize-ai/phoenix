from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from phoenix.evals.exceptions import PhoenixContextLimitExceeded
from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter


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

            self._anthropic = anthropic
            self.client = self._anthropic.Anthropic()
            self.async_client = self._anthropic.AsyncAnthropic()
        except ImportError:
            self._raise_import_error(
                package_name="anthropic",
            )

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
            "max_tokens_to_sample": self.max_tokens,
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
            prompt=self._format_prompt_for_claude(prompt),
            **invocation_parameters,
        )

        return str(response)

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                response = self.client.completions.create(**kwargs)
                return response.completion
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
            prompt=self._format_prompt_for_claude(prompt),
            **invocation_parameters,
        )

        return str(response)

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Any:
            try:
                response = await self.async_client.completions.create(**kwargs)
                return response.completion
            except self._anthropic.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "prompt is too long" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return await _async_completion(**kwargs)

    def _format_prompt_for_claude(self, prompt: str) -> str:
        # Claude requires prompt in the format of Human: ... Assistant:
        return f"{self._anthropic.HUMAN_PROMPT} {prompt} {self._anthropic.AI_PROMPT}"
