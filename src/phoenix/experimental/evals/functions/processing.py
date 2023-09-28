from typing import List

from ..models import BaseEvalModel


def truncate_text_by_model(model: BaseEvalModel, text: str, token_buffer: int = 0) -> str:
    max_token_count = model.max_context_size - token_buffer
    tokens = model.get_tokens_from_text(text)
    if len(tokens) > max_token_count:
        return model.get_text_from_tokens(tokens[:max_token_count]) + "..."
    return text


def concatenate_and_truncate_chunks(
    chunks: List[str], model: BaseEvalModel, token_buffer: int
) -> str:
    """This is designed to be used on a row of a Pandas Dataframe column.
       value = ["chunk", "chunk", chunk"]
       It concatenates the chunks in a list to a str, the column can be used for Q&A Eval.
       df['retrieved_context'].apply(lambda x: concatenate_and_truncate_chunks(x))
       It makes sure the string can fit in a model / token <min> string size,
       drops the tokens that don't fit.
    Args:
        values (list of str): a list: value = ["chunk", "chunk", chunk"]

    Returns:
        str: "Reference:
              chunk
                ....
              Reference:
              chunk"
            As a single string

    """
    return truncate_text_by_model(model=model, text=" ".join(chunks), token_buffer=token_buffer)
