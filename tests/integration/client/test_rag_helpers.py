# pyright: reportUnknownArgumentType=false, reportUnknownMemberType=false, reportAssignmentType=false
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional, cast

import pandas as pd
import pytest
from openinference.semconv.trace import DocumentAttributes, SpanAttributes

from phoenix.client.__generated__ import v1

from .._helpers import (  # pyright: ignore[reportPrivateUsage]
    _MEMBER,
    _AppInfo,
    _ExistingProject,
    _GetUser,
    _until_spans_exist,
)

# Aliases for common OpenInference attribute keys used in rag helper queries
DOCUMENT_CONTENT = DocumentAttributes.DOCUMENT_CONTENT
DOCUMENT_SCORE = DocumentAttributes.DOCUMENT_SCORE
DOCUMENT_METADATA = DocumentAttributes.DOCUMENT_METADATA
RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS
INPUT_VALUE = SpanAttributes.INPUT_VALUE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
METADATA = SpanAttributes.METADATA


def _doc(
    content: str, score: float | None = None, metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    d: dict[str, Any] = {"content": content}
    if score is not None:
        d["score"] = score
    if metadata is not None:
        d["metadata"] = metadata
    return d


def _create_root_span(
    *,
    trace_id: str,
    span_id: str,
    name: str = "root",
    start: datetime | None = None,
    duration_secs: float = 1.0,
    input_text: str = "question",
    output_text: str = "answer",
    extra_metadata: dict[str, Any] | None = None,
) -> v1.Span:
    start_time = (start or datetime.now(timezone.utc)).isoformat()
    end_time = (datetime.fromisoformat(start_time) + timedelta(seconds=duration_secs)).isoformat()
    attrs: dict[str, Any] = {
        INPUT_VALUE: input_text,
        OUTPUT_VALUE: output_text,
    }
    if extra_metadata is not None:
        attrs[METADATA] = extra_metadata
    return cast(
        v1.Span,
        {
            "name": name,
            "context": {"trace_id": trace_id, "span_id": span_id},
            "span_kind": "CHAIN",
            "parent_id": None,
            "start_time": start_time,
            "end_time": end_time,
            "status_code": "OK",
            "attributes": attrs,
        },
    )


def _create_retriever_span(
    *,
    trace_id: str,
    span_id: str,
    parent_id: Optional[str] = None,
    name: str = "retriever",
    start: datetime | None = None,
    duration_secs: float = 1.0,
    input_text: str = "retrieve for question",
    documents: list[dict[str, Any]] | None = None,
) -> v1.Span:
    start_time = (start or datetime.now(timezone.utc)).isoformat()
    end_time = (datetime.fromisoformat(start_time) + timedelta(seconds=duration_secs)).isoformat()
    docs = documents if documents is not None else []
    return cast(
        v1.Span,
        {
            "name": name,
            "context": {"trace_id": trace_id, "span_id": span_id},
            "parent_id": parent_id,
            "span_kind": "RETRIEVER",
            "start_time": start_time,
            "end_time": end_time,
            "status_code": "OK",
            "attributes": {
                "input": {"value": input_text},
                "retrieval": {"documents": [{"document": doc} for doc in docs]},
            },
        },
    )


class TestEvaluationHelpersRag:
    @pytest.mark.parametrize("is_async", [True, False])
    async def test_no_matching_spans(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.helpers.spans.rag import (
            async_get_input_output_context,
            async_get_retrieved_documents,
            get_input_output_context,
            get_retrieved_documents,
        )

        project_name = _existing_project.name

        if is_async:
            client_async = AsyncClient(base_url=_app.base_url, api_key=api_key)
            client_sync = None
        else:
            client_sync = SyncClient(base_url=_app.base_url, api_key=api_key)
            client_async = None

        # No spans logged
        docs_df: pd.DataFrame
        if is_async:
            assert client_async is not None
            docs_df = await async_get_retrieved_documents(client_async, project_name=project_name)
        else:
            assert client_sync is not None
            docs_df = get_retrieved_documents(client_sync, project_name=project_name)
        assert isinstance(docs_df, pd.DataFrame)
        assert docs_df.empty

        qa_df: Optional[pd.DataFrame]
        if is_async:
            assert client_async is not None
            qa_df = await async_get_input_output_context(client_async, project_name=project_name)
        else:
            assert client_sync is not None
            qa_df = get_input_output_context(client_sync, project_name=project_name)
        assert qa_df is None

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_retrieved_documents_basic_and_edge_cases(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """Covers basic explosion to rows, missing fields, and empty docs."""
        user = _get_user(_app, _MEMBER).log_in(_app)
        api_key = str(user.create_api_key(_app))

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.helpers.spans.rag import (
            async_get_retrieved_documents,
            get_retrieved_documents,
        )

        if is_async:
            client_async = AsyncClient(base_url=_app.base_url, api_key=api_key)
            client_sync = None
        else:
            client_sync = SyncClient(base_url=_app.base_url, api_key=api_key)
            client_async = None
        project_name = _existing_project.name

        trace_id = f"trace_retrieve_{token_hex(8)}"
        retriever_span_id = f"retr_{token_hex(8)}"
        # One doc with full fields, one doc missing score/metadata
        docs = [
            _doc("doc_1_content", score=0.9, metadata={"source": "a"}),
            _doc("doc_2_content"),
        ]
        retriever = _create_retriever_span(
            trace_id=trace_id,
            span_id=retriever_span_id,
            input_text="what is X?",
            documents=docs,
        )

        # Another retriever with empty docs -> contributes no rows
        empty_retriever_span_id = f"retr_empty_{token_hex(6)}"
        empty_retriever = _create_retriever_span(
            trace_id=trace_id,
            span_id=empty_retriever_span_id,
            input_text="empty case",
            documents=[],
        )

        # Log spans
        if is_async:
            assert client_async is not None
            create_result = await client_async.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name, spans=[retriever, empty_retriever]
            )
        else:
            assert client_sync is not None
            create_result = client_sync.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name, spans=[retriever, empty_retriever]
            )
        assert create_result["total_queued"] == 2
        await _until_spans_exist(_app, [retriever_span_id])

        df: pd.DataFrame
        if is_async:
            assert client_async is not None
            df = await async_get_retrieved_documents(client_async, project_name=project_name)
        else:
            assert client_sync is not None
            df = get_retrieved_documents(client_sync, project_name=project_name)

        assert isinstance(df, pd.DataFrame)
        # Focus only on rows for the retriever that has docs
        df_docs_only = df[df.index.get_level_values(0) == retriever_span_id]
        assert len(df_docs_only) == 2
        # Expect multi-index with span_id and document position
        assert df_docs_only.index.nlevels == 2
        assert "context.trace_id" in df_docs_only.columns
        assert "input" in df_docs_only.columns
        # Input propagated from retriever span
        assert all(val == "what is X?" for val in df_docs_only["input"].tolist())
        # Content and score/metadata assertions when available
        if "document" in df_docs_only.columns:
            documents = set(df_docs_only["document"].astype(str).tolist())  # pyright: ignore[reportAttributeAccessIssue]
            assert "doc_1_content" in documents and "doc_2_content" in documents
        if "document_score" in df_docs_only.columns:
            has_missing = any(pd.isna(s) for s in df_docs_only["document_score"].tolist())  # pyright: ignore[reportArgumentType]
            assert has_missing

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_input_output_context_concatenation(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Ensure concatenation across retriever spans/documents is correct."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.helpers.spans.rag import (
            async_get_input_output_context,
            get_input_output_context,
        )

        if is_async:
            client_async = AsyncClient(base_url=_app.base_url, api_key=api_key)
            client_sync = None
        else:
            client_sync = SyncClient(base_url=_app.base_url, api_key=api_key)
            client_async = None
        project_name = _existing_project.name

        trace_id = f"trace_concat_{token_hex(8)}"
        root_span_id = f"root_{token_hex(8)}"
        retr1_id = f"retr1_{token_hex(6)}"
        retr2_id = f"retr2_{token_hex(6)}"
        root = _create_root_span(
            trace_id=trace_id,
            span_id=root_span_id,
            input_text="What is the capital of France?",
            output_text="Paris",
            extra_metadata={"task": "geography"},
        )
        retr1 = _create_retriever_span(
            trace_id=trace_id,
            span_id=retr1_id,
            parent_id=root_span_id,
            documents=[_doc("Paris is the capital city of France.", score=0.95)],
        )
        retr2 = _create_retriever_span(
            trace_id=trace_id,
            span_id=retr2_id,
            parent_id=root_span_id,
            documents=[_doc("France is a country in Western Europe.", score=0.8)],
        )

        if is_async:
            assert client_async is not None
            create_result = await client_async.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name, spans=[root, retr1, retr2]
            )
        else:
            assert client_sync is not None
            create_result = client_sync.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name, spans=[root, retr1, retr2]
            )
        assert create_result["total_queued"] == 3
        await _until_spans_exist(_app, [root_span_id, retr1_id, retr2_id])
        # Poll to account for eventual consistency of dataframe endpoints
        if is_async:
            assert client_async is not None
            qa_df2 = await async_get_input_output_context(
                client_async, project_name=project_name, timeout=15
            )
        else:
            assert client_sync is not None
            qa_df2 = get_input_output_context(client_sync, project_name=project_name, timeout=15)
        assert qa_df2 is not None
        assert isinstance(qa_df2, pd.DataFrame)
        # Index should be context.span_id, which should include the root span
        assert str(root_span_id) in qa_df2.index.astype(str)  # pyright: ignore[reportGeneralTypeIssues]
        row = qa_df2.loc[str(root_span_id)]
        assert row["input"] == "What is the capital of France?"  # pyright: ignore[reportGeneralTypeIssues]
        assert row["output"] == "Paris"  # pyright: ignore[reportGeneralTypeIssues]
        # Confirm concatenation contains both pieces and uses separator "\n\n"
        context_val = row["context"]
        assert isinstance(context_val, str)
        assert "Paris is the capital city of France." in context_val
        assert "France is a country in Western Europe." in context_val
        assert "\n\n" in context_val
        # Metadata is propagated
        assert (
            "metadata" in row  # pyright: ignore[reportGeneralTypeIssues]
            and isinstance(row["metadata"], dict)
            and row["metadata"]["task"] == "geography"
        )

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_time_filtering_helpers(
        self,
        is_async: bool,
        _existing_project: _ExistingProject,
        _app: _AppInfo,
    ) -> None:
        """Verify start_time/end_time filter behavior for both helpers."""
        api_key = _app.admin_secret

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient
        from phoenix.client.helpers.spans.rag import (
            async_get_input_output_context,
            async_get_retrieved_documents,
            get_input_output_context,
            get_retrieved_documents,
        )

        if is_async:
            client_async = AsyncClient(base_url=_app.base_url, api_key=api_key)
            client_sync = None
        else:
            client_sync = SyncClient(base_url=_app.base_url, api_key=api_key)
            client_async = None
        project_name = _existing_project.name

        base_time = datetime.now(timezone.utc)

        # Early trace (should be excluded by later filter)
        trace_early = f"trace_time_{token_hex(8)}"
        retr_early_id = f"retr_{token_hex(6)}"
        root_early = _create_root_span(
            trace_id=trace_early,
            span_id=f"root_{token_hex(6)}",
            start=base_time,
            input_text="early in time",
            output_text="early out",
        )
        retr_early = _create_retriever_span(
            trace_id=trace_early,
            span_id=retr_early_id,
            parent_id=root_early["context"]["span_id"],
            start=base_time,
            documents=[_doc("early doc")],
        )

        # Later trace (should be included)
        later_start = base_time + timedelta(seconds=30)
        trace_late = f"trace_time_{token_hex(8)}"
        retr_late_id = f"retr_{token_hex(6)}"
        root_late = _create_root_span(
            trace_id=trace_late,
            span_id=f"root_{token_hex(6)}",
            start=later_start,
            input_text="late in time",
            output_text="late out",
        )
        retr_late = _create_retriever_span(
            trace_id=trace_late,
            span_id=retr_late_id,
            parent_id=root_late["context"]["span_id"],
            start=later_start,
            documents=[_doc("late doc")],
        )

        if is_async:
            assert client_async is not None
            create_result = await client_async.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=[root_early, retr_early, root_late, retr_late],
            )
        else:
            assert client_sync is not None
            create_result = client_sync.spans.log_spans(  # pyright: ignore[reportAttributeAccessIssue]
                project_identifier=project_name,
                spans=[root_early, retr_early, root_late, retr_late],
            )
        assert create_result["total_queued"] == 4
        await _until_spans_exist(
            _app,
            [
                root_early["context"]["span_id"],
                retr_early_id,
                root_late["context"]["span_id"],
                retr_late_id,
            ],
        )

        # Filter to include only the later spans
        start_time = later_start - timedelta(seconds=1)
        end_time = later_start + timedelta(seconds=10)

        docs_df: pd.DataFrame
        if is_async:
            assert client_async is not None
            docs_df = await async_get_retrieved_documents(
                client_async,
                project_name=project_name,
                start_time=start_time,
                end_time=end_time,
                timeout=15,
            )
        else:
            assert client_sync is not None
            docs_df = get_retrieved_documents(
                client_sync,
                project_name=project_name,
                start_time=start_time,
                end_time=end_time,
                timeout=15,
            )
        assert isinstance(docs_df, pd.DataFrame)
        # Should only include "late doc"
        if "document" in docs_df.columns:
            documents: set[str] = (
                set(docs_df["document"].astype(str).tolist()) if not docs_df.empty else set()  # pyright: ignore[reportAttributeAccessIssue]
            )
            assert documents == {"late doc"}
        else:
            assert not docs_df.empty
            assert set(docs_df["context.trace_id"].astype(str).tolist()) == {trace_late}  # pyright: ignore[reportAttributeAccessIssue]
            assert docs_df.shape[0] == 1

        if is_async:
            assert client_async is not None
            qa_df = await async_get_input_output_context(
                client_async,
                project_name=project_name,
                start_time=start_time,
                end_time=end_time,
                timeout=15,
            )
        else:
            assert client_sync is not None
            qa_df = get_input_output_context(
                client_sync,
                project_name=project_name,
                start_time=start_time,
                end_time=end_time,
                timeout=15,
            )
        assert qa_df is not None
        assert isinstance(qa_df, pd.DataFrame)
        # Only the late root span should be present
        assert len(qa_df) == 1
        row = qa_df.iloc[0]
        assert row["input"] == "late in time"  # pyright: ignore[reportGeneralTypeIssues]
        assert row["output"] == "late out"  # pyright: ignore[reportGeneralTypeIssues]
        assert "late doc" in row["context"]
