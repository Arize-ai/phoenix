from __future__ import annotations

import inspect
import logging
import warnings
from collections import defaultdict
from enum import Enum
from functools import wraps
from itertools import product
from typing import (
    Any,
    Callable,
    DefaultDict,
    Dict,
    Iterable,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Tuple,
    TypeVar,
    Union,
)

import pandas as pd
from pandas import DataFrame
from typing_extensions import TypeAlias

from phoenix.evals.evaluators import LLMEvaluator
from phoenix.evals.exceptions import PhoenixTemplateMappingError
from phoenix.evals.executors import ExecutionStatus, get_executor_on_sync_context
from phoenix.evals.models import BaseModel, OpenAIModel, set_verbosity
from phoenix.evals.templates import (
    ClassificationTemplate,
    MultimodalPrompt,
    PromptOptions,
    PromptTemplate,
    normalize_classification_template,
)
from phoenix.evals.utils import (
    NOT_PARSABLE,
    get_tqdm_progress_bar_formatter,
    openai_function_call_kwargs,
    parse_openai_function_call,
    printif,
    snap_to_rail,
)

logger = logging.getLogger(__name__)


ColumnName: TypeAlias = str
Label: TypeAlias = str
Score: TypeAlias = Optional[float]
Explanation: TypeAlias = Optional[str]
Record: TypeAlias = Mapping[str, Any]
Index: TypeAlias = int

# snapped_response, explanation, response
ParsedLLMResponse: TypeAlias = Tuple[Optional[str], Optional[str], str, str]


class ClassificationStatus(Enum):
    DID_NOT_RUN = ExecutionStatus.DID_NOT_RUN.value
    COMPLETED = ExecutionStatus.COMPLETED.value
    COMPLETED_WITH_RETRIES = ExecutionStatus.COMPLETED_WITH_RETRIES.value
    FAILED = ExecutionStatus.FAILED.value
    MISSING_INPUT = "MISSING INPUT"


PROCESSOR_TYPE = TypeVar("PROCESSOR_TYPE")


def deprecate_dataframe_arg(func: Callable[..., Any]) -> Callable[..., Any]:
    # Remove this once the `dataframe` arg in `llm_classify` is no longer supported

    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        signature = inspect.signature(func)

        if "dataframe" in kwargs:
            warnings.warn(
                "`dataframe` argument is deprecated; use `data` instead",
                DeprecationWarning,
                stacklevel=2,
            )
            kwargs["data"] = kwargs.pop("dataframe")
        bound_args = signature.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        return func(*bound_args.args, **bound_args.kwargs)

    return wrapper


