import asyncio
import logging
from dataclasses import dataclass, field
from functools import partial
from typing import Any, Dict, List, Optional, Union

from phoenix.evals.exceptions import PhoenixContextLimitExceeded
from phoenix.evals.models.base import BaseModel
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.evals.templates import MultimodalPrompt

logger = logging.getLogger(__name__)

MINIMUM_BOTO_VERSION = "1.28.58"


@dataclass
class BedrockModel(BaseModel):
    """
    An interface for using LLM models via AWS Bedrock.

    This class wraps the boto3 Bedrock client with the converse API for use with Phoenix LLM
    evaluations. Calls to the AWS API are dynamically throttled when encountering rate limit
    errors. Requires the `boto3` package to be installed.

    Supports Async: 🟡
        `boto3` does not support async calls, so it's wrapped in an executor.

    Note:
        Cohere Command (Text) and AI21 Labs Jurassic-2 (Text) models don't support chat
        with the Converse API and cannot support templates with multiple parts.

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
        timeout (int, optional): The timeout for completion requests in seconds. Defaults to 120.

    Example:
        .. code-block:: python

            # configure your AWS credentials using the AWS CLI
            # https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

            from phoenix.evals import BedrockModel
            model = BedrockModel(model_id="anthropic.claude-v2")
    """

    model_id: str = "anthropic.claude-v2"
    temperature: float = 0.0
    max_tokens: int = 1024
    top_p: float = 1
    top_k: Optional[int] = None
    stop_sequences: List[str] = field(default_factory=list)
    session: Any = None
    client: Any = None
    max_content_size: Optional[int] = None
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    initial_rate_limit: int = 5
    timeout: int = 120

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

    def _generate(self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]) -> str:
        # the legacy "instruction" parameter from llm_classify is intended to indicate a
        # system instruction, but not all models supported by Bedrock support system instructions
        _ = kwargs.pop("instruction", None)

        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        body = self._create_request_body(prompt)
        response = self._rate_limited_completion(**body)

        return self._parse_output(response) or ""

    async def _async_generate(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> str:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(self._generate, prompt, **kwargs))

    def _rate_limited_completion(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""

        @self._rate_limiter.limit
        def _completion(**kwargs: Any) -> Any:
            try:
                return self.client.converse(**kwargs)
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

    def _create_request_body(self, prompt: MultimodalPrompt) -> Dict[str, Any]:
        # The request formats for bedrock models differ
        # see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters.html

        prompt_str = prompt.to_text_only_prompt()

        # Construct the messages list
        messages = [
            {
                "role": "user",
                "content": [{"text": prompt_str}],
            }
        ]

        # Construct the inferenceConfig
        inference_config = {
            "maxTokens": self.max_tokens,
            "temperature": self.temperature,
            "topP": self.top_p,
            "stopSequences": self.stop_sequences,
        }

        # Add any extra parameters that aren't part of the Converse inferenceConfig parameter
        additional_model_request_fields: Dict[str, Union[int, Dict[str, Any]]] = {}
        # Only add top_k if specified and model supports it
        if self.top_k is not None and self._model_supports_top_k():
            if "nova" in self.model_id:
                additional_model_request_fields["inferenceConfig"] = {"topK": self.top_k}
            else:
                additional_model_request_fields["top_k"] = self.top_k

        # Add any remaining extra parameters
        additional_model_request_fields.update(self.extra_parameters)

        # Construct the input_params to the converse API
        converse_input_params = {
            "modelId": self.model_id,
            "messages": messages,
            "inferenceConfig": inference_config,
        }

        # Only add additional fields if we have any
        if additional_model_request_fields:
            converse_input_params["additionalModelRequestFields"] = additional_model_request_fields

        return converse_input_params

    def _parse_output(self, response: Any) -> Any:
        return response.get("output").get("message").get("content")[0]["text"]

    def _model_supports_top_k(self) -> bool:
        """
        Some models do not support the topK parameter.
        Meta Llama and Titan models do not support the topK parameter

        """
        models_that_do_not_support_top_k = ["meta.llama", "titan"]
        return not any(model in self.model_id for model in models_that_do_not_support_top_k)
