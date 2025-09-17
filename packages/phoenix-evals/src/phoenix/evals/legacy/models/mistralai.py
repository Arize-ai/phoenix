import json
import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union

from typing_extensions import assert_never, override

from phoenix.evals.legacy.models.base import BaseModel, ExtraInfo, Usage
from phoenix.evals.legacy.models.rate_limiters import RateLimiter
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

if TYPE_CHECKING:
    from mistralai import ChatCompletionResponse, UsageInfo

DEFAULT_MISTRAL_MODEL = "mistral-large-latest"
"""Use the latest large mistral model by default."""

MINIMUM_MISTRAL_VERSION = "1.0.0"


class MistralRateLimitError(Exception):
    pass


@dataclass
class MistralAIModel(BaseModel):
    """
    An interface for using MistralAI models.

    This class wraps the MistralAI SDK for use with Phoenix LLM evaluations. Calls to the
    MistralAI API are dynamically throttled when encountering rate limit errors. Requires the
    `mistralai` package to be installed.

    Supports Async: ✅
        If possible, makes LLM calls concurrently.

    Args:
        model (str, optional): The model name to use. Defaults to "mistral-large-latest".
        temperature (float, optional): Sampling temperature to use. Defaults to 0.0.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to None.
        random_seed (int, optional): Random seed to use for sampling. Defaults to None.
        response_format (Dict[str, str], optional): A dictionary specifying the format of the
            response. Defaults to None.
        safe_prompt (bool, optional): Whether to use safe prompt. Defaults to False.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 5.
        timeout (int, optional): The timeout for completion requests in seconds. Defaults to 120.

    Example:
        .. code-block:: python

            # Get your own Mistral API Key: https://docs.mistral.ai/#api-access
            # Set the MISTRAL_API_KEY environment variable

            from phoenix.evals import MistralAIModel
            model = MistralAIModel(model="mistral-large-latest")
    """

    model: str = DEFAULT_MISTRAL_MODEL
    temperature: float = 0
    top_p: Optional[float] = None
    random_seed: Optional[int] = None
    response_format: Optional[Dict[str, str]] = None
    api_key: Optional[str] = os.getenv("MISTRAL_API_KEY")
    safe_prompt: bool = False
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
            from mistralai import Mistral
            from mistralai.models import SDKError
        except ImportError:
            self._raise_import_error(
                package_name="mistralai",
                package_min_version=MINIMUM_MISTRAL_VERSION,
            )

        self._client = Mistral(api_key=self.api_key)
        self._mistral_sdk_error = SDKError

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=MistralRateLimitError,
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    def invocation_parameters(self) -> Dict[str, Any]:
        params = {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "random_seed": self.random_seed,
            "safe_prompt": self.safe_prompt,
            "response_format": self.response_format,
        }
        # Mistral is strict about not passing None values to the API
        return {k: v for k, v in params.items() if v is not None}

    @override
    def _generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        # instruction is an invalid input to Mistral models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        return self._rate_limited_completion(
            model=self.model,
            messages=self._format_prompt(prompt),
            **invocation_parameters,
        )

    def _rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                response = self._client.chat.complete(**kwargs)
            # if an SDKError is raised, check that it's a rate limit error:
            except self._mistral_sdk_error as exc:
                http_status = getattr(exc, "http_status", None)
                if http_status and http_status == 429:
                    raise MistralRateLimitError() from exc
                raise exc
            return self._parse_output(response)

        return _completion(**kwargs)

    @override
    async def _async_generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> Tuple[str, ExtraInfo]:
        # instruction is an invalid input to Mistral models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        return await self._async_rate_limited_completion(
            model=self.model,
            messages=self._format_prompt(prompt),
            **invocation_parameters,
        )

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Tuple[str, ExtraInfo]:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Tuple[str, ExtraInfo]:
            try:
                response = await self._client.chat.complete_async(**kwargs)
            except self._mistral_sdk_error as exc:
                http_status = getattr(exc, "http_status", None)
                if http_status and http_status == 429:
                    raise MistralRateLimitError() from exc
                raise exc
            return self._parse_output(response)

        return await _async_completion(**kwargs)

    def _extract_text(self, response: "ChatCompletionResponse") -> str:
        from mistralai import ToolCall

        if not response.choices:
            return ""
        message = response.choices[0].message
        if tool_calls := message.tool_calls:
            for tool_call in tool_calls:
                if not isinstance(tool_call, ToolCall):
                    continue
                if arguments := tool_call.function.arguments:
                    if isinstance(arguments, str):
                        return arguments
                    if isinstance(arguments, dict):
                        return json.dumps(arguments, ensure_ascii=False)
                    assert_never(arguments)
        if content := message.content:
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                from mistralai import TextChunk

                return "\n\n".join(chunk.text for chunk in content if isinstance(chunk, TextChunk))
        return ""

    def _extract_usage(self, usage_info: Optional["UsageInfo"]) -> Optional[Usage]:
        if not usage_info:
            return None
        return Usage(
            prompt_tokens=usage_info.prompt_tokens or 0,
            completion_tokens=usage_info.completion_tokens or 0,
            total_tokens=usage_info.total_tokens or 0,
        )

    def _parse_output(self, response: "ChatCompletionResponse") -> Tuple[str, ExtraInfo]:
        text = self._extract_text(response)
        usage = self._extract_usage(response.usage)
        return text, ExtraInfo(usage=usage)

    def _format_prompt(self, prompt: MultimodalPrompt) -> List[Dict[str, str]]:
        messages = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                messages.append({"role": "user", "content": part.content})
            else:
                raise ValueError(
                    f"Unsupported content type for {MistralAIModel.__name__}: {part.content_type}"
                )
        return messages
