import logging
import warnings
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union

from typing_extensions import override

from phoenix.evals.legacy.models.base import BaseModel, ExtraInfo, Usage
from phoenix.evals.legacy.templates import MultimodalPrompt, PromptPartContentType

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from litellm.types.utils import ModelResponse


@dataclass
class LiteLLMModel(BaseModel):
    """
    An interface for using LLM models with the LiteLLM interface.

    This class wraps the LiteLLM library for use with Phoenix LLM evaluations. Requires the
    `litellm` package to be installed.

    ⚠️ Warning: Due to the number of supported models and variations in rate limit handling, we
    do not catch rate limit exceptions and throttle requests.

    Supports Async: ❌
        `litellm` provides an async interface for making LLM calls. However, because we cannot
        reliably catch and throttle requests when encountering rate limit errors, we do not
        asyncronously make requests using `litellm` to avoid exceeding rate limits.

    Args:
        model (str): The model name to use.
        temperature (float, optional): Sampling temperature to use. Defaults to 0.0.
        max_tokens (int, optional): Maximum number of tokens to generate in the completion.
            Defaults to 256.
        top_p (float, optional): Total probability mass of tokens to consider at each step.
            Defaults to 1.
        num_retries (int, optional): Maximum number to retry a model if a RateLimitError,
            OpenAIError, or ServiceUnavailableError occurs. Defaults to 0.
        request_timeout (int, optional): Maximum number of seconds to wait when retrying.
            Defaults to 60.
        model_kwargs (Dict[str, Any], optional): Model specific params. Defaults to an empty dict.

    Example:
        .. code-block:: python

            # configuring a local llm via litellm
            os.environ["OLLAMA_API_BASE"] = "http://localhost:11434"

            from phoenix.evals import LiteLLMModel
            model = LiteLLMModel(model="ollama/llama3")
    """

    model: str = "gpt-3.5-turbo"
    temperature: float = 0.0
    max_tokens: int = 1024
    top_p: float = 1
    num_retries: int = 0
    request_timeout: int = 60
    model_kwargs: Dict[str, Any] = field(default_factory=dict)

    # Deprecated fields
    model_name: Optional[str] = None
    """
    .. deprecated:: 3.0.0
       use `model` instead. This will be removed in a future release.
    """

    def __post_init__(self) -> None:
        self._migrate_model_name()
        self._init_environment()

    @property
    def _model_name(self) -> str:
        return self.model

    def _migrate_model_name(self) -> None:
        if self.model_name is not None:
            warning_message = "The `model_name` field is deprecated. Use `model` instead. \
                This will be removed in a future release."
            warnings.warn(
                warning_message,
                DeprecationWarning,
            )
            print(warning_message)
            self.model = self.model_name
            self.model_name = None

    def _init_environment(self) -> None:
        try:
            import litellm
            from litellm.utils import validate_environment

            self._litellm = litellm
            env_info = validate_environment(self.model)

            if not env_info["keys_in_environment"] and env_info["missing_keys"]:
                raise RuntimeError(
                    f"Missing environment variable(s): '{str(env_info['missing_keys'])}', for "
                    f"model: {self.model}. \nFor additional information about the right "
                    "environment variables for specific model providers:\n"
                    "https://docs.litellm.ai/docs/completion/input#provider-specific-params."
                )
        except ImportError:
            self._raise_import_error(
                package_display_name="LiteLLM",
                package_name="litellm",
            )

    @override
    async def _async_generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        return self._generate_with_extra(prompt, **kwargs)

    @override
    def _generate_with_extra(
        self, prompt: Union[str, MultimodalPrompt], **kwargs: Dict[str, Any]
    ) -> Tuple[str, ExtraInfo]:
        if isinstance(prompt, str):
            prompt = MultimodalPrompt.from_string(prompt)

        messages = self._get_messages_from_prompt(prompt)
        response = self._litellm.completion(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            top_p=self.top_p,
            num_retries=self.num_retries,
            request_timeout=self.request_timeout,
            **self.model_kwargs,
        )
        return self._parse_output(response)

    def _extract_text(self, response: "ModelResponse") -> str:
        from litellm.types.utils import Choices

        if (
            response.choices
            and (choice := response.choices[0])
            and isinstance(choice, Choices)
            and choice.message.content
        ):
            return str(choice.message.content)
        return ""

    def _extract_usage(self, response: "ModelResponse") -> Optional[Usage]:
        from litellm.types.utils import Usage as ResponseUsage

        if isinstance(response_usage := response.get("usage"), ResponseUsage):  # type: ignore[no-untyped-call]
            return Usage(
                prompt_tokens=response_usage.prompt_tokens,
                completion_tokens=response_usage.completion_tokens,
                total_tokens=response_usage.total_tokens,
            )
        return None

    def _parse_output(self, response: "ModelResponse") -> Tuple[str, ExtraInfo]:
        text = self._extract_text(response)
        usage = self._extract_usage(response)
        return text, ExtraInfo(usage=usage)

    def _get_messages_from_prompt(self, prompt: MultimodalPrompt) -> List[Dict[str, str]]:
        # LiteLLM requires prompts in the format of messages
        messages = []
        for part in prompt.parts:
            if part.content_type == PromptPartContentType.TEXT:
                messages.append({"content": part.content, "role": "user"})
            else:
                raise ValueError(
                    f"Unsupported content type for {LiteLLMModel.__name__}: {part.content_type}"
                )
        return messages
