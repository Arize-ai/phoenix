import asyncio
import json
import logging
from dataclasses import dataclass, field
from functools import partial
from typing import Any, Dict, List, Optional

from phoenix.evals.exceptions import PhoenixContextLimitExceeded
from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter

logger = logging.getLogger(__name__)

MINIMUM_BOTO_VERSION = "1.28.58"


@dataclass
class BedrockModel(BaseModel):
    """
    An interface for using LLM models via AWS Bedrock.

    This class wraps the boto3 Bedrock client for use with Phoenix LLM evaluations. Calls to the
    AWS API are dynamically throttled when encountering rate limit errors. Requires the `boto3`
    package to be installed.

    Supports Async: 🟡
        `boto3` does not support async calls, so it's wrapped in an executor.

    Args:
        model_id (str): The model name to use.
        temperature (float, optional): Sampling temperature to use. Defaults to 0.0.
        max_tokens (int, optional): Maximum number of tokens to generate in the completion.
            Defaults to 256.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to 1.
        top_k (int, optional): The cutoff where the model no longer selects the words.
            Defaults to 256.
        stop_sequences (List[str], optional): If the model encounters a stop sequence, it stops
            generating further tokens. Defaults to an empty list.
        session (Any, optional): A bedrock session. If provided, a new bedrock client will be
            created using this session. Defaults to None.
        client (Any, optional): The bedrock session client. If unset, a new one is created with
            boto3. Defaults to None.
        max_content_size (Optional[int], optional): If using a fine-tuned model, set this to the
            maximum content size. Defaults to None.
        extra_parameters (Dict[str, Any], optional): Any extra parameters to add to the request
            body (e.g., countPenalty for a21 models). Defaults to an empty dictionary.
        initial_rate_limit (int, optional): The initial internal rate limit in allowed requests
            per second for making LLM calls. This limit adjusts dynamically based on rate
            limit errors. Defaults to 5.

    Example:
        .. code-block:: python

            # configure your AWS credentials using the AWS CLI
            # https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

            from phoenix.evals import BedrockModel
            model = BedrockModel(model_id="anthropic.claude-v2")
    """

    model_id: str = "anthropic.claude-v2"
    temperature: float = 0.0
    max_tokens: int = 256
    top_p: float = 1
    top_k: int = 256
    stop_sequences: List[str] = field(default_factory=list)
    session: Any = None
    client: Any = None
    max_content_size: Optional[int] = None
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    initial_rate_limit: int = 5

    def __post_init__(self) -> None:
        self._init_client()
        self._init_rate_limiter()

    @property
    def _model_name(self) -> str:
        return self.model_id

    def _init_client(self) -> None:
        if not self.client:
            if self.session:
                self.client = self.session.client("bedrock-runtime")
            else:
                try:
                    import boto3  # type:ignore

                    self.client = boto3.client("bedrock-runtime")
                except ImportError:
                    self._raise_import_error(
                        package_name="boto3",
                        package_min_version=MINIMUM_BOTO_VERSION,
                    )

    def _init_rate_limiter(self) -> None:
        self._rate_limiter = RateLimiter(
            rate_limit_error=self.client.exceptions.ThrottlingException,
            max_rate_limit_retries=10,
            initial_per_second_request_rate=self.initial_rate_limit,
            enforcement_window_minutes=1,
        )

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        body = json.dumps(self._create_request_body(prompt))
        accept = "application/json"
        contentType = "application/json"

        response = self._rate_limited_completion(
            body=body, modelId=self.model_id, accept=accept, contentType=contentType
        )

        return self._parse_output(response) or ""

    async def _async_generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(self._generate, prompt, **kwargs))

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""

        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                return self.client.invoke_model(**kwargs)
            except Exception as e:
                exception_message = e.args[0]
                if not exception_message:
                    raise e

                if "Input is too long" in exception_message:
                    # Error from Anthropic models
                    raise PhoenixContextLimitExceeded(exception_message) from e
                elif "expected maxLength" in exception_message:
                    # Error from Titan models
                    raise PhoenixContextLimitExceeded(exception_message) from e
                elif "Prompt has too many tokens" in exception_message:
                    # Error from AI21 models
                    raise PhoenixContextLimitExceeded(exception_message) from e
                raise e

        return _completion(**kwargs)

    def _format_prompt_for_claude(self, prompt: str) -> List[Dict[str, str]]:
        # Claude requires prompt in the format of Human: ... Assisatnt:
        return [
            {"role": "user", "content": prompt},
        ]

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
                    "anthropic_version": "bedrock-2023-05-31",
                    "messages": self._format_prompt_for_claude(prompt),
                    "temperature": self.temperature,
                    "top_p": self.top_p,
                    "top_k": self.top_k,
                    "max_tokens": self.max_tokens,
                    "stop_sequences": self.stop_sequences,
                },
                **self.extra_parameters,
            }
        elif self.model_id.startswith("mistral"):
            return {
                **{
                    "prompt": prompt,
                    "max_tokens": self.max_tokens,
                    "temperature": self.temperature,
                    "stop": self.stop_sequences,
                    "top_p": self.top_p,
                    "top_k": self.top_k,
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
            return body.get("content")[0]["text"]
        elif self.model_id.startswith("amazon"):
            body = json.loads(response.get("body").read())
            return body.get("results")[0].get("outputText")
        elif self.model_id.startswith("mistral"):
            body = json.loads(response.get("body").read())
            return body.get("outputs")[0].get("text")
        else:
            body = json.loads(response.get("body").read())
            return body.get("results")[0].get("data").get("outputText")
