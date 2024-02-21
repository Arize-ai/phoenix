from __future__ import annotations

import logging
import warnings
from collections import defaultdict
from itertools import product
from typing import (
    Any,
    DefaultDict,
    Dict,
    Iterable,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from pandas import DataFrame
from typing_extensions import TypeAlias

from phoenix.experimental.evals.evaluators import LLMEvaluator
from phoenix.experimental.evals.functions.executor import get_executor_on_sync_context
from phoenix.experimental.evals.models import BaseEvalModel, OpenAIModel, set_verbosity
from phoenix.experimental.evals.templates import (
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE,
    ClassificationTemplate,
    PromptOptions,
    PromptTemplate,
    map_template,
    normalize_classification_template,
)
from phoenix.experimental.evals.utils import (
    NOT_PARSABLE,
    get_tqdm_progress_bar_formatter,
    openai_function_call_kwargs,
    parse_openai_function_call,
    snap_to_rail,
)
from phoenix.utilities.logging import printif

DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
INPUT_VALUE = SpanAttributes.INPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

logger = logging.getLogger(__name__)


OPENINFERENCE_QUERY_COLUMN_NAME = "attributes." + INPUT_VALUE
OPENINFERENCE_DOCUMENT_COLUMN_NAME = "attributes." + RETRIEVAL_DOCUMENTS

ColumnName: TypeAlias = str
Label: TypeAlias = str
Score: TypeAlias = Optional[float]
Explanation: TypeAlias = Optional[str]
Record: TypeAlias = Mapping[str, Any]
Index: TypeAlias = int

# snapped_response, explanation, response
ParsedLLMResponse: TypeAlias = Tuple[Optional[str], Optional[str], str]


def llm_classify(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[ClassificationTemplate, PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    use_function_calling_if_available: bool = True,
    provide_explanation: bool = False,
    include_prompt: bool = False,
    include_response: bool = False,
    run_sync: bool = False,
    concurrency: Optional[int] = None,
) -> pd.DataFrame:
    """Classifies each input row of the dataframe using an LLM. Returns a pandas.DataFrame
    where the first column is named `label` and contains the classification labels. An optional
    column named `explanation` is added when `provide_explanation=True`.

    Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row represents a record to be
        classified. All template variable names must appear as column names in the dataframe (extra
        columns unrelated to the template are permitted).

        template (Union[ClassificationTemplate, PromptTemplate, str]): The prompt template as
        either an instance of PromptTemplate, ClassificationTemplate or a string. If a string, the
        variable names should be surrounded by curly braces so that a call to `.format` can be made
        to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        rails (List[str]): A list of strings representing the possible output classes of the model's
        predictions.

        system_instruction (Optional[str], optional): An optional system message.

        verbose (bool, optional): If True, prints detailed info to stdout such as model invocation
        parameters and details about retries and snapping to rails. Default False.

        use_function_calling_if_available (bool, default=True): If True, use function calling
        (if available) as a means to constrain the LLM outputs. With function calling, the LLM
        is instructed to provide its response as a structured JSON object, which is easier
        to parse.

        provide_explanation (bool, default=False): If True, provides an explanation for each
        classification label. A column named `explanation` is added to the output dataframe.

        include_prompt (bool, default=False): If True, includes a column named `prompt` in the
        output dataframe containing the prompt used for each classification.

        include_response (bool, default=False): If True, includes a column named `response` in the
        output dataframe containing the raw response from the LLM.

        run_sync (bool, default=False): If True, forces synchronous request submission. Otherwise
        evaluations will be run asynchronously if possible.

        concurrency (Optional[int], default=None): The number of concurrent evals if async
        submission is possible. If not provided, a recommended default concurrency is set on a
        per-model basis.

    Returns:
        pandas.DataFrame: A dataframe where the `label` column (at column position 0) contains
        the classification labels. If provide_explanation=True, then an additional column named
        `explanation` is added to contain the explanation for each label. The dataframe has
        the same length and index as the input dataframe. The classification label values are
        from the entries in the rails argument or "NOT_PARSABLE" if the model's output could
        not be parsed.
    """
    concurrency = concurrency or model.default_concurrency
    # clients need to be reloaded to ensure that async evals work properly
    model.reload_client()

    tqdm_bar_format = get_tqdm_progress_bar_formatter("llm_classify")
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
    prompts = map_template(dataframe, eval_template, options=prompt_options)

    labels: List[Optional[str]] = [None] * len(dataframe)
    explanations: List[Optional[str]] = [None] * len(dataframe)

    printif(verbose, f"Using prompt:\n\n{eval_template.prompt(prompt_options)}")
    if generation_info := model.verbose_generation_info():
        printif(verbose, generation_info)

    def _process_response(response: str) -> Tuple[str, Optional[str]]:
        if not use_openai_function_call:
            if provide_explanation:
                unrailed_label, explanation = (
                    eval_template.extract_label_from_explanation(response),
                    response,
                )
                printif(
                    verbose and unrailed_label == NOT_PARSABLE,
                    f"- Could not parse {repr(response)}",
                )
            else:
                unrailed_label = response
                explanation = None
        else:
            unrailed_label, explanation = parse_openai_function_call(response)
        return snap_to_rail(unrailed_label, rails, verbose=verbose), explanation

    async def _run_llm_classification_async(prompt: str) -> ParsedLLMResponse:
        with set_verbosity(model, verbose) as verbose_model:
            response = await verbose_model._async_generate(
                prompt, instruction=system_instruction, **model_kwargs
            )
        inference, explanation = _process_response(response)
        return inference, explanation, response

    def _run_llm_classification_sync(prompt: str) -> ParsedLLMResponse:
        with set_verbosity(model, verbose) as verbose_model:
            response = verbose_model._generate(
                prompt, instruction=system_instruction, **model_kwargs
            )
        inference, explanation = _process_response(response)
        return inference, explanation, response

    fallback_return_value: ParsedLLMResponse = (None, None, "")

    executor = get_executor_on_sync_context(
        _run_llm_classification_sync,
        _run_llm_classification_async,
        run_sync=run_sync,
        concurrency=concurrency,
        tqdm_bar_format=tqdm_bar_format,
        exit_on_error=True,
        fallback_return_value=fallback_return_value,
    )

    results = executor.run(prompts.tolist())
    labels, explanations, responses = zip(*results)

    return pd.DataFrame(
        data={
            "label": labels,
            **({"explanation": explanations} if provide_explanation else {}),
            **({"prompt": prompts} if include_prompt else {}),
            **({"response": responses} if include_response else {}),
        },
        index=dataframe.index,
    )


def run_relevance_eval(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[ClassificationTemplate, str] = RAG_RELEVANCY_PROMPT_TEMPLATE,
    rails: List[str] = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    system_instruction: Optional[str] = None,
    query_column_name: str = "input",
    document_column_name: str = "reference",
    verbose: bool = False,
) -> List[List[str]]:
    """
    Given a pandas dataframe containing queries and retrieved documents, classifies the relevance of
    each retrieved document to the corresponding query using an LLM.

    Args:
        dataframe (pd.DataFrame): A pandas dataframe containing queries and retrieved documents. If
        both query_column_name and reference_column_name are present in the input dataframe, those
        columns are used as inputs and should appear in the following format:

        - The entries of the query column must be strings.
        - The entries of the documents column must be lists of strings. Each list may contain an
          arbitrary number of document texts retrieved for the corresponding query.

        If the input dataframe is lacking either query_column_name or reference_column_name but has
        query and retrieved document columns in OpenInference trace format named
        "attributes.input.value" and "attributes.retrieval.documents", respectively, then those
        columns are used as inputs and should appear in the following format:

        - The entries of the query column must be strings.
        - The entries of the document column must be lists of OpenInference document objects, each
          object being a dictionary that stores the document text under the key "document.content".

        This latter format is intended for running evaluations on exported OpenInference trace
        dataframes. For more information on the OpenInference tracing specification, see
        https://github.com/Arize-ai/openinference/.

        model (BaseEvalModel): The model used for evaluation.

        template (Union[PromptTemplate, str], optional): The template used for evaluation.

        rails (List[str], optional): A list of strings representing the possible output classes of
        the model's predictions.

        query_column_name (str, optional): The name of the query column in the dataframe, which
        should also be a template variable.

        reference_column_name (str, optional): The name of the document column in the dataframe,
        which should also be a template variable.

        system_instruction (Optional[str], optional): An optional system message.

        verbose (bool, optional): If True, prints detailed information to stdout such as model
        invocation parameters and retry info. Default False.

    Returns:
        List[List[str]]: A list of relevant and not relevant classifications. The "shape" of the
        list should mirror the "shape" of the retrieved documents column, in the sense that it has
        the same length as the input dataframe and each sub-list has the same length as the
        corresponding list in the retrieved documents column. The values in the sub-lists are either
        entries from the rails argument or "NOT_PARSABLE" in the case where the LLM output could not
        be parsed.
    """

    warnings.warn(
        "run_relevance_eval will soon be deprecated. "
        "Use run_evals with HallucinationEvaluator instead.",
        DeprecationWarning,
    )

    with set_verbosity(model, verbose) as verbose_model:
        query_column = dataframe.get(query_column_name)
        document_column = dataframe.get(document_column_name)
        if query_column is None or document_column is None:
            openinference_query_column = dataframe.get(OPENINFERENCE_QUERY_COLUMN_NAME)
            openinference_document_column = dataframe.get(OPENINFERENCE_DOCUMENT_COLUMN_NAME)
            if openinference_query_column is None or openinference_document_column is None:
                raise ValueError(
                    f'Dataframe columns must include either "{query_column_name}" and '
                    f'"{document_column_name}", or "{OPENINFERENCE_QUERY_COLUMN_NAME}" and '
                    f'"{OPENINFERENCE_DOCUMENT_COLUMN_NAME}".'
                )
            query_column = openinference_query_column
            document_column = openinference_document_column.map(
                lambda docs: _get_contents_from_openinference_documents(docs)
                if docs is not None
                else None
            )

        queries = cast("pd.Series[str]", query_column).tolist()
        document_lists = cast("pd.Series[str]", document_column).tolist()
        indexes = []
        expanded_queries = []
        expanded_documents = []
        for index, (query, documents) in enumerate(zip(queries, document_lists)):
            if query is None or documents is None:
                continue
            for document in documents:
                indexes.append(index)
                expanded_queries.append(query)
                expanded_documents.append(document)
        predictions = llm_classify(
            dataframe=pd.DataFrame(
                {
                    query_column_name: expanded_queries,
                    document_column_name: expanded_documents,
                }
            ),
            model=verbose_model,
            template=template,
            rails=rails,
            system_instruction=system_instruction,
            verbose=verbose,
        ).iloc[:, 0]
        outputs: List[List[str]] = [[] for _ in range(len(dataframe))]
        for index, prediction in zip(indexes, predictions):
            outputs[index].append(prediction)
        return outputs


def _get_contents_from_openinference_documents(documents: Iterable[Any]) -> List[Optional[str]]:
    """
    Get document contents from an iterable of OpenInference document objects, which are dictionaries
    containing the document text under the "document.content" key.
    """
    return [doc.get(DOCUMENT_CONTENT) if isinstance(doc, dict) else None for doc in documents]


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

        concurrency (Optional[int], default=None): The number of concurrent evals if async
        submission is possible. If not provided, a recommended default concurrency is set on a
        per-model basis.

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
        )

    def _run_eval(
        payload: RunEvalsPayload,
    ) -> Tuple[Label, Score, Explanation]:
        return payload.evaluator.evaluate(
            payload.record,
            provide_explanation=provide_explanation,
            use_function_calling_if_available=use_function_calling_if_available,
        )

    executor = get_executor_on_sync_context(
        _run_eval,
        _arun_eval,
        concurrency=concurrency,
        tqdm_bar_format=get_tqdm_progress_bar_formatter("run_evals"),
        exit_on_error=True,
        fallback_return_value=(None, None, None),
    )

    total_records = len(dataframe)
    payloads = [
        RunEvalsPayload(evaluator=evaluator, record=row)
        for evaluator, (_, row) in product(evaluators, dataframe.iterrows())
    ]
    eval_results: List[DefaultDict[Index, Dict[ColumnName, Union[Label, Explanation]]]] = [
        defaultdict(dict) for _ in range(len(evaluators))
    ]
    for index, (label, score, explanation) in enumerate(executor.run(payloads)):
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
