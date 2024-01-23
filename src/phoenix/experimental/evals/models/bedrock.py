import json
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from phoenix.experimental.evals.models.base import BaseEvalModel
from phoenix.experimental.evals.models.rate_limiters import RateLimiter

if TYPE_CHECKING:
    from tiktoken import Encoding

logger = logging.getLogger(__name__)

MINIMUM_BOTO_VERSION = "1.28.58"
MODEL_TOKEN_LIMIT_MAPPING = {
    "anthropic.claude-instant-v1": 100 * 1024,
    "anthropic.claude-v1": 100 * 1024,
    "anthropic.claude-v2": 100 * 1024,
    "amazon.titan-text-express-v1": 8 * 1024,
    "ai21.j2-mid-v1": 8 * 1024,
    "ai21.j2-ultra-v1": 8 * 1024,
}


@dataclass
class BedrockModel(BaseEvalModel):
    model_id: str = "anthropic.claude-v2"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    top_k: int = 256
    """The cutoff where the model no longer selects the words"""
    stop_sequences: List[str] = field(default_factory=list)
    """If the model encounters a stop sequence, it stops generating further tokens. """
    max_retries: int = 6
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""
    client: Any = None
    """The bedrock session client. If unset, a new one is created with boto3."""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    """Any extra parameters to add to the request body (e.g., countPenalty for a21 models)"""

    def __post_init__(self) -> None:
        self._init_environment()
        self._init_client()
        self._init_tiktoken()
        self._init_rate_limiter()
        self.retry = self._retry(
            error_types=[],  # default to catching all errors
            min_seconds=self.retry_min_seconds,
            max_seconds=self.retry_max_seconds,
            max_retries=self.max_retries,
        )

    def _init_environment(self) -> None:
        try:
            import tiktoken

            self._tiktoken = tiktoken
        except ImportError:
            self._raise_import_error(
                package_name="tiktoken",
            )

    def _init_client(self) -> None:
        if not self.client:
            try:
                import boto3  # type:ignore

                self.client = boto3.client("bedrock-runtime")
            except ImportError:
                self._raise_import_error(
                    package_name="boto3",
                    package_min_version=MINIMUM_BOTO_VERSION,
                )

    def _init_tiktoken(self) -> None:
        try:
            encoding = self._tiktoken.encoding_for_model(self.model_id)
        except KeyError:
            encoding = self._tiktoken.get_encoding("cl100k_base")
        self._tiktoken_encoding = encoding

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=self.client.exceptions.ThrottlingException,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=2,
            maximum_per_second_request_rate=20,
            enforcement_window_minutes=1,
        )

    @property
    def max_context_size(self) -> int:
        context_size = self.max_content_size or MODEL_TOKEN_LIMIT_MAPPING.get(self.model_id, None)

        if context_size is None:
            raise ValueError(
                "Can't determine maximum context size. An unknown model name was "
                + f"used: {self.model_id}. Please set the `max_content_size` argument"
                + "when using fine-tuned models. "
            )

        return context_size

    @property
    def encoder(self) -> "Encoding":
        return self._tiktoken_encoding

    def get_tokens_from_text(self, text: str) -> List[int]:
        return self.encoder.encode(text)

    def get_text_from_tokens(self, tokens: List[int]) -> str:
        return self.encoder.decode(tokens)

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        return self._generate(prompt, **kwargs)

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        body = json.dumps(self._create_request_body(prompt))
        accept = "application/json"
        contentType = "application/json"

        response = self._generate_with_retry(
            body=body, modelId=self.model_id, accept=accept, contentType=contentType
        )

        return self._parse_output(response) or ""

    def _generate_with_retry(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""

        @self.retry
        @self._rate_limiter.limit
        def _completion_with_retry(**kwargs: Any) -> Any:
            return self.client.invoke_model(**kwargs)

        return _completion_with_retry(**kwargs)

    def _format_prompt_for_claude(self, prompt: str) -> str:
        # Claude requires prompt in the format of Human: ... Assisatnt:
        if not prompt.strip().lower().startswith("human:"):
            prompt = f"\n\nHuman:{prompt}"
        if not prompt.strip().lower().startswith("assistant:"):
            prompt = f"{prompt}\n\nAssistant:"
        return prompt

    def _create_request_body(self, prompt: str) -> Dict[str, Any]:
        # The request formats for bedrock models differ
        # see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html
        if self.model_id.startswith("ai21"):
            return {
                **{
                    "prompt": prompt,
                    "temperature": self.temperature,
                    "topP": self.top_p,
                    "maxTokens": self.max_tokens,
                    "stopSequences": self.stop_sequences,
                },
                **self.extra_parameters,
            }
        elif self.model_id.startswith("anthropic"):
            return {
                **{
                    "prompt": self._format_prompt_for_claude(prompt),
                    "temperature": self.temperature,
                    "top_p": self.top_p,
                    "top_k": self.top_k,
                    "max_tokens_to_sample": self.max_tokens,
                    "stop_sequences": self.stop_sequences,
                },
                **self.extra_parameters,
            }
        else:
            if not self.model_id.startswith("amazon"):
                logger.warn(f"Unknown format for model {self.model_id}, returning titan format...")
            return {
                **{
                    "inputText": prompt,
                    "textGenerationConfig": {
                        "temperature": self.temperature,
                        "topP": self.top_p,
                        "maxTokenCount": self.max_tokens,
                        "stopSequences": self.stop_sequences,
                    },
                },
                **self.extra_parameters,
            }

    def _parse_output(self, response: Any) -> Any:
        if self.model_id.startswith("ai21"):
            body = json.loads(response.get("body").read())
            return body.get("completions")[0].get("data").get("text")
        elif self.model_id.startswith("anthropic"):
            body = json.loads(response.get("body").read().decode())
            return body.get("completion")
        elif self.model_id.startswith("amazon"):
            body = json.loads(response.get("body").read())
            return body.get("results")[0].get("outputText")
        else:
            body = json.loads(response.get("body").read())
            return body.get("results")[0].get("data").get("outputText")
