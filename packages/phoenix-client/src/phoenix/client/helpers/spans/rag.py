# pyright: reportUnknownLambdaType=false, reportUnknownArgumentType=false, reportUnknownMemberType=false
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from openinference.semconv.trace import DocumentAttributes, SpanAttributes
from typing_extensions import deprecated

from phoenix.client.types.spans import SpanQuery
from phoenix.client.utils.config import get_env_project_name

if TYPE_CHECKING:
    import pandas as pd

    from phoenix.client import AsyncClient, Client


DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
DOCUMENT_METADATA = DocumentAttributes.DOCUMENT_METADATA
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
METADATA = SpanAttributes.METADATA
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

INPUT = {INPUT_VALUE: "input"}
OUTPUT = {OUTPUT_VALUE: "output"}
IO = {INPUT_VALUE: "input", OUTPUT_VALUE: "output"}

IS_ROOT = "parent_id is None"
IS_RETRIEVER = "span_kind == 'RETRIEVER'"

DEFAULT_TIMEOUT_IN_SECONDS = 5


def _concat_contexts(contexts: "pd.Series[str]", separator: str = "\n\n") -> str:
    """Concatenate context strings with a separator."""
    return separator.join(str(v) for v in contexts.dropna())


def _build_retrieved_documents_query() -> SpanQuery:
    return (
        SpanQuery()
        .where(IS_RETRIEVER)
        .select("trace_id", INPUT_VALUE)
        .rename(**INPUT)
        .explode(
            RETRIEVAL_DOCUMENTS,
            document=DOCUMENT_CONTENT,
            document_score=DOCUMENT_SCORE,
            document_metadata=DOCUMENT_METADATA,
        )
    )


def _build_root_qa_query() -> SpanQuery:
    query = SpanQuery().select("span_id", "trace_id", INPUT_VALUE, OUTPUT_VALUE, METADATA)
    return query.rename(**IO).where(IS_ROOT).with_index("trace_id")


def _build_retriever_docs_concat_query() -> SpanQuery:
    return (
        SpanQuery()
        .where(IS_RETRIEVER)
        .concat(RETRIEVAL_DOCUMENTS, context=DOCUMENT_CONTENT)
        .with_index("trace_id")
    )


