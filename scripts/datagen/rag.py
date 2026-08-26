"""Local framework components for the LlamaIndex RAG recorder."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class _RerankResult:
    index: int
    relevance_score: float


@dataclass(frozen=True)
class _RerankResponse:
    results: tuple[_RerankResult, ...]


class _LocalCohereClient:
    def rerank(
        self,
        *,
        model: str,
        top_n: int,
        query: str,
        documents: list[str],
    ) -> _RerankResponse:
        del model
        query_terms = _terms(query)
        ranked = sorted(
            (
                _RerankResult(index=index, relevance_score=float(len(query_terms & _terms(text))))
                for index, text in enumerate(documents)
            ),
            key=lambda result: (result.relevance_score, -result.index),
            reverse=True,
        )[:top_n]
        return _RerankResponse(results=tuple(ranked))


def build_rag_engine(documents: Sequence[Mapping[str, Any]]) -> Any:
    """Build a local LlamaIndex query engine over fixture documents."""
    from llama_index.core import Document, VectorStoreIndex  # type: ignore[import-not-found]
    from llama_index.core.embeddings import MockEmbedding  # type: ignore[import-not-found]
    from llama_index.core.llms import MockLLM  # type: ignore[import-not-found]
    from llama_index.core.query_engine import (  # type: ignore[import-not-found]
        RetrieverQueryEngine,
    )
    from llama_index.postprocessor.cohere_rerank import (  # type: ignore[import-not-found]
        CohereRerank,
    )

    nodes = [
        Document(text=str(document["text"]), metadata={"source": str(document["source"])})
        for document in documents
    ]
    embedding = MockEmbedding(embed_dim=16)
    index = VectorStoreIndex.from_documents(nodes, embed_model=embedding)
    retriever = index.as_retriever(similarity_top_k=len(nodes))
    reranker = CohereRerank(api_key="datagen-dummy-key", model="rerank-v3.5", top_n=2)
    reranker._client = _LocalCohereClient()
    return RetrieverQueryEngine.from_args(
        retriever,
        llm=MockLLM(max_tokens=24),
        node_postprocessors=[reranker],
    )


def _terms(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))
