import logging
from typing import Any, Callable, Dict, Optional, Tuple, Union

import pandas as pd

from phoenix.experimental.evals.functions.executor import (
    get_executor_on_sync_context,
)
from phoenix.experimental.evals.models import BaseEvalModel, set_verbosity
from phoenix.experimental.evals.templates import (
    PromptTemplate,
    map_template,
    normalize_prompt_template,
)
from phoenix.experimental.evals.utils import get_tqdm_progress_bar_formatter

logger = logging.getLogger(__name__)


def _no_op_parser(response: str, response_index: int) -> Dict[str, str]:
    return {"output": response}


def llm_generate(
    dataframe: pd.DataFrame,
    template: Union[PromptTemplate, str],
    model: BaseEvalModel,
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    output_parser: Optional[Callable[[str, int], Dict[str, Any]]] = None,
    include_prompt: bool = False,
    include_response: bool = False,
    run_sync: bool = False,
    concurrency: int = 20,
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

        output_parser (Callable[[str, int], Dict[str, Any]], optional): An optional function
        that takes each generated response and response index and parses it to a dictionary. The
        keys of the dictionary should correspond to the column names of the output dataframe. If
        None, the output dataframe will have a single column named "output". Default None.

        include_prompt (bool, default=False): If True, includes a column named `prompt` in the
        output dataframe containing the prompt used for each generation.

        include_response (bool, default=False): If True, includes a column named `response` in the
        output dataframe containing the raw response from the LLM prior to applying the output
        parser.

        run_sync (bool, default=False): If True, forces synchronous request submission. Otherwise
        evaluations will be run asynchronously if possible.

        concurrency (int, default=20): The number of concurrent evals if async submission is
        possible.

    Returns:
        generations_dataframe (pandas.DataFrame): A dataframe where each row
        represents the generated output

    """
    tqdm_bar_format = get_tqdm_progress_bar_formatter("llm_generate")
    output_parser = output_parser or _no_op_parser
    template = normalize_prompt_template(template)
    logger.info(f"Template: \n{template.prompt()}\n")
    logger.info(f"Template variables: {template.variables}")
    prompts = map_template(dataframe, template)

    async def _run_llm_generation_async(enumerated_prompt: Tuple[int, str]) -> Dict[str, Any]:
        index, prompt = enumerated_prompt
        with set_verbosity(model, verbose) as verbose_model:
            response = await verbose_model._async_generate(
                prompt,
                instruction=system_instruction,
            )
        parsed_response = output_parser(response, index)
        if include_prompt:
            parsed_response["prompt"] = prompt
        if include_response:
            parsed_response["response"] = response
        return parsed_response

    def _run_llm_generation_sync(enumerated_prompt: Tuple[int, str]) -> Dict[str, Any]:
        index, prompt = enumerated_prompt
        with set_verbosity(model, verbose) as verbose_model:
            response = verbose_model._generate(
                prompt,
                instruction=system_instruction,
            )
        parsed_response = output_parser(response, index)
        if include_prompt:
            parsed_response["prompt"] = prompt
        if include_response:
            parsed_response["response"] = response
        return parsed_response

    fallback_return_value = {
        "output": "generation-failed",
        **({"prompt": ""} if include_prompt else {}),
        **({"response": ""} if include_response else {}),
    }

    executor = get_executor_on_sync_context(
        _run_llm_generation_sync,
        _run_llm_generation_async,
        run_sync=run_sync,
        concurrency=concurrency,
        tqdm_bar_format=tqdm_bar_format,
        exit_on_error=True,
        fallback_return_value=fallback_return_value,
    )
    output = executor.run(list(enumerate(prompts.tolist())))
    return pd.DataFrame(output)
