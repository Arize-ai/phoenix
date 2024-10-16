import warnings
from datetime import datetime
from typing import List, Optional, Protocol, Tuple, Union, cast

import pandas as pd
from openinference.semconv.trace import DocumentAttributes, SpanAttributes

from phoenix.config import get_env_project_name
from phoenix.trace.dsl import SpanQuery

DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

INPUT = {"input": INPUT_VALUE}
OUTPUT = {"output": OUTPUT_VALUE}
IO = {**INPUT, **OUTPUT}

IS_ROOT = "parent_id is None"
IS_LLM = "span_kind == 'LLM'"
IS_RETRIEVER = "span_kind == 'RETRIEVER'"


class CanQuerySpans(Protocol):
    # Implemented by phoenix.session.client.Client
    def query_spans(
        self,
        *query: SpanQuery,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        project_name: Optional[str] = None,
    ) -> Optional[Union[pd.DataFrame, List[pd.DataFrame]]]: ...


def get_retrieved_documents(
    obj: CanQuerySpans,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    # Deprecated
    stop_time: Optional[datetime] = None,
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
        ),
    )


def get_qa_with_reference(
    obj: CanQuerySpans,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    # Deprecated
    stop_time: Optional[datetime] = None,
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
        Tuple[pd.DataFrame, pd.DataFrame],
        obj.query_spans(
            qa_query,
            docs_query,
            start_time=start_time,
            end_time=end_time,
            project_name=project_name,
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
