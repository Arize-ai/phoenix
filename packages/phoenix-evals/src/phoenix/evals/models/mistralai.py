from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter


if TYPE_CHECKING:
    from mistralai.models import UserMessage

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
        safe_mode (bool, optional): Whether to use safe mode. Defaults to False.
        safe_prompt (bool, optional): Whether to use safe prompt. Defaults to False.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 5.

    Example:
        .. code-block:: python

            # Get your own Mistral API Key: https://docs.mistral.ai/#api-access
            # Set the MISTRAL_API_KEY environment variable

            from phoenix.evals import MistralAIModel
            model = MistralAIModel(model="mistral-large-latest")
    """

    model: str = DEFAULT_MISTRAL_MODEL
    api_key: Optional[str] = None
    temperature: float = 0
    top_p: Optional[float] = None
    random_seed: Optional[int] = None
    response_format: Optional[Dict[str, str]] = None
    safe_mode: bool = False
    safe_prompt: bool = False
    initial_rate_limit: int = 5

    def __post_init__(self) -> None:
        self._init_client()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model

    def _init_client(self) -> None:
        try:
            from mistralai import Mistral
            from mistralai.models import UserMessage
        except ImportError:
            self._raise_import_error(
                package_name="mistralai",
                package_min_version=MINIMUM_MISTRAL_VERSION,
            )
        self._client = Mistral(api_key=self.api_key)
        self._UserMessage = UserMessage

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=MistralRateLimitError,
            max_rate_limit_retries=10,
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
                response = self._client.chat.complete(**kwargs)
            except Exception as exc:
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
                response = await self._client.chat.complete_async(**kwargs)
            except Exception as exc:
                http_status = getattr(exc, "http_status", None)
                if http_status and http_status == 429:
                    raise MistralRateLimitError() from exc
                raise exc

            return response.choices[0].message.content

        return await _async_completion(**kwargs)

    def _format_prompt(self, prompt: str) -> List["UserMessage"]:
        UserMessage = self._UserMessage
        return [UserMessage(content=prompt)]
