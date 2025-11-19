from datetime import datetime
from typing import TYPE_CHECKING, Optional, cast

from openinference.semconv.trace import DocumentAttributes, SpanAttributes

from phoenix.client.types.spans import SpanQuery
from phoenix.config import get_env_project_name

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
            - reference: Document content
            - document_score: Document relevance score

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.evaluation import get_retrieved_documents

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
    import pandas as pd

    project = project_identifier or project_name or get_env_project_name()
    return cast(
        pd.DataFrame,
        client.spans.get_spans_dataframe(
            query=SpanQuery()
            .where(IS_RETRIEVER)
            .select("trace_id", INPUT_VALUE)
            .rename(**INPUT)
            .explode(
                RETRIEVAL_DOCUMENTS,
                reference=DOCUMENT_CONTENT,
                document_score=DOCUMENT_SCORE,
                document_metadata=DOCUMENT_METADATA,
            ),
            start_time=start_time,
            end_time=end_time,
            project_name=project,
            timeout=timeout,
        ),
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
    """Extracts Q&A data with reference context for RAG evaluation.

    Constructs a DataFrame that combines root span Q&A pairs with their associated
    retrieved documents as reference context. This is formatted for RAG Q&A and
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
            - input: Question/query from the root span
            - output: Answer/response from the root span
            - reference: Concatenated retrieved document content
        Returns None if no spans or retrieval documents are found.

    Examples:
        Basic usage::

            from phoenix.client import Client
            from phoenix.client.helpers.evaluation import get_qa_with_reference

            client = Client()
            qa_df = get_qa_with_reference(client, project_name="my-rag-app")

        With phoenix.evals::

            from phoenix.evals import HallucinationEvaluator, QAEvaluator, run_evals

            qa_df = get_qa_with_reference(client, project_name="my-rag-app")
            if qa_df is not None:
                qa_correctness, hallucination = run_evals(
                    evaluators=[QAEvaluator(eval_model), HallucinationEvaluator(eval_model)],
                    dataframe=qa_df,
                )
    """
    import pandas as pd

    project = project_identifier or project_name or get_env_project_name()
    separator = "\n\n"
    qa_query = (
        SpanQuery()
        .select("span_id", INPUT_VALUE, OUTPUT_VALUE, METADATA)
        .rename(**IO)
        .where(IS_ROOT)
        .with_index("trace_id")
    )
    docs_query = (
        SpanQuery()
        .where(IS_RETRIEVER)
        .concat(RETRIEVAL_DOCUMENTS, reference=DOCUMENT_CONTENT)
        .with_index("trace_id")
    )  # separator is "\n\n" by default

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

    ref = df_docs.groupby("context.trace_id")["reference"].apply(
        lambda x: separator.join(x.dropna())
    )
    df_ref = pd.DataFrame({"reference": ref})
    df_qa_ref = pd.concat([df_qa, df_ref], axis=1, join="inner").set_index("context.span_id")
    return df_qa_ref


async def get_retrieved_documents_async(
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
            - reference: Document content
            - document_score: Document relevance score

    Examples:
        Basic usage::

            from phoenix.client import AsyncClient
            from phoenix.client.helpers.evaluation import get_retrieved_documents_async

            client = AsyncClient()
            docs_df = await get_retrieved_documents_async(client, project_name="my-rag-app")
    """
    import pandas as pd

    project = project_identifier or project_name or get_env_project_name()
    return cast(
        pd.DataFrame,
        await client.spans.get_spans_dataframe(
            query=SpanQuery()
            .where(IS_RETRIEVER)
            .select("trace_id", INPUT_VALUE)
            .rename(**INPUT)
            .explode(
                RETRIEVAL_DOCUMENTS,
                reference=DOCUMENT_CONTENT,
                document_score=DOCUMENT_SCORE,
            ),
            start_time=start_time,
            end_time=end_time,
            project_name=project,
            timeout=timeout,
        ),
    )


async def get_qa_with_reference_async(
    client: "AsyncClient",
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    project_name: Optional[str] = None,
    project_identifier: Optional[str] = None,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> Optional["pd.DataFrame"]:
    """Async version of get_qa_with_reference.

    Extracts Q&A data with reference context for RAG evaluation.

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
            - input: Question/query from the root span
            - output: Answer/response from the root span
            - reference: Concatenated retrieved document content
        Returns None if no spans or retrieval documents are found.

    Examples:
        Basic usage::

            from phoenix.client import AsyncClient
            from phoenix.client.helpers.evaluation import get_qa_with_reference_async

            client = AsyncClient()
            qa_df = await get_qa_with_reference_async(client, project_name="my-rag-app")
    """
    import pandas as pd

    project = project_identifier or project_name or get_env_project_name()
    separator = "\n\n"
    qa_query = (
        SpanQuery()
        .select("span_id", INPUT_VALUE, OUTPUT_VALUE)
        .rename(**IO)
        .where(IS_ROOT)
        .with_index("trace_id")
    )
    docs_query = (
        SpanQuery()
        .where(IS_RETRIEVER)
        .concat(RETRIEVAL_DOCUMENTS, reference=DOCUMENT_CONTENT)
        .with_index("trace_id")
    )  # separator is "\n\n" by default

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

    ref = df_docs.groupby("context.trace_id")["reference"].apply(
        lambda x: separator.join(x.dropna())
    )
    df_ref = pd.DataFrame({"reference": ref})
    df_qa_ref = pd.concat([df_qa, df_ref], axis=1, join="inner").set_index("context.span_id")
    return df_qa_ref
