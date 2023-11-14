import logging
from typing import Any, Callable, Dict, Optional, Union

import pandas as pd

from phoenix.experimental.evals.models import BaseEvalModel, set_verbosity
from phoenix.experimental.evals.templates import (
    PromptTemplate,
    map_template,
    normalize_prompt_template,
)

logger = logging.getLogger(__name__)

OutputParser = Callable[[str], Dict[str, Any]]


def _no_op_parser(response: str) -> Dict[str, str]:
    return {"output": response}


def llm_generate(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: BaseEvalModel,
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    output_parser: Optional[OutputParser] = None,
    output_dataframe: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Generates a text using a template using an LLM. This function is useful
    if you want to generate synthetic data, such as irrelevant responses
    Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row
        represents a record to be used as in input to the template. All
        template variable names must appear as column names in the dataframe
        (extra columns unrelated to the template are permitted).

        template (Union[PromptTemplate, str]): The prompt template as either an
        instance of PromptTemplate or a string. If the latter, the variable
        names should be surrounded by curly braces so that a call to `.format`
        can be made to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        system_instruction (Optional[str], optional): An optional system
        message.

        verbose (bool, optional): If True, prints detailed information to stdout such as model
        invocation parameters and retry info. Default False.

        output_parser (Callable[[str], Dict[str, Any]], optional): An optional function
        that takes each generated response and parses it to a dictionary. The keys of the dictionary
        should correspond to the column names of the output dataframe. If None, the output dataframe
        will have a single column named "output". Default None.

        output_dataframe (Optional[pd.DataFrame], optional): An optional dataframe to which the
        output will be appended. If None, a new dataframe will be created. Default None.

    Returns:
        generations_dataframe (pandas.DataFrame): A dataframe where each row
        represents the generated output

    """
    output_parser = output_parser or _no_op_parser
    output_df: pd.DataFrame = output_dataframe if output_dataframe is not None else pd.DataFrame()

    # Determine how much work is left and start from there
    start_index = len(output_df)
    dataframe = dataframe.iloc[start_index:]

    with set_verbosity(model, verbose) as verbose_model:
        template = normalize_prompt_template(template)
        logger.info(f"Template: \n{template.prompt()}\n")
        logger.info(f"Template variables: {template.variables}")
        prompts = map_template(dataframe, template)

        # For each prompt, generate and parse the response
        for prompt in prompts:
            logger.info(f"Prompt: {prompt}")
            response = verbose_model(prompt, instruction=system_instruction)
            parsed_response = output_parser(response)
            # Append the parsed response to the output dataframe
            output_df = output_df.append(parsed_response, ignore_index=True)  # type: ignore

        # Return the data as a dataframe
        return output_df