@deprecate_dataframe_arg
def llm_classify(
    data: Union[pd.DataFrame, List[Any]],
    model: BaseModel,
    template: Union[ClassificationTemplate, PromptTemplate, str],
    rails: List[str],
    data_processor: Optional[Callable[[PROCESSOR_TYPE], PROCESSOR_TYPE]] = None,
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    use_function_calling_if_available: bool = True,
    provide_explanation: bool = False,
    include_prompt: bool = False,
    include_response: bool = False,
    include_exceptions: bool = False,
    max_retries: int = 10,
    exit_on_error: bool = True,
    run_sync: bool = False,
    concurrency: Optional[int] = None,
    progress_bar_format: Optional[str] = get_tqdm_progress_bar_formatter("llm_classify"),
) -> pd.DataFrame:
    """
    Classifies each input row of the dataframe using an LLM.
    Returns a pandas.DataFrame where the first column is named `label` and contains
    the classification labels. An optional column named `explanation` is added when
    `provide_explanation=True`.

    Args:
        data (Union[pd.DataFrame, List[Any]): A collection of data which
            can contain template variables and other information necessary to generate evaluations.
            If a passed a DataFrame, there must be column names that match the template variables.
            If passed a list, the elements of the list will be mapped to the template variables
            in the order that the template variables are defined.

        model (BaseEvalModel): An LLM model class.

        template (Union[ClassificationTemplate, PromptTemplate, str]): The prompt template
            as either an instance of PromptTemplate, ClassificationTemplate or a string.
            If a string, the variable names should be surrounded by curly braces so that
            a call to `.format` can be made to substitute variable values.

        rails (List[str]): A list of strings representing the possible output classes
            of the model's predictions.

        data_processor (Optional[Callable[[T], T]]): An optional callable that is used to process
            the input data before it is mapped to the template variables. This callable is passed
            a single element of the input data and can return either a pandas.Series with indices
            corresponding to the template variables or an iterable of values that will be mapped
            to the template variables in the order that the template variables are defined.

        system_instruction (Optional[str], optional): An optional system message.

        verbose (bool, optional): If True, prints detailed info to stdout such as
            model invocation parameters and details about retries and snapping to rails.
            Default False.

        use_function_calling_if_available (bool, default=True): If True, use function
            calling (if available) as a means to constrain the LLM outputs.
            With function calling, the LLM is instructed to provide its response as a
            structured JSON object, which is easier to parse.

        provide_explanation (bool, default=False): If True, provides an explanation
            for each classification label. A column named `explanation` is added to
            the output dataframe.

        include_prompt (bool, default=False): If True, includes a column named `prompt`
            in the output dataframe containing the prompt used for each classification.

        include_response (bool, default=False): If True, includes a column named `response`
            in the output dataframe containing the raw response from the LLM.

        max_retries (int, optional): The maximum number of times to retry on exceptions.
            Defaults to 10.

        exit_on_error (bool, default=True): If True, stops processing evals after all retries
            are exhausted on a single eval attempt. If False, all evals are attempted before
            returning, even if some fail.

        run_sync (bool, default=False): If True, forces synchronous request submission.
            Otherwise evaluations will be run asynchronously if possible.

        concurrency (Optional[int], default=None): The number of concurrent evals if async
            submission is possible. If not provided, a recommended default concurrency is
            set on a per-model basis.

        progress_bar_format(Optional[str]): An optional format for progress bar shown. If not
            specified, defaults to: llm_classify |{bar}| {n_fmt}/{total_fmt} ({percentage:3.1f}%) "
            "| ⏳ {elapsed}<{remaining} | {rate_fmt}{postfix}". If 'None' is passed in specifically,
            the progress_bar log will be disabled.

    Returns:
        pandas.DataFrame: A dataframe where the `label` column (at column position 0) contains
            the classification labels. If provide_explanation=True, then an additional column named
            `explanation` is added to contain the explanation for each label. The dataframe has
            the same length and index as the input dataframe. The classification label values are
            from the entries in the rails argument or "NOT_PARSABLE" if the model's output could
            not be parsed. The output dataframe also includes three additional columns in the
            output dataframe: `exceptions`, `execution_status`, and `execution_seconds` containing
            details about execution errors that may have occurred during the classification as well
            as the total runtime of each classification (in seconds).
    """
    concurrency = concurrency or model.default_concurrency
    # clients need to be reloaded to ensure that async evals work properly
    model.reload_client()

    use_openai_function_call = (
        use_function_calling_if_available
        and isinstance(model, OpenAIModel)
        and model.supports_function_calling
    )

    model_kwargs = (
        openai_function_call_kwargs(rails, provide_explanation) if use_openai_function_call else {}
    )

    eval_template = normalize_classification_template(rails=rails, template=template)

    prompt_options = PromptOptions(provide_explanation=provide_explanation)

    labels: Iterable[Optional[str]] = [None] * len(data)
    explanations: Iterable[Optional[str]] = [None] * len(data)

    printif(verbose, f"Using prompt:\n\n{eval_template.prompt(prompt_options)}")
    if generation_info := model.verbose_generation_info():
        printif(verbose, generation_info)

    def _map_template(data: pd.Series[Any]) -> MultimodalPrompt:
        try:
            variables = {var: data[var] for var in eval_template.variables}
            empty_keys = [k for k, v in variables.items() if v is None]
            if empty_keys:
                raise PhoenixTemplateMappingError(
                    f"Missing template variables: {', '.join(empty_keys)}"
                )
            return eval_template.format(
                variable_values=variables,
                options=prompt_options,
            )
        except KeyError as exc:
            raise PhoenixTemplateMappingError(f"Missing template variable: {exc}")

    def _process_response(response: str) -> Tuple[str, Optional[str]]:
        if not use_openai_function_call:
            if provide_explanation:
                unrailed_label, explanation = (
                    eval_template.extract_label_from_explanation(response),
                    response,
                )
                printif(
                    verbose and unrailed_label == NOT_PARSABLE,
                    f"- Could not parse {repr(response)} while extracting label and explanation",
                )
            else:
                unrailed_label = response
                explanation = None
        else:
            unrailed_label, explanation = parse_openai_function_call(response)
        return snap_to_rail(unrailed_label, rails, verbose=verbose), explanation

    def _normalize_to_series(
        data: PROCESSOR_TYPE,
    ) -> pd.Series[Any]:
        if isinstance(data, pd.Series):
            return data

        variable_count = len(eval_template.variables)
        if variable_count == 1:
            return pd.Series({eval_template.variables[0]: data})
        elif variable_count > 1:
            if isinstance(data, str):
                raise ValueError("The data cannot be mapped to the template variables")
            elif isinstance(data, Iterable):
                return pd.Series(
                    {
                        template_var: input_val
                        for template_var, input_val in zip(eval_template.variables, data)
                    }
                )
        return pd.Series()

    async def _run_llm_classification_async(
        input_data: PROCESSOR_TYPE,
    ) -> ParsedLLMResponse:
        with set_verbosity(model, verbose) as verbose_model:
            if data_processor:
                maybe_awaitable_data = data_processor(input_data)
                if inspect.isawaitable(maybe_awaitable_data):
                    processed_data = await maybe_awaitable_data
                else:
                    processed_data = maybe_awaitable_data
            else:
                processed_data = input_data

            prompt = _map_template(_normalize_to_series(processed_data))
            response = await verbose_model._async_generate(
                prompt, instruction=system_instruction, **model_kwargs
            )
        inference, explanation = _process_response(response)
        return inference, explanation, response, str(prompt)

    def _run_llm_classification_sync(
        input_data: PROCESSOR_TYPE,
    ) -> ParsedLLMResponse:
        with set_verbosity(model, verbose) as verbose_model:
            if data_processor:
                processed_data = data_processor(input_data)
                if inspect.isawaitable(processed_data):
                    raise ValueError("Cannot run the data processor asynchronously.")
            else:
                processed_data = input_data

            prompt = _map_template(_normalize_to_series(processed_data))
            response = verbose_model._generate(
                prompt, instruction=system_instruction, **model_kwargs
            )
        inference, explanation = _process_response(response)
        return inference, explanation, response, str(prompt)

    fallback_return_value: ParsedLLMResponse = (None, None, "", "")

    executor = get_executor_on_sync_context(
        _run_llm_classification_sync,
        _run_llm_classification_async,
        run_sync=run_sync,
        concurrency=concurrency,
        tqdm_bar_format=progress_bar_format,
        max_retries=max_retries,
        exit_on_error=exit_on_error,
        fallback_return_value=fallback_return_value,
        timeout=model._timeout,
    )

    list_of_inputs: Union[Tuple[Any], List[Any]]
    if isinstance(data, pd.DataFrame):
        list_of_inputs = [row_tuple[1] for row_tuple in data.iterrows()]
        dataframe_index = data.index
    elif isinstance(data, (list, tuple)):
        list_of_inputs = data
        dataframe_index = pd.Index(range(len(data)))
    else:
        raise ValueError("Invalid 'data' input type.")

    results, execution_details = executor.run(list_of_inputs)
    labels, explanations, responses, prompts = zip(*results)
    all_exceptions = [details.exceptions for details in execution_details]
    execution_statuses = [details.status for details in execution_details]
    execution_times = [details.execution_seconds for details in execution_details]
    classification_statuses = []
    for exceptions, status in zip(all_exceptions, execution_statuses):
        if exceptions and isinstance(exceptions[-1], PhoenixTemplateMappingError):
            classification_statuses.append(ClassificationStatus.MISSING_INPUT)
        else:
            classification_statuses.append(ClassificationStatus(status.value))

    return pd.DataFrame(
        data={
            "label": labels,
            **({"explanation": explanations} if provide_explanation else {}),
            **({"prompt": prompts} if include_prompt else {}),
            **({"response": responses} if include_response else {}),
            **({"exceptions": [[repr(exc) for exc in excs] for excs in all_exceptions]}),
            **({"execution_status": [status.value for status in classification_statuses]}),
            **({"execution_seconds": [runtime for runtime in execution_times]}),
        },
        index=dataframe_index,
    )


