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
    """
    An interface for using Anthropic models.

    This class wraps the Anthropic SDK library for use with Phoenix LLM evaluations. Calls to the
    Anthropic API are dynamically throttled when encountering rate limit errors. Requires the
    `anthropic` package to be installed.

    Supports Async: ✅
        If possible, makes LLM calls concurrently.

    Args:
        model (str, optional): The model name to use. Defaults to "claude-2.1".
        temperature (float, optional): Sampling temperature to use. Defaults to 0.0.
        max_tokens (int, optional): Maximum number of tokens to generate in the completion.
            Defaults to 256.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to 1.
        top_k (int, optional): The cutoff where the model no longer selects the words.
            Defaults to 256.
        stop_sequences (List[str], optional): If the model encounters a stop sequence, it stops
            generating further tokens. Defaults to an empty list.
        extra_parameters (Dict[str, Any], optional): Any extra parameters to add to the request
            body (e.g., countPenalty for a21 models). Defaults to an empty dictionary.
        max_content_size (Optional[int], optional): If using a fine-tuned model, set this to the
            maximum content size. Defaults to None.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 5.

    Example:
        .. code-block:: python

            # Set the ANTHROPIC_API_KEY environment variable

            from phoenix.evals import AnthropicModel
            model = AnthropicModel(model="claude-2.1")
    """

    model: str = "claude-2.1"
    temperature: float = 0.0
    max_tokens: int = 256
    top_p: float = 1
    top_k: int = 256
    stop_sequences: List[str] = field(default_factory=list)
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    max_content_size: Optional[int] = None
    initial_rate_limit: int = 5

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
            initial_per_second_request_rate=self.initial_rate_limit,
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
