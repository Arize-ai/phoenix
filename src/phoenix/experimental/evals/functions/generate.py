from typing import List, Optional, Union

import pandas as pd

from ..models import BaseEvalModel
from ..models.openai import OpenAiModel
from ..templates import PromptTemplate, normalize_template
from .common import map_template


def llm_generate(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: Optional[BaseEvalModel],
    system_instruction: Optional[str],
) -> List[str]:
    """
    Generates a text using a template using an LLM. Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row
        represents a record to be used as in inpute to the template. All
        template variable names must appear as column names in the dataframe
        (extra columns unrelated to the template are permitted).

        template (Union[PromptTemplate, str]): The prompt template as either an
        instance of PromptTemplate or a string. If the latter, the variable
        names should be surrounded by curly braces so that a call to `.format`
        can be made to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        system_instruction (Optional[str], optional): An optional system
        message.
    Returns:
        List[Optional[str]]: A list of strings representing the output of the
        model for each record

    """
    model = model or OpenAiModel()
    template = normalize_template(template)
    prompts = map_template(dataframe, template)

    responses = model.generate(prompts.to_list(), system_instruction)
    return responses