def get_retrieved_documents(
    client: "Client",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> "pd.DataFrame":
    """Extracts retrieved documents from retriever spans for RAG evaluation.

    Constructs a DataFrame formatted for RAG retrieval evaluation with phoenix.evals.
    Each row represents a single retrieved document with its associated metadata.

    Args:
        client: Phoenix Client instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.

    Returns:
        pd.DataFrame: Retrieved documents with multi-index (context.span_id, document_position)
            and columns:
            - context.trace_id: Trace ID
            - input: Input value from the retriever span
            - document: Document content
            - document_score: Document relevance score
            - document_metadata: Document metadata

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import get_retrieved_documents

            client = Client()
            docs_df = get_retrieved_documents(client, project_name="my-rag-app")

        With time filtering::

            from datetime import datetime, timedelta

            docs_df = get_retrieved_documents(
                client,
                project_name="my-rag-app",
                start_time=datetime.now() - timedelta(days=1)
            )
    """
    project = project_identifier or project_name or get_env_project_name()
    return client.spans.get_spans_dataframe(
        query=_build_retrieved_documents_query(),
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )


def get_input_output_context(
    client: "Client",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> Optional["pd.DataFrame"]:
    """Extracts Q&A data with context for RAG evaluation.

    Constructs a DataFrame that combines root span input/output pairs with their associated
    retrieved documents as context. This is formatted for RAG Q&A and
    hallucination evaluation with phoenix.evals.

    Args:
        client: Phoenix Client instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.

    Returns:
        Optional[pd.DataFrame]: Q&A data with index context.span_id and columns:
            - context.trace_id: Trace ID
            - input: Question/query from the root span
            - output: Answer/response from the root span
            - context: Concatenated retrieved document content
            - metadata: Metadata from the root span
        Returns None if no spans or retrieval documents are found.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import get_input_output_context

            client = Client()
            qa_df = get_input_output_context(client, project_name="my-rag-app")

        With phoenix.evals::

            from phoenix.evals import HallucinationEvaluator, QAEvaluator, run_evals

            qa_df = get_input_output_context(client, project_name="my-rag-app")
            if qa_df is not None:
                qa_correctness, hallucination = run_evals(
                    evaluators=[QAEvaluator(eval_model), HallucinationEvaluator(eval_model)],
                    dataframe=qa_df,
                )
    """
    import pandas as pd

    project = project_identifier or project_name or get_env_project_name()
    separator = "\n\n"
    qa_query = _build_root_qa_query()
    docs_query = _build_retriever_docs_concat_query()  # separator is "\n\n" by default

    df_qa = client.spans.get_spans_dataframe(
        query=qa_query,
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )
    df_docs = client.spans.get_spans_dataframe(
        query=docs_query,
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )

    if df_qa is None or df_qa.empty:
        print("No spans found.")
        return None
    if df_docs is None or df_docs.empty:
        print("No retrieval documents found.")
        return None

    # Group by trace_id (index level 0) and concatenate contexts
    ref: pd.Series[str] = df_docs.groupby(level=0)["context"].apply(  # pyright: ignore[reportCallIssue]
        lambda x: _concat_contexts(x, separator)  # pyright: ignore[reportArgumentType]
    )
    df_ref = pd.DataFrame({"context": ref})
    df_qa_ref = pd.concat([df_qa, df_ref], axis=1, join="inner")
    # Reset index to preserve trace_id as a column, then set span_id as the index
    df_qa_ref = df_qa_ref.reset_index().set_index("context.span_id")
    return df_qa_ref


@deprecated(
    "get_qa_with_reference is deprecated and will be removed in a future release. "
    "Use get_input_output_context instead.",
    stacklevel=2,
)
def get_qa_with_reference(
    client: "Client",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> Optional["pd.DataFrame"]:
    """DEPRECATED: Use get_input_output_context instead.

    Extracts Q&A data with context for RAG evaluation.

    Constructs a DataFrame that combines root span input/output pairs with their associated
    retrieved documents as context. This is formatted for RAG Q&A and
    hallucination evaluation with phoenix.evals.

    Deprecated:
        This function is deprecated and will be removed in a future release.
        Use get_input_output_context instead.

    Args:
        client: Phoenix Client instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.

    Returns:
        Optional[pd.DataFrame]: Q&A data with index context.span_id and columns:
            - context.trace_id: Trace ID
            - input: Question/query from the root span
            - output: Answer/response from the root span
            - context: Concatenated retrieved document content
            - metadata: Metadata from the root span
        Returns None if no spans or retrieval documents are found.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.spans import get_input_output_context

            client = Client()
            qa_df = get_input_output_context(client, project_name="my-rag-app")

        With phoenix.evals::

            from phoenix.evals import HallucinationEvaluator, QAEvaluator, run_evals

            qa_df = get_input_output_context(client, project_name="my-rag-app")
            if qa_df is not None:
                qa_correctness, hallucination = run_evals(
                    evaluators=[QAEvaluator(eval_model), HallucinationEvaluator(eval_model)],
                    dataframe=qa_df,
                )
    """
    return get_input_output_context(
        client,
        start_time=start_time,
        end_time=end_time,
        project_name=project_name,
        project_identifier=project_identifier,
        timeout=timeout,
    )


async def async_get_retrieved_documents(
    client: "AsyncClient",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> "pd.DataFrame":
    """Async version of get_retrieved_documents.

    Extracts retrieved documents from retriever spans for RAG evaluation.

    Args:
        client: Phoenix AsyncClient instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.

    Returns:
        pd.DataFrame: Retrieved documents with multi-index (context.span_id, document_position)
            and columns:
            - context.trace_id: Trace ID
            - input: Input value from the retriever span
            - document: Document content
            - document_score: Document relevance score
            - document_metadata: Document metadata
    Examples:
        Basic usage::

            from phoenix.client import AsyncClient
            from phoenix.client.helpers.spans import async_get_retrieved_documents

            client = AsyncClient()
            docs_df = await async_get_retrieved_documents(client, project_name="my-rag-app")
    """
    project = project_identifier or project_name or get_env_project_name()
    return await client.spans.get_spans_dataframe(
        query=_build_retrieved_documents_query(),
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )


async def async_get_input_output_context(
    client: "AsyncClient",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> Optional["pd.DataFrame"]:
    """Async version of get_input_output_context.

    Extracts input/output data with context for RAG evaluation.

    Args:
        client: Phoenix AsyncClient instance.
        start_time: Optional start time for filtering spans (inclusive lower bound).
        end_time: Optional end time for filtering spans (exclusive upper bound).
        project_name: Project name (alias for project_identifier). If not provided,
            uses the environment variable PHOENIX_PROJECT_NAME.
        project_identifier: Project identifier (name or ID). Takes precedence over
            project_name if both are provided.
        timeout: Request timeout in seconds. Defaults to 5.

    Returns:
        Optional[pd.DataFrame]: Q&A data with index context.span_id and columns:
            - context.trace_id: Trace ID
            - input: Question/query from the root span
            - output: Answer/response from the root span
            - context: Concatenated retrieved document content
            - metadata: Metadata from the root span
        Returns None if no spans or retrieval documents are found.

    Examples:
        Basic usage::

            from phoenix.client import AsyncClient
            from phoenix.client.helpers.spans import async_get_input_output_context

            client = AsyncClient()
            qa_df = await async_get_input_output_context(client, project_name="my-rag-app")
    """
    import pandas as pd

    project = project_identifier or project_name or get_env_project_name()
    separator = "\n\n"
    qa_query = _build_root_qa_query()
    docs_query = _build_retriever_docs_concat_query()  # separator is "\n\n" by default

    df_qa = await client.spans.get_spans_dataframe(
        query=qa_query,
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )
    df_docs = await client.spans.get_spans_dataframe(
        query=docs_query,
        start_time=start_time,
        end_time=end_time,
        project_name=project,
        timeout=timeout,
    )

    if df_qa is None or df_qa.empty:
        print("No spans found.")
        return None
    if df_docs is None or df_docs.empty:
        print("No retrieval documents found.")
        return None

    # Group by trace_id (index level 0) and concatenate contexts
    ref: pd.Series[str] = df_docs.groupby(level=0)["context"].apply(  # pyright: ignore[reportCallIssue]
        lambda x: _concat_contexts(x, separator)  # pyright: ignore[reportArgumentType]
    )
    df_ref = pd.DataFrame({"context": ref})
    df_qa_ref = pd.concat([df_qa, df_ref], axis=1, join="inner")
    # Reset index to preserve trace_id as a column, then set span_id as the index
    df_qa_ref = df_qa_ref.reset_index().set_index("context.span_id")
    return df_qa_ref
