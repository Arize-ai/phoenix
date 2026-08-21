"""Local providers and framework components for the RAG recorder."""

from __future__ import annotations

import re
from dataclasses import dataclass

from llama_index.core import Document, VectorStoreIndex
from llama_index.core.embeddings import MockEmbedding
from llama_index.core.llms import MockLLM
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.postprocessor.cohere_rerank import CohereRerank

SESSIONS = {
    "shipping-help": (
        "When should my standard-delivery order arrive?",
        "Would express shipping arrive sooner?",
    ),
    "returns-help": (
        "Can I return an unused backpack bought 18 days ago?",
        "When will the refund appear after I mail it back?",
    ),
    "account-safety": (
        "I saw an account login I do not recognize. What should I do first?",
        "When should support escalate an account-security case?",
    ),
}
POLICY_DOCUMENTS = (
    Document(
        text=(
            "Standard delivery normally takes 4–6 business days after fulfillment. "
            "Express delivery takes 1–2 business days."
        ),
        metadata={"source": "shipping-policy"},
    ),
    Document(
        text=(
            "Unused items can be returned within 30 days. Refunds usually appear "
            "within 3–5 business days after the warehouse scan."
        ),
        metadata={"source": "returns-policy"},
    ),
    Document(
        text=(
            "For an unfamiliar login, reset the password, revoke other sessions, and "
            "enable multi-factor authentication. Escalate continued suspicious activity."
        ),
        metadata={"source": "account-security"},
    ),
)


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


def build_rag_engine() -> RetrieverQueryEngine:
    embedding = MockEmbedding(embed_dim=16)
    index = VectorStoreIndex.from_documents(list(POLICY_DOCUMENTS), embed_model=embedding)
    retriever = index.as_retriever(similarity_top_k=len(POLICY_DOCUMENTS))
    reranker = CohereRerank(
        api_key="datagen-dummy-key",
        model="rerank-v3.5",
        top_n=2,
    )
    reranker._client = _LocalCohereClient()
    return RetrieverQueryEngine.from_args(
        retriever,
        llm=MockLLM(max_tokens=24),
        node_postprocessors=[reranker],
    )


def _terms(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))
