"""Detecting context-quality drops in multi-hop RAG chains with Phoenix.

This script demonstrates a pattern for identifying the specific retrieval
hop in a multi-hop RAG pipeline where context quality degrades — a failure
mode that is invisible to coarse end-to-end metrics but that Phoenix span
tracing makes detectable.

Background
----------
In a multi-hop RAG chain (e.g., plan → retrieve → summarise → analyse),
each retrieval hop fetches chunks from a vector store. A later hop can
quietly pull low-relevance chunks even when the final answer still looks
correct on standard faithfulness or answer-relevancy checks.

We call this a "context quality drop": the retrieval_relevance_score falls
between adjacent hops, but the final LLM output masks the degradation.

Approach
--------
1. Instrument each hop with an OpenInference RAG span.
2. After the chain runs, pull the spans from Phoenix and compute per-hop
   retrieval_relevance_score using a configurable evaluator.
3. Flag spans where the delta vs. the previous hop exceeds a threshold.

Dependencies
------------
    pip install arize-phoenix opentelemetry-sdk openinference-instrumentation
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Sequence


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class HopResult:
    """Represents the output of a single retrieval hop in the chain."""

    hop_index: int
    query: str
    retrieved_chunks: List[str]
    # Filled in after evaluation
    retrieval_relevance_score: Optional[float] = None
    context_quality_delta: Optional[float] = None  # score - previous_hop_score
    context_drop_detected: bool = False


@dataclass
class MultiHopEvalResult:
    """Aggregated evaluation result for the whole chain."""

    hops: List[HopResult] = field(default_factory=list)
    worst_hop_index: Optional[int] = None
    chain_mean_score: Optional[float] = None


# ---------------------------------------------------------------------------
# Evaluator interface
# ---------------------------------------------------------------------------

def cosine_relevance_evaluator(query: str, chunks: List[str]) -> float:
    """Placeholder evaluator: returns a mock retrieval_relevance_score.

    In a real pipeline, replace this with a Phoenix llm_classify call or
    any embedding-based cosine-similarity scorer.

    Returns a float in [0, 1] where 1 means the chunks are highly
    relevant to the query.
    """
    # --- Replace the body below with your actual evaluator ---
    # Example using Phoenix evals:
    #
    #   from phoenix.evals import llm_classify, RAG_RELEVANCY_PROMPT_TEMPLATE
    #   rails = ["relevant", "irrelevant"]
    #   result = llm_classify(
    #       data=[{"query": query, "reference": "\n".join(chunks)}],
    #       template=RAG_RELEVANCY_PROMPT_TEMPLATE,
    #       model=model,
    #       rails=rails,
    #   )
    #   return 1.0 if result["label"][0] == "relevant" else 0.0
    raise NotImplementedError(
        "Replace this placeholder with your actual relevance evaluator. "
        "See the docstring for an example using Phoenix llm_classify."
    )


# ---------------------------------------------------------------------------
# Core evaluation logic
# ---------------------------------------------------------------------------

def evaluate_multi_hop_chain(
    hops: List[HopResult],
    evaluator: Callable[[str, List[str]], float] = cosine_relevance_evaluator,
    drop_threshold: float = 0.15,
) -> MultiHopEvalResult:
    """Evaluate each hop and detect context-quality drops.

    Parameters
    ----------
    hops:
        Ordered list of :class:`HopResult` objects, one per retrieval hop.
    evaluator:
        Callable that takes ``(query, chunks)`` and returns a float in
        ``[0, 1]``. Defaults to the placeholder :func:`cosine_relevance_evaluator`.
    drop_threshold:
        Minimum decrease in score between adjacent hops that constitutes a
        "context quality drop" (default: 0.15). Set lower to be more
        sensitive; raise it to suppress noise.

    Returns
    -------
    MultiHopEvalResult
        Contains per-hop scores, deltas, drop flags, and a worst-hop pointer.
    """
    result = MultiHopEvalResult(hops=hops)
    prev_score: Optional[float] = None

    for hop in hops:
        score = evaluator(hop.query, hop.retrieved_chunks)
        hop.retrieval_relevance_score = score

        if prev_score is not None:
            delta = score - prev_score
            hop.context_quality_delta = delta
            hop.context_drop_detected = delta < -drop_threshold
        prev_score = score

    scored = [h for h in hops if h.retrieval_relevance_score is not None]
    if scored:
        result.chain_mean_score = sum(
            h.retrieval_relevance_score for h in scored
        ) / len(scored)
        result.worst_hop_index = min(
            scored, key=lambda h: h.retrieval_relevance_score
        ).hop_index

    return result


# ---------------------------------------------------------------------------
# Phoenix span attachment helper
# ---------------------------------------------------------------------------

def attach_hop_scores_to_phoenix_spans(
    eval_result: MultiHopEvalResult,
    span_ids: Sequence[str],
    phoenix_client,
) -> None:
    """Attach per-hop scores to Phoenix spans as structured feedback.

    This allows the context quality drop to be visible in the Phoenix UI
    alongside the existing trace, and lets you filter / alert on spans
    where ``context_drop_detected=True``.

    Parameters
    ----------
    eval_result:
        The result from :func:`evaluate_multi_hop_chain`.
    span_ids:
        Ordered list of span IDs, one per hop (must align with
        ``eval_result.hops``).
    phoenix_client:
        An initialised ``phoenix.Client`` instance.

    Example
    -------
    .. code-block:: python

        import phoenix as px
        from phoenix.trace import SpanEvaluations
        import pandas as pd

        client = px.Client()
        # After calling evaluate_multi_hop_chain(...)
        attach_hop_scores_to_phoenix_spans(eval_result, span_ids, client)
    """
    try:
        import pandas as pd
        from phoenix.trace import SpanEvaluations
    except ImportError as exc:
        raise ImportError(
            "arize-phoenix must be installed to use this helper. "
            "Run: pip install arize-phoenix"
        ) from exc

    records = []
    for hop, span_id in zip(eval_result.hops, span_ids):
        if hop.retrieval_relevance_score is None:
            continue
        records.append({
            "context.span_id": span_id,
            "name": "retrieval_relevance",
            "score": hop.retrieval_relevance_score,
            "label": "drop_detected" if hop.context_drop_detected else "ok",
            "metadata.hop_index": hop.hop_index,
            "metadata.context_quality_delta": hop.context_quality_delta,
        })

    if records:
        evals_df = pd.DataFrame(records).set_index("context.span_id")
        phoenix_client.log_evaluations(SpanEvaluations(
            eval_name="retrieval_relevance",
            dataframe=evals_df,
        ))


# ---------------------------------------------------------------------------
# Example usage (requires a running Phoenix server)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # This is a minimal demonstration of the pattern.
    # Replace the mock evaluator with your real evaluator before running.
    import random

    def _mock_evaluator(query: str, chunks: list) -> float:
        """Returns a deterministic but hop-varying score for demonstration."""
        # Hop 0: high relevance, Hop 1: moderate, Hop 2: low (simulates a drop)
        base = {0: 0.91, 1: 0.88, 2: 0.61}  # noqa: PIE804
        return base.get(hash(query) % 3, 0.75)

    demo_hops = [
        HopResult(
            hop_index=0,
            query="What are total current assets?",
            retrieved_chunks=[
                "Current assets: cash $300K, receivables $200K. Total: $500K."
            ],
        ),
        HopResult(
            hop_index=1,
            query="How did current assets change year-over-year?",
            retrieved_chunks=[
                "Goodwill: $50K. Accumulated depreciation: $400K."
            ],
        ),
        HopResult(
            hop_index=2,
            query="What drove the change in receivables?",
            retrieved_chunks=[
                "The company updated its accounting policy in Q2 2023.",
                "Revenue from new contracts: $80K.",
            ],
        ),
    ]

    result = evaluate_multi_hop_chain(
        hops=demo_hops,
        evaluator=_mock_evaluator,
        drop_threshold=0.15,
    )

    print(f"Chain mean retrieval relevance: {result.chain_mean_score:.3f}")
    print(f"Worst hop: {result.worst_hop_index}")
    for hop in result.hops:
        drop_flag = " <-- CONTEXT DROP DETECTED" if hop.context_drop_detected else ""
        delta_str = (
            f"{hop.context_quality_delta:+.3f}"
            if hop.context_quality_delta is not None
            else "  n/a "
        )
        print(
            f"  Hop {hop.hop_index}: score={hop.retrieval_relevance_score:.3f}  "
            f"delta={delta_str}{drop_flag}"
        )
