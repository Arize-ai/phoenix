import json
import warnings
from datetime import datetime
from typing import Any, Iterable, Mapping, Optional, Protocol, Union, cast

import pandas as pd
from openinference.semconv.trace import DocumentAttributes, SpanAttributes

from phoenix.config import get_env_project_name
from phoenix.trace.dsl import SpanQuery

DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS
LLM_FUNCTION_CALL = SpanAttributes.LLM_FUNCTION_CALL
LLM_INPUT_MESSAGES = SpanAttributes.LLM_INPUT_MESSAGES
LLM_OUTPUT_MESSAGES = SpanAttributes.LLM_OUTPUT_MESSAGES


INPUT = {"input": INPUT_VALUE}
OUTPUT = {"output": OUTPUT_VALUE}
IO = {**INPUT, **OUTPUT}


IS_ROOT = "parent_id is None"
IS_LLM = "span_kind == 'LLM'"
IS_RETRIEVER = "span_kind == 'RETRIEVER'"

DEFAULT_TIMEOUT_IN_SECONDS = 5


class CanQuerySpans(Protocol):
    # Implemented by phoenix.session.client.Client
    def query_spans(
        self,
        *query: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        project_name: Optional[str] = None,
        timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    ) -> Optional[Union[pd.DataFrame, list[pd.DataFrame]]]: ...


def get_retrieved_documents(
    obj: CanQuerySpans,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    # Deprecated
    stop_time: Optional[datetime] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> pd.DataFrame:
    project_name = project_name or get_env_project_name()
    if stop_time is not None:
        # Deprecated. Raise a warning
        warnings.warn(
            "stop_time is deprecated. Use end_time instead.",
            DeprecationWarning,
        )
        end_time = end_time or stop_time
    return cast(
        pd.DataFrame,
        obj.query_spans(
            SpanQuery()
            .where(IS_RETRIEVER)
            .select("trace_id", **INPUT)
            .explode(
                RETRIEVAL_DOCUMENTS,
                reference=DOCUMENT_CONTENT,
                document_score=DOCUMENT_SCORE,
            ),
            start_time=start_time,
            end_time=end_time,
            project_name=project_name,
            timeout=timeout,
        ),
    )


def get_qa_with_reference(
    obj: CanQuerySpans,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    # Deprecated
    stop_time: Optional[datetime] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> Optional[pd.DataFrame]:
    project_name = project_name or get_env_project_name()
    if stop_time:
        # Deprecated. Raise a warning
        warnings.warn(
            "stop_time is deprecated. Use end_time instead.",
            DeprecationWarning,
        )
        end_time = end_time or stop_time
    separator = "\n\n"
    qa_query = SpanQuery().select("span_id", **IO).where(IS_ROOT).with_index("trace_id")
    docs_query = (
        SpanQuery()
        .where(IS_RETRIEVER)
        .concat(RETRIEVAL_DOCUMENTS, reference=DOCUMENT_CONTENT)
        .with_concat_separator(separator=separator)
        .with_index("trace_id")
    )
    df_qa, df_docs = cast(
        tuple[pd.DataFrame, pd.DataFrame],
        obj.query_spans(
            qa_query,
            docs_query,
            start_time=start_time,
            end_time=end_time,
            project_name=project_name,
            timeout=timeout,
        ),
    )
    if df_qa is None or df_qa.empty:
        print("No spans found.")
        return None
    if df_docs is None or df_docs.empty:
        print("No retrieval documents found.")
        return None
    # Consolidate duplicate rows via concatenation. This can happen if there are multiple
    # retriever spans in the same trace. We simply concatenate all of them (in no particular
    # order) into a single row.
    ref = df_docs.groupby("context.trace_id")["reference"].apply(
        lambda x: separator.join(x.dropna())
    )
    df_ref = pd.DataFrame({"reference": ref})
    df_qa_ref = pd.concat([df_qa, df_ref], axis=1, join="inner").set_index("context.span_id")
    return df_qa_ref


def get_called_tools(
    obj: CanQuerySpans,
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    function_name_only: bool = False,
) -> Optional[pd.DataFrame]:
    """Retrieve tool calls made by LLM spans within a specified time range.

    This function queries LLM spans and extracts tool calls from their output messages.
    It can return either just the function names or full function calls with arguments.

    Args:
        obj: An object that implements the CanQuerySpans protocol for querying spans.
        start_time: Optional start time to filter spans. If None, no start time filter is applied.
        end_time: Optional end time to filter spans. If None, no end time filter is applied.
        project_name: Optional project name to filter spans. If None, uses the environment project name.
        timeout: Optional timeout in seconds for the query. Defaults to DEFAULT_TIMEOUT_IN_SECONDS.
        function_name_only: If True, returns only function names. If False, returns full function calls
            with arguments. Defaults to False.

    Returns:
        A pandas DataFrame containing the tool calls, or None if no spans are found.
        The DataFrame includes columns for input messages, output messages, and tool calls.
    """  # noqa: E501
    project_name = project_name or get_env_project_name()

    def extract_tool_calls(outputs: list[dict[str, Any]]) -> Optional[list[str]]:
        if not isinstance(outputs, list) or not outputs:
            return None
        ans = []
        if isinstance(message := outputs[0].get("message"), Mapping) and isinstance(
            tool_calls := message.get("tool_calls"), Iterable
        ):
            for tool_call in tool_calls:
                if not isinstance(tool_call, Mapping):
                    continue
                if not isinstance(tc := tool_call.get("tool_call"), Mapping):
                    continue
                if not isinstance(function := tc.get("function"), Mapping):
                    continue
                if not isinstance(name := function.get("name"), str):
                    continue
                if function_name_only:
                    ans.append(name)
                    continue
                kwargs = {}
                if isinstance(arguments := function.get("arguments"), str):
                    try:
                        kwargs = json.loads(arguments)
                    except Exception:
                        pass
                kwargs_str = "" if not kwargs else ", ".join(f"{k}={v}" for k, v in kwargs.items())
                ans.append(f"{name}({kwargs_str})")
        return ans or None

    df_qa = cast(
        pd.DataFrame,
        obj.query_spans(
            SpanQuery()
            .where(IS_LLM)
            .select(
                input=LLM_INPUT_MESSAGES,
                output=LLM_OUTPUT_MESSAGES,
            ),
            start_time=start_time,
            end_time=end_time,
            project_name=project_name,
            timeout=timeout,
        ),
    )

    if df_qa is None:
        print("No spans found.")
        return None

    df_qa["tool_call"] = df_qa["output"].apply(extract_tool_calls)

    return df_qa
