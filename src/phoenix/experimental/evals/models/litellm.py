from functools import partial
import json
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from phoenix.experimental.evals.models.base import BaseEvalModel

logger = logging.getLogger(__name__)

@dataclass
class LiteLLM(BaseEvalModel):
    model_name: str = "gpt-3.5-turbo"
    """The model name to use."""
    temperature: float = 0.0
    """What sampling temperature to use."""
    max_tokens: int = 256
    """The maximum number of tokens to generate in the completion."""
    top_p: float = 1
    """Total probability mass of tokens to consider at each step."""
    top_k: int = 256
    """The cutoff where the model no longer selects the words"""
    max_retries: int = 6
    """Maximum number of retries to make when generating."""
    retry_min_seconds: int = 10
    """Minimum number of seconds to wait when retrying."""
    retry_max_seconds: int = 60
    """Maximum number of seconds to wait when retrying."""
    max_content_size: Optional[int] = None
    """If you're using a fine-tuned model, set this to the maximum content size"""
    extra_parameters: Dict[str, Any] = field(default_factory=dict)
    """Any extra parameters to add to the request body (e.g., countPenalty for a21 models)"""

    def __post_init__(self) -> None:
        self._init_environment()
        self._init_model_encoding()

    def _init_environment(self) -> None:
        try:
            import litellm  # type:ignore
            
            self._litellm = litellm
            self._completion = partial(litellm.completion, max_tokens=self.max_tokens)
        except ImportError:
            self._raise_import_error(
                package_display_name="LiteLLM",
                package_name="litellm",
            )
    
    def _init_model_encoding(self) -> None:
        from litellm import token_counter, decode   # type:ignore

        if self.model_name in self._litellm.utils.get_valid_models():
            self._encoding = partial(token_counter, model=self.model_name)
            self._decoding = partial(decode, model=self.model_name)
        else:
            raise ValueError("Model name not found in the LiteLLM's valid models list")

    @property
    def max_context_size(self) -> int:
        context_size = self.max_content_size or self._litellm.get_max_tokens(self.model_name).get('max_tokens', None)

        if context_size is None:
            raise ValueError(
                "Can't determine maximum context size. An unknown model name was "
                + f"used: {self.model_name}."
            )

        return context_size

    @property
    def encoder(self) -> "Encoding": # type:ignore

        # Multiple encoders supported by LiteLLM apart from TikToken. 
        # So interface's return type needs a change.
        # Ex: claude-2, claude-instant-1 -> tokenizers.Tokenizer

        # from litellm.utils import _select_tokenizer # type: ignore
        # return _select_tokenizer(self.model_name)

        raise NotImplementedError

    def get_tokens_from_text(self, text: str) -> List[int]:
        return self._encoding(text)

    def get_text_from_tokens(self, tokens: List[int]) -> str:
        return self._decoding(tokens)

    def _generate(self, prompt: str, **kwargs: Dict[str, Any]) -> str:
        messages = self._get_messages_for_litellm(prompt)
        response = self._completion(model=self.model_name, messages=messages)
        return response.choices[0].message.content

    def _generate_with_retry(self, **kwargs: Any) -> Any:
        """Use tenacity to retry the completion call."""
        # TODO find proper exceptions
        retry_errors = [] 

        @self.retry(
            error_types=retry_errors,
            min_seconds=self.retry_min_seconds,
            max_seconds=self.retry_max_seconds,
            max_retries=self.max_retries,
        )
        def _completion_with_retry(**kwargs: Any) -> Any:
            return self._litellm.completion_with_retries(**kwargs)

        return _completion_with_retry(**kwargs)

    def _get_messages_for_litellm(self, prompt: str) -> str:
        # LiteLLM requires prompts in the format of messages
        # messages=[{"content": "ABC?","role": "user"}]
        return [{"content": prompt, "role": "user"}]

        