class RunEvalsPayload(NamedTuple):
    evaluator: LLMEvaluator
    record: Record


def run_evals(
    dataframe: DataFrame,
    evaluators: List[LLMEvaluator],
    provide_explanation: bool = False,
    use_function_calling_if_available: bool = True,
    verbose: bool = False,
    concurrency: Optional[int] = None,
) -> List[DataFrame]:
    """
    Applies a list of evaluators to a dataframe. Outputs a list of dataframes in
    which each dataframe contains the outputs of the corresponding evaluator
    applied to the input dataframe.

    Args:
        dataframe (DataFrame): A pandas dataframe in which each row represents a
            record to be evaluated. All template variable names must appear as
            column names in the dataframe (extra columns unrelated to the template
            are permitted).

        evaluators (List[LLMEvaluator]): A list of evaluators.

        provide_explanation (bool, optional): If True, provides an explanation
            for each evaluation. A column named "explanation" is added to each
            output dataframe.

        use_function_calling_if_available (bool, optional): If True, use
            function calling (if available) as a means to constrain the LLM outputs.
            With function calling, the LLM is instructed to provide its response as
            a structured JSON object, which is easier to parse.

        verbose (bool, optional): If True, prints detailed info to stdout such
            as model invocation parameters and details about retries and snapping to
            rails.

        concurrency (Optional[int], default=None): The number of concurrent evals
            if async submission is possible. If not provided, a recommended default
            concurrency is set on a per-model basis.

    Returns:
        List[DataFrame]: A list of dataframes, one for each evaluator, all of
            which have the same number of rows as the input dataframe.
    """
    # use the minimum default concurrency of all the models
    if concurrency is None:
        if len(evaluators) == 0:
            concurrency = 1
        else:
            concurrency = min(evaluator.default_concurrency for evaluator in evaluators)

    # use the maximum timeout of all the evaluators
    timeout = max(
        (
            evaluator._model._timeout
            for evaluator in evaluators
            if evaluator._model._timeout is not None
        ),
        default=None,
    )

    # clients need to be reloaded to ensure that async evals work properly
    for evaluator in evaluators:
        evaluator.reload_client()

    async def _arun_eval(
        payload: RunEvalsPayload,
    ) -> Tuple[Label, Score, Explanation]:
        return await payload.evaluator.aevaluate(
            payload.record,
            provide_explanation=provide_explanation,
            use_function_calling_if_available=use_function_calling_if_available,
            verbose=verbose,
        )

    def _run_eval(
        payload: RunEvalsPayload,
    ) -> Tuple[Label, Score, Explanation]:
        return payload.evaluator.evaluate(
            payload.record,
            provide_explanation=provide_explanation,
            use_function_calling_if_available=use_function_calling_if_available,
            verbose=verbose,
        )

    executor = get_executor_on_sync_context(
        _run_eval,
        _arun_eval,
        concurrency=concurrency,
        tqdm_bar_format=get_tqdm_progress_bar_formatter("run_evals"),
        exit_on_error=True,
        fallback_return_value=(None, None, None),
        timeout=timeout,
    )

    total_records = len(dataframe)
    payloads = [
        RunEvalsPayload(evaluator=evaluator, record=row)
        for evaluator, (_, row) in product(evaluators, dataframe.iterrows())
    ]
    eval_results: List[DefaultDict[Index, Dict[ColumnName, Union[Label, Explanation]]]] = [
        defaultdict(dict) for _ in range(len(evaluators))
    ]
    results, _ = executor.run(payloads)
    for index, (label, score, explanation) in enumerate(results):
        evaluator_index = index // total_records
        row_index = index % total_records
        eval_results[evaluator_index][row_index]["label"] = label
        eval_results[evaluator_index][row_index]["score"] = score
        if provide_explanation:
            eval_results[evaluator_index][row_index]["explanation"] = explanation
    eval_dataframes: List[DataFrame] = []
    for eval_result in eval_results:
        eval_data = [eval_result[row_index] for row_index in range(len(eval_result))]
        eval_dataframes.append(DataFrame(eval_data, index=dataframe.index))
    return eval_dataframes
