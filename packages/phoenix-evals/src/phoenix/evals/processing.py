"""
Token processing functions for supported models. This module is being deprecated.
"""
import logging
import sys
from typing import Any, List

import tiktoken
from phoenix.evals.models import BaseModel

logger = logging.getLogger(__name__)

OPENAI_MODEL_TOKEN_LIMIT_MAPPING = {
    "gpt-3.5-turbo-instruct": 4096,
    "gpt-3.5-turbo-0301": 4096,
    "gpt-3.5-turbo-0613": 4096,  # Current gpt-3.5-turbo default
    "gpt-3.5-turbo-16k-0613": 16385,
    "gpt-4-0314": 8192,
    "gpt-4-0613": 8192,  # Current gpt-4 default
    "gpt-4-32k-0314": 32768,
    "gpt-4-32k-0613": 32768,
    "gpt-4-1106-preview": 128000,
    "gpt-4-vision-preview": 128000,
}

ANTHROPIC_MODEL_TOKEN_LIMIT_MAPPING = {
    "claude-2.1": 200000,
    "claude-2.0": 100000,
    "claude-instant-1.2": 100000,
}

# https://cloud.google.com/vertex-ai/docs/generative-ai/learn/models
GEMINI_MODEL_TOKEN_LIMIT_MAPPING = {
    "gemini-pro": 32760,
    "gemini-pro-vision": 16384,
}

BEDROCK_MODEL_TOKEN_LIMIT_MAPPING = {
    "anthropic.claude-instant-v1": 100 * 1024,
    "anthropic.claude-v1": 100 * 1024,
    "anthropic.claude-v2": 100 * 1024,
    "amazon.titan-text-express-v1": 8 * 1024,
    "ai21.j2-mid-v1": 8 * 1024,
    "ai21.j2-ultra-v1": 8 * 1024,
}

MODEL_TOKEN_LIMIT = {
    **OPENAI_MODEL_TOKEN_LIMIT_MAPPING,
    **ANTHROPIC_MODEL_TOKEN_LIMIT_MAPPING,
    **GEMINI_MODEL_TOKEN_LIMIT_MAPPING,
    **BEDROCK_MODEL_TOKEN_LIMIT_MAPPING,
}

_DEPRECATION_WARNING = (
    "The processing module is being deprecated. For advanced token processing, please use the "
    "encoding approach recommended by the model provider. For example, OpenAI models can use the "
    "`tiktoken` library to encode and decode text. For other models, please refer to the model "
    "provider's documentation."
)


def get_encoder(model: BaseModel) -> tiktoken.Encoding:
    try:
        encoding = tiktoken.encoding_for_model(model._model_name)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    return encoding


def max_context_size(model: BaseModel) -> int:
    # default to 4096
    return MODEL_TOKEN_LIMIT.get(model._model_name, 4096)


def get_tokens_from_text(encoder: tiktoken.Encoding, text: str) -> List[int]:
    return encoder.encode(text)


def get_text_from_tokens(encoder: tiktoken.Encoding, tokens: List[int]) -> str:
    return encoder.decode(tokens)


def truncate_text_by_model(model: BaseModel, text: str, token_buffer: int = 0) -> str:
    """Truncates text using a give model token limit.

    Args:
        model (BaseModel): The model to use as reference.
        text (str): The text to be truncated.
        token_buffer (int, optional): The number of tokens to be left as buffer. For example, if the
        `model` has a token limit of 1,000 and we want to leave a buffer of 50, the text will be
        truncated such that the resulting text comprises 950 tokens. Defaults to 0.

    Returns:
        str: Truncated text
    """
    encoder = get_encoder(model)
    max_token_count = max_context_size(model) - token_buffer
    tokens = get_tokens_from_text(encoder, text)
    if len(tokens) > max_token_count:
        return get_text_from_tokens(encoder, tokens[:max_token_count]) + "..."
    return text


def concatenate_and_truncate_chunks(chunks: List[str], model: BaseModel, token_buffer: int) -> str:
    """_summary_"""
    """Given a list of `chunks` of text, this function will return the concatenated chunks
    truncated to a token limit given by the `model` and `token_buffer`. See the function
    `truncate_text_by_model` for information on the truncation process.

    Args:
        chunks (List[str]): A list of pieces of text.
        model (BaseModel): The model to use as reference.
        token_buffer (int): The number of tokens to be left as buffer. For example, if the
        `model` has a token limit of 1,000 and we want to leave a buffer of 50, the text will be
        truncated such that the resulting text comprises 950 tokens. Defaults to 0.

    Returns:
        str: A prompt string that fits within a model's context window.
    """
    return truncate_text_by_model(model=model, text=" ".join(chunks), token_buffer=token_buffer)


class _DEPRECATED_MODULE:
    __all__ = ("truncate_text_by_model", "concatenate_and_truncate_chunks")

    def __getattr__(self, name: str) -> Any:
        if name == "truncate_text_by_model":
            logger.warning(_DEPRECATION_WARNING)
            return truncate_text_by_model
        if name == "concatenate_and_truncate_chunks":
            logger.warning(_DEPRECATION_WARNING)
            return concatenate_and_truncate_chunks
        raise AttributeError(f"module {__name__} has no attribute {name}")


# See e.g. https://stackoverflow.com/a/7668273
sys.modules[__name__] = _DEPRECATED_MODULE()  # type: ignore
