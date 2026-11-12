"""Policy assistant for an outdoor gear store.

Answers customer questions about returns, shipping, billing, warranties, and accounts
from the policy knowledge base. Traced with OpenInference to the `policy-rag` project
in Phoenix: a `rag-query` chain span wraps a `retrieve_policies` retriever span and the
LLM call.
"""

from __future__ import annotations

from knowledge_base import search
from openai import OpenAI

TOP_K = 4
SYSTEM_PROMPT = """You are the policy assistant for an outdoor gear store. Answer the customer's question using only the policy passages provided. If the passages don't answer the question, say that you don't know."""

client = OpenAI()


def retrieve_policies(question: str) -> list[dict[str, object]]:
    """Returns the `TOP_K` closest policy passages as `{"id", "content", "score"}`."""
    return search(question, k=TOP_K)


def answer(question: str) -> str:
    passages = retrieve_policies(question)
    context = "\n".join(f"[{i}] {p['content']}" for i, p in enumerate(passages, start=1))
    response = client.chat.completions.create(
        model="gpt-5.6-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Policy passages:\n{context}\n\nCustomer question: {question}",
            },
        ],
    )
    return response.choices[0].message.content or ""
