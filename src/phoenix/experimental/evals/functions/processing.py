from typing import List

from ..models import BaseEvalModel


def truncate_text_by_model(model: BaseEvalModel, text: str, token_buffer: int = 0) -> str:
    """Truncates text using a give model token limit.

    Args:
        model (BaseEvalModel): The model to use as reference.
        text (str): The text to be truncated.
        token_buffer (int, optional): The number of tokens to be left as buffer. For example, if the
        `model` has a token limit of 1,000 and we want to leave a buffer of 50, the text will be
        truncated such that the resulting text comprises 950 tokens. Defaults to 0.

    Returns:
        str: Truncated text
    """
    max_token_count = model.max_context_size - token_buffer
    tokens = model.get_tokens_from_text(text)
    if len(tokens) > max_token_count:
        return model.get_text_from_tokens(tokens[:max_token_count]) + "..."
    return text


def concatenate_and_truncate_chunks(
    chunks: List[str], model: BaseEvalModel, token_buffer: int
) -> str:
    """_summary_"""
    """Given a list of `chunks` of text, this function will return the concatenated chunks
    truncated to a token limit given by the `model` and `token_buffer`. See the function
    `truncate_text_by_model` for information on the truncation process. 

    Args:
        chunks (List[str]): A list of pieces of text.
        model (BaseEvalModel): The model to use as reference.
        token_buffer (int): The number of tokens to be left as buffer. For example, if the
        `model` has a token limit of 1,000 and we want to leave a buffer of 50, the text will be
        truncated such that the resulting text comprises 950 tokens. Defaults to 0.

    Returns:
        str: _description_
    """
    return truncate_text_by_model(model=model, text=" ".join(chunks), token_buffer=token_buffer)
