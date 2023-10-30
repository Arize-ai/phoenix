import json
import logging
import warnings
from typing import Any, Dict, Iterable, List, Optional, Union, cast

import pandas as pd

from phoenix.experimental.evals.models import BaseEvalModel, OpenAIModel, set_verbosity
from phoenix.experimental.evals.templates import (
    NOT_PARSABLE,
    RAG_RELEVANCY_PROMPT_RAILS_MAP,
    RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    PromptTemplate,
    map_template,
    normalize_template,
)
from phoenix.trace.semantic_conventions import DOCUMENT_CONTENT, INPUT_VALUE, RETRIEVAL_DOCUMENTS
from phoenix.utilities.logging import printif

logger = logging.getLogger(__name__)


OPENINFERENCE_QUERY_COLUMN_NAME = "attributes." + INPUT_VALUE
OPENINFERENCE_DOCUMENT_COLUMN_NAME = "attributes." + RETRIEVAL_DOCUMENTS

# argument keys in the default openai function call,
# defined here only to prevent typos
_RESPONSE = "response"
_EXPLANATION = "explanation"


def llm_classify(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
    verbose: bool = False,
    use_function_calling_if_available: bool = True,
    provide_explanation: bool = False,
) -> pd.DataFrame:
    """Classifies each input row of the dataframe using an LLM. If provide_explanation=True,
    returning a named tuple in the form of `NamedTuple(label=..., explanation=...)`
    for each input row.

    Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row represents a record to be
        classified. All template variable names must appear as column names in the dataframe (extra
        columns unrelated to the template are permitted).

        template (Union[PromptTemplate, str]): The prompt template as either an instance of
        PromptTemplate or a string. If the latter, the variable names should be surrounded by
        curly braces so that a call to `.format` can be made to substitute variable values.

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

        provide_explanation (bool, default=False): If True, provides explanation for
        the classification result. Only available

    Returns:
        pandas.DataFrame: A dataframe where the `label` column contains the classification labels.
        If provide_explanation=True, then an additional column called `explanation` is added to
        contain the explanations for each prediction. The dataframe has the same length and index
        as the input dataframe. The prediction label values are from the entries in the rails
        argument or "NOT_PARSABLE" if the model's prediction could not be parsed.
    """
    use_openai_function_call = (
        use_function_calling_if_available
        and isinstance(model, OpenAIModel)
        and model.supports_function_calling
    )

    # TODO: support explanation without function calling
    if provide_explanation and not use_openai_function_call:
        raise ValueError(
            "explanation is not currently available for models without OpenAI function calling"
        )

    model_kwargs: Dict[str, Any] = {}
    if use_openai_function_call:
        openai_function = _default_openai_function(rails, provide_explanation)
        model_kwargs["functions"] = [openai_function]
        model_kwargs["function_call"] = {"name": openai_function["name"]}

    eval_template = normalize_template(template)
    prompts = map_template(dataframe, eval_template)
    with set_verbosity(model, verbose) as verbose_model:
        responses = verbose_model.generate(
            prompts.to_list(), instruction=system_instruction, **model_kwargs
        )

    labels: List[str] = []
    explanations: List[Optional[str]] = []

    printif(verbose, f"Snapping {len(responses)} responses to rails: {rails}")
    for response in responses:
        if not use_openai_function_call:
            raw_string = response
            if provide_explanation:
                # TODO: support explanation without function calling
                explanations.append(None)
        else:
            try:
                function_arguments = json.loads(response, strict=False)
                raw_string = function_arguments.get(_RESPONSE)
                if provide_explanation:
                    explanations.append(function_arguments.get(_EXPLANATION))
            except json.JSONDecodeError:
                raw_string = response
        labels.append(_snap_to_rail(raw_string, rails, verbose=verbose))

    data: Dict[str, List[Any]] = {"label": labels}
    if provide_explanation:
        assert len(labels) == len(explanations)
        data["explanation"] = explanations

    return pd.DataFrame(data=data, index=dataframe.index)


