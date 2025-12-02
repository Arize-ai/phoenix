import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union

from typing_extensions import override

from phoenix.evals.legacy.exceptions import PhoenixContextLimitExceeded
from phoenix.evals.legacy.models.base import BaseModel, ExtraInfo, Usage
from phoenix.evals.legacy.models.rate_limiters import RateLimiter
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

if TYPE_CHECKING:
    from anthropic.types import Message
    from anthropic.types import Usage as MessageUsage

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
            Defaults to 1024.
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
        timeout (int, optional): The timeout for completion requests in seconds. Defaults to 120.

    Example:
        .. code-block:: python

            # Set the ANTHROPIC_API_KEY environment variable

            from phoenix.evals import AnthropicModel
            model = AnthropicModel(model="claude-2.1")
    """

    model: str = "claude-2.1"
    temperature: float = 0.0
    max_tokens: int = 1024
    top_p: float = 1
    top_k: int = 256
    stop_sequences: List[str] = field(default_factory=list)
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    max_content_size: Optional[int] = None
    initial_rate_limit: int = 5
    timeout: int = 120

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
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    def invocation_parameters(self) -> Dict[str, Any]:
        params = {
            "max_tokens": self.max_tokens,
            "stop_sequences": self.stop_sequences,
            "top_k": self.top_k,
        }
        if self.temperature is not None:
            params["temperature"] = self.temperature
        if self.top_p is not None:
            params["top_p"] = self.top_p
        return params

    @override
    def _generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> Tuple[str, ExtraInfo]:
        # instruction is an invalid input to Anthropic models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        invocation_parameters = {k: v for k, v in invocation_parameters.items() if v is not None}
        return self._rate_limited_completion(
            model=self.model,
            messages=self._format_prompt_for_claude(prompt),
            **invocation_parameters,
        )

    def _rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                response: Message = self.client.messages.create(**kwargs)
                return self._parse_output(response)
            except self._anthropic.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "prompt is too long" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return _completion(**kwargs)

    @override
    async def _async_generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> Tuple[str, ExtraInfo]:
        # instruction is an invalid input to Anthropic models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        invocation_parameters = {k: v for k, v in invocation_parameters.items() if v is not None}
        return await self._async_rate_limited_completion(
            model=self.model,
            messages=self._format_prompt_for_claude(prompt),
            **invocation_parameters,
        )

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                response: Message = await self.async_client.messages.create(**kwargs)
                return self._parse_output(response)
            except self._anthropic.BadRequestError as e:
                exception_message = e.args[0]
                if exception_message and "prompt is too long" in exception_message:
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return await _async_completion(**kwargs)

    def _format_prompt_for_claude(self, prompt: MultimodalPrompt) -> List[Dict[str, str]]:
        # the Anthropic messages API expects a list of messages
        messages = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                messages.append({"role": "user", "content": part.content})
            else:
                raise ValueError(
                    f"Unsupported content type for {AnthropicModel.__name__}: {part.content_type}"
                )
        return messages

    def _extract_text(self, message: "Message") -> str:
        for block in message.content:
            if block.type == "tool_use":
                return json.dumps(block.input, ensure_ascii=False)
        return "\n\n".join(
            block.text for block in message.content if block.type == "text" and block.text
        )

    def _extract_usage(self, message_usage: "MessageUsage") -> Usage:
        prompt_tokens = (
            message_usage.input_tokens
            + (message_usage.cache_creation_input_tokens or 0)
            + (message_usage.cache_read_input_tokens or 0)
        )
        return Usage(
            prompt_tokens=prompt_tokens,
            completion_tokens=message_usage.output_tokens,
            total_tokens=prompt_tokens + message_usage.output_tokens,
        )

    def _parse_output(self, message: "Message") -> Tuple[str, ExtraInfo]:
        text = self._extract_text(message)
        usage = self._extract_usage(message.usage)
        return text, ExtraInfo(usage=usage)
