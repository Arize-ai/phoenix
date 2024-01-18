import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List

from phoenix.experimental.evals.models.base import BaseEvalModel
from phoenix.experimental.evals.models.rate_limiters import RateLimiter
from phoenix.utilities.logging import printif

if TYPE_CHECKING:
    from tiktoken import Encoding

logger = logging.getLogger(__name__)


# https://cloud.google.com/vertex-ai/docs/generative-ai/learn/models
MODEL_TOKEN_LIMIT_MAPPING = {
    "gemini-pro": 32760,
    "gemini-pro-vision": 16384,
}


@dataclass
class GeminiModel(BaseEvalModel):
    model: str = "gemini-pro"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    top_k: int = 32
    """The cutoff where the model no longer selects the words"""
    stop_sequences: List[str] = field(default_factory=list)
    """If the model encounters a stop sequence, it stops generating further tokens. """
    max_retries: int = 6
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""

    def __post_init__(self) -> None:
        self._init_client()
        self._init_rate_limiter()
        self.retry = self._retry(
            error_types=[],  # default to catching all errors
            min_seconds=self.retry_min_seconds,
            max_seconds=self.retry_max_seconds,
            max_retries=self.max_retries,
        )

    def reload_client(self) -> None:
        self._init_client()

    def _init_client(self) -> None:
        try:
            from google.api_core import exceptions  # type:ignore
            from vertexai.preview import generative_models as vertex  # type:ignore

            self._vertex = vertex
            self._gcp_exceptions = exceptions
            self._model = self._vertex.GenerativeModel(self.model)
        except ImportError:
            self._raise_import_error(
                package_name="vertexai",
            )

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=self._gcp_exceptions.ResourceExhausted,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=20,
            enforcement_window_minutes=1,
        )

    @property
    def encoder(self) -> "Encoding":
        raise TypeError("Gemini models contain their own token counting")

    def get_tokens_from_text(self, text: str) -> List[int]:
        raise NotImplementedError

    def get_text_from_tokens(self, tokens: List[int]) -> str:
        raise NotImplementedError

    @property
    def max_context_size(self) -> int:
        context_size = MODEL_TOKEN_LIMIT_MAPPING.get(self.model, None)

        if context_size is None:
            raise ValueError(
                "Can't determine maximum context size. An unknown model name was "
                + f"used: {self.model}. Please set the `max_content_size` argument"
                + "when using fine-tuned models. "
            )

        return context_size

    @property
    def generation_config(self) -> Dict[str, Any]:
        return {
            "temperature": self.temperature,
            "max_output_tokens": self.max_tokens,
            "top_p": self.top_p,
            "top_k": self.top_k,
            "stop_sequences": self.stop_sequences,
        }

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        # instruction is an invalid input to Gemini models, it is passed in by
        # BaseEvalModel.__call__ and needs to be removed
        kwargs.pop("instruction", None)
        response = self._generate_with_retry(
            prompt=prompt,
            generation_config=self.generation_config,
            **kwargs,
        )

        return str(response)

    def _generate_with_retry(
        self, prompt: str, generation_config: Dict[str, Any], **kwargs: Any
    ) -> Any:
        @self.retry
        @self._rate_limiter.limit
        def _completion_with_retry(**kwargs: Any) -> Any:
            response = self._model.generate_content(
                contents=prompt, generation_config=generation_config, **kwargs
            )
            return self._parse_response_candidates(response)

        return _completion_with_retry(**kwargs)

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        kwargs.pop("instruction", None)
        response = await self._async_generate_with_retry(
            prompt=prompt,
            generation_config=self.generation_config,
            **kwargs,
        )

        return str(response)

    async def _async_generate_with_retry(
        self, prompt: str, generation_config: Dict[str, Any], **kwargs: Any
    ) -> Any:
        @self.retry
        @self._rate_limiter.alimit
        async def _completion_with_retry(**kwargs: Any) -> Any:
            response = await self._model.generate_content_async(
                contents=prompt, generation_config=generation_config, **kwargs
            )
            return self._parse_response_candidates(response)

        return await _completion_with_retry(**kwargs)

    def _parse_response_candidates(self, response: Any) -> Any:
        if hasattr(response, "candidates"):
            if isinstance(response.candidates, list) and len(response.candidates) > 0:
                try:
                    candidate = response.candidates[0].text
                except ValueError:
                    printif(
                        self._verbose, "The 'candidates' object does not have a 'text' attribute."
                    )
                    printif(self._verbose, response.candidates[0])
                    candidate = ""
            else:
                printif(
                    self._verbose,
                    "The 'candidates' attribute of 'response' is either not a list or is empty.",
                )
                printif(self._verbose, response)
                candidate = ""
        else:
            printif(self._verbose, "The 'response' object does not have a 'candidates' attribute.")
            candidate = ""
        return candidate
