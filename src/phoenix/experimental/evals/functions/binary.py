from typing import List, Optional, Union

import pandas as pd

from ..models import BaseEvalModel
from ..templates import PromptTemplate


async def llm_eval_binary(
    df: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: BaseEvalModel,
    system_instruction: Optional[str] = None,
    # output_parser=ResultParser( # KIKO TO MAKE THIS A CALLABLE
    #     opts=...
    #     trim_whitespaces=True,
    #     to_lowercase=True,
    #     output_rails={
    #         "irrelevant": "1",
    #         "relevant": "0"
    #     },
    #     default = "NaN"
    # )
) -> List[str]:
    if not (isinstance(template, PromptTemplate) or isinstance(template, str)):
        raise TypeError(
            "Invalid type for argument `template`. Expected a string or PromptTemplate "
            f"but found {type(template)}."
        )
    if isinstance(template, str):
        try:
            eval_template = PromptTemplate(text=template)
        except Exception as e:
            raise RuntimeError(f"Error while initializing the PromptTemplate: {e}")
    else:
        eval_template = template

    # I was considering to construct the prompts and generate answers concurrently. However,
    # if there's errors in the prompt construction it could interrupt the process and we
    # would've used API credits for nothing. We could solve this problem by streaming the
    # answers so that, if there is an error, we keep the answers obtained up to that point.
    # These are out of scope for M0, but good to keep in mind and consider for the future.
    try:
        prompts = df.apply(
            lambda row: eval_template.format(
                variable_values={var_name: row[var_name] for var_name in eval_template.variables}
            ),
            axis=1,
        )
    except KeyError as e:
        raise RuntimeError(
            f"Error while constructing the prompts from the template and dataframe. "
            f"The template variable {e} is not found as a column in the dataframe."
        )
    except Exception as e:
        raise RuntimeError(
            f"Error while constructing the prompts from the template and dataframe variables: {e}."
        )

    responses = await model.agenerate(prompts.to_list(), system_instruction)
    return responses
