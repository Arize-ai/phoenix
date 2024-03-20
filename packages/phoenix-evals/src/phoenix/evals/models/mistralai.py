from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter

if TYPE_CHECKING:
    from mistralai.models.chat_completion import ChatMessage

DEFAULT_MISTRAL_MODEL = "mistral-large-latest"
"""Use the latest large mistral model by default."""

MINIMUM_MISTRAL_VERSION = "0.0.11"


class MistralRateLimitError(Exception):
    pass


@dataclass
class MistralAIModel(BaseModel):
    """
    A model class for Mistral AI.
    Requires mistralai package to be installed.
    """

    model: str = DEFAULT_MISTRAL_MODEL
    temperature: float = 0
    top_p: Optional[float] = None
    random_seed: Optional[int] = None
    safe_mode: bool = False
    safe_prompt: bool = False

    def __post_init__(self) -> None:
        self._init_client()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model

    def _init_client(self) -> None:
        try:
            from mistralai.async_client import MistralAsyncClient
            from mistralai.client import MistralClient
            from mistralai.exceptions import MistralAPIException
            from mistralai.models.chat_completion import ChatMessage
        except ImportError:
            self._raise_import_error(
                package_name="mistralai",
                package_min_version=MINIMUM_MISTRAL_VERSION,
            )
        self._client = MistralClient()
        self._async_client = MistralAsyncClient()
        self._ChatMessage = ChatMessage
        self._MistralAPIException = MistralAPIException

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=MistralRateLimitError,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=20,
            enforcement_window_minutes=1,
        )

    def invocation_parameters(self) -> Dict[str, Any]:
        params = {
            "temperature": self.temperature,
            "top_p": self.top_p,
            "random_seed": self.random_seed,
            "safe_mode": self.safe_mode,
            "safe_prompt": self.safe_prompt,
        }
        # Mistral is strict about not passing None values to the API
        return {k: v for k, v in params.items() if v is not None}

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        # instruction is an invalid input to Mistral models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        response = self._rate_limited_completion(
            model=self.model,
            messages=self._format_prompt(prompt),
            **invocation_parameters,
        )

        return str(response)

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                response = self._client.chat(**kwargs)
            except self._MistralAPIException as exc:
                http_status = getattr(exc, "http_status", None)
                if http_status and http_status == 429:
                    raise MistralRateLimitError() from exc
                raise exc
            return response.choices[0].message.content

        return _completion(**kwargs)

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        # instruction is an invalid input to Mistral models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)
        invocation_parameters = self.invocation_parameters()
        invocation_parameters.update(kwargs)
        response = await self._async_rate_limited_completion(
            model=self.model,   
            messages=self._format_prompt(prompt),
            **invocation_parameters,
        )

        return str(response)

    async def _async_rate_limited_completion(self, **kwargs: Any) -> Any:
        @self._rate_limiter.alimit
        async def _async_completion(**kwargs: Any) -> Any:
            try:
                response = await self._async_client.chat(**kwargs)
            except self._MistralAPIException as exc:
                http_status = getattr(exc, "http_status", None)
                if http_status and http_status == 429:
                    raise MistralRateLimitError() from exc
                raise exc
                
            return response.choices[0].message.content

        return await _async_completion(**kwargs)

    def _format_prompt(self, prompt: str) -> List["ChatMessage"]:
        ChatMessage = self._ChatMessage
        return [ChatMessage(role="user", content=prompt)]