def llm_eval_binary(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str],
    rails: List[str],
    system_instruction: Optional[str] = None,
    verbose: bool = False,
) -> List[str]:
    """Performs a binary classification on the rows of the input dataframe using an LLM.

    Args:
        dataframe (pandas.DataFrame): A pandas dataframe in which each row represents a record to be
        classified. All template variable names must appear as column names in the dataframe (extra
        columns unrelated to the template are permitted).

        template (Union[PromptTemplate, str]): The prompt template as either an instance of
        PromptTemplate or a string. If the latter, the variable names should be surrounded by
        curly braces so that a call to `.format` can be made to substitute variable values.

        model (BaseEvalModel): An LLM model class.

        rails (List[str]): A list of strings representing the possible output classes of the model's
        predictions.

        system_instruction (Optional[str], optional): An optional system message.

        verbose (bool, optional): If True, prints detailed info to stdout such as model invocation
        parameters and details about retries and snapping to rails. Default False.

    Returns:
        List[str]: A list of strings representing the predicted class for each record in the
        dataframe. The list should have the same length as the input dataframe and its values should
        be the entries in the rails argument or "NOT_PARSABLE" if the model's prediction could not
        be parsed.
    """

    warnings.warn(
        "This function will soon be deprecated. "
        "Use llm_classify instead, which has the same function signature "
        "and provides support for multi-class classification "
        "in addition to binary classification.",
        category=DeprecationWarning,
        stacklevel=2,
    )
    return (
        llm_classify(
            dataframe=dataframe,
            model=model,
            template=template,
            rails=rails,
            system_instruction=system_instruction,
            verbose=verbose,
        )
        .iloc[:, 0]
        .tolist()
    )


def run_relevance_eval(
    dataframe: pd.DataFrame,
    model: BaseEvalModel,
    template: Union[PromptTemplate, str] = RAG_RELEVANCY_PROMPT_TEMPLATE_STR,
    rails: List[str] = list(RAG_RELEVANCY_PROMPT_RAILS_MAP.values()),
    system_instruction: Optional[str] = None,
    query_column_name: str = "query",
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
        https://github.com/Arize-ai/open-inference-spec/.

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


def _snap_to_rail(raw_string: Optional[str], rails: List[str], verbose: bool = False) -> str:
    """
    Snaps a string to the nearest rail, or returns None if the string cannot be
    snapped to a rail.

    Args:
        raw_string (str): An input to be snapped to a rail.

        rails (List[str]): The target set of strings to snap to.

    Returns:
        str: A string from the rails argument or "UNPARSABLE" if the input
        string could not be snapped.
    """
    if not raw_string:
        return NOT_PARSABLE
    snap_string = raw_string.lower()
    rails = list(set(rail.lower() for rail in rails))
    rails.sort(key=len, reverse=True)
    found_rails = set()
    for rail in rails:
        if rail in snap_string:
            found_rails.add(rail)
            snap_string = snap_string.replace(rail, "")
    if len(found_rails) != 1:
        printif(verbose, f"- Cannot snap {repr(raw_string)} to rails")
        return NOT_PARSABLE
    rail = list(found_rails)[0]
    printif(verbose, f"- Snapped {repr(raw_string)} to rail: {rail}")
    return rail


def _default_openai_function(
    rails: List[str],
    with_explanation: bool = False,
) -> Dict[str, Any]:
    properties = {
        _RESPONSE: {"type": "string", "description": "Your response.", "enum": rails},
        **(
            {
                _EXPLANATION: {
                    "type": "string",
                    "description": "Explanation of the reasoning for your response.",
                },
            }
            if with_explanation
            else {}
        ),
    }
    required = [_RESPONSE, *([_EXPLANATION] if with_explanation else [])]
    return {
        "name": "record_response",
        "description": "A function to record your response.",
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required,
        },
    }
