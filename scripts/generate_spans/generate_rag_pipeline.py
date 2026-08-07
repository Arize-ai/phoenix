"""RAG pipelines whose answer quality follows from what retrieval actually returned.

The point of this fixture is the *correlation*, not the individual spans: a query whose
retrieval missed produces low document relevance, a low `qa_correctness` score, and a higher
chance of hallucination. Fixtures that score answers independently of retrieval make the RAG
triad look uninformative, because every chart ends up uncorrelated noise.

Each trace is: CHAIN -> EMBEDDING -> RETRIEVER -> (RERANKER) -> LLM.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import timedelta

try:
    from ._shared import (
        Annotations,
        Generator,
        add_common_arguments,
        document_attributes,
        duration_for,
        llm_attributes,
        ns,
        positive_int,
        probability,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Annotations,
        Generator,
        add_common_arguments,
        document_attributes,
        duration_for,
        llm_attributes,
        ns,
        positive_int,
        probability,
        utc_now,
    )

# Each question has a matching passage and a set of near-miss passages that a weak retriever
# surfaces instead. The distinction is what makes retrieval quality legible downstream.
KNOWLEDGE = (
    {
        "question": "How do I set the project name when exporting traces?",
        "answer": "Set the `openinference.project.name` resource attribute on the tracer provider.",
        "relevant": "A span's project comes from the openinference.project.name resource.",
        # Long-standing docs, densely covered: retrieval rarely misses here.
        "miss_bias": 0.4,
        "distractors": (
            "Projects can be renamed from the settings page after they are created.",
            "Span names are set per-span and are unrelated to the project.",
        ),
    },
    {
        "question": "Why are my token counts missing?",
        "answer": "The instrumentation must emit llm.token_count.* attributes; not all do.",
        "relevant": "Token counts come from llm.token_count.prompt and llm.token_count.completion.",
        "miss_bias": 0.9,
        "distractors": (
            "Costs are computed from a model cost manifest keyed by model name.",
            "Streaming responses may finish after the span ends.",
        ),
    },
    {
        "question": "Can I backfill traces from last week?",
        "answer": "Yes — export spans with explicit start and end timestamps in the past.",
        "relevant": "OTLP accepts arbitrary start and end timestamps, including historical ones.",
        "miss_bias": 1.0,
        "distractors": (
            "Retention policies delete spans older than the configured window.",
            "The time picker defaults to the last 24 hours.",
        ),
    },
    {
        "question": "How do I annotate a specific retrieved document?",
        "answer": "Use the document annotation API with the document's position in the span.",
        "relevant": "Document annotations are addressed by span_id plus document_position.",
        # The newest, thinnest corner of the corpus — the one a reader should be able to find
        # by asking which topic retrieves worst. A flat miss rate hides exactly that.
        "miss_bias": 1.7,
        "distractors": (
            "Span annotations attach a score to a whole span.",
            "Documents carry an optional document.id attribute for your own bookkeeping.",
        ),
    },
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate RAG traces whose answer quality tracks retrieval quality."
    )
    add_common_arguments(parser, default_project="rag")
    parser.add_argument(
        "--traces",
        type=positive_int,
        default=60,
        help="Number of RAG queries to generate (default: 60).",
    )
    parser.add_argument(
        "--top-k",
        type=positive_int,
        default=4,
        help="Documents retrieved per query (default: 4).",
    )
    parser.add_argument(
        "--miss-rate",
        type=probability,
        default=0.25,
        help="Probability that retrieval fails to surface the relevant passage (default: 0.25).",
    )
    parser.add_argument(
        "--rerank-rate",
        type=probability,
        default=0.5,
        help="Probability that a query goes through a reranker (default: 0.5).",
    )
    parser.add_argument(
        "--annotation-rate",
        type=probability,
        default=1.0,
        help="Fraction of traces receiving span and document annotations (default: 1.0).",
    )
    return parser


def _distractor_pool(entry: dict[str, object]) -> list[str]:
    """Every passage in the corpus except this question's answer.

    Drawing from the whole corpus — not just the entry's own near-misses — keeps a retrieval
    result free of repeated passages, which no real vector store would return.
    """
    relevant = str(entry["relevant"])
    pool = [str(text) for other in KNOWLEDGE for text in (other["relevant"], *other["distractors"])]  # type: ignore[misc]
    return [text for text in dict.fromkeys(pool) if text != relevant]


def _documents(
    generator: Generator, entry: dict[str, object], top_k: int, hit: bool
) -> list[tuple[str, float, bool]]:
    """Return ``(content, score, is_relevant)`` ordered by descending score."""
    documents: list[tuple[str, float, bool]] = []
    if hit:
        # Overlaps the distractor range on purpose. Disjoint ranges would put the relevant
        # passage at position 0 every single time, and then reranking could never demonstrate
        # anything — a reranker exists precisely to promote a passage the retriever buried.
        documents.append((str(entry["relevant"]), generator.rng.uniform(0.55, 0.97), True))
    pool = _distractor_pool(entry)
    needed = top_k - len(documents)
    chosen = (
        generator.rng.sample(pool, needed)
        if needed <= len(pool)
        else pool + [generator.rng.choice(pool) for _ in range(needed - len(pool))]
    )
    documents.extend((content, generator.rng.uniform(0.30, 0.80), False) for content in chosen)
    return sorted(documents, key=lambda document: document[1], reverse=True)


def _reranked(
    generator: Generator, documents: list[tuple[str, float, bool]], keep: int
) -> list[tuple[str, float, bool]]:
    """Re-score with a sharper model, then keep the top ``keep``.

    The reranker is better than the retriever but not perfect, so a buried relevant passage is
    usually promoted rather than always. Truncating the retriever's own order instead would
    make the RERANKER span decorative.
    """
    rescored = [
        (
            content,
            round(
                generator.rng.uniform(0.80, 0.99)
                if relevant and generator.rng.random() < 0.85
                else generator.rng.uniform(0.10, 0.70),
                4,
            ),
            relevant,
        )
        for content, _score, relevant in documents
    ]
    rescored.sort(key=lambda document: document[1], reverse=True)
    return rescored[:keep]


def _document_attributes(
    documents: list[tuple[str, float, bool]], prefix: str
) -> dict[str, object]:
    return document_attributes(
        (
            {"id": f"kb-{index:03d}", "content": content, "score": round(score, 4)}
            for index, (content, score, _) in enumerate(documents)
        ),
        prefix,
    )


def _run_query(
    generator: Generator,
    args: argparse.Namespace,
    annotations: Annotations,
    index: int,
) -> bool:
    entry = KNOWLEDGE[index % len(KNOWLEDGE)]
    question = str(entry["question"])
    hit = generator.rng.random() >= min(0.95, args.miss_rate * float(entry["miss_bias"]))
    documents = _documents(generator, entry, args.top_k, hit)
    reranked = generator.rng.random() < args.rerank_rate
    # A miss means the model answers from the wrong context, so the answer degrades with it.
    answer = (
        str(entry["answer"])
        if hit
        else "I could not find that in the documentation, but it may be configurable."
    )

    # Time the stages before emitting, because the request cannot know its own end until the
    # work inside it is known. A RAG waterfall is the canonical view of this pipeline, and the
    # retrieval-versus-generation split is most of what it is read for.
    llm = llm_attributes(generator.rng, input_value=question, output_value=answer)
    embed_seconds = generator.rng.uniform(0.01, 0.06)
    retrieve_seconds = generator.rng.uniform(0.04, 0.32)
    rerank_seconds = generator.rng.uniform(0.05, 0.28) if reranked else 0.0
    answer_seconds = duration_for(generator.rng, int(llm.get("llm.token_count.completion", 0)))
    total = embed_seconds + retrieve_seconds + rerank_seconds + answer_seconds + 0.001
    cursor = utc_now() - timedelta(seconds=total)

    with generator.span(
        "rag-query",
        "CHAIN",
        attributes={
            "input.value": question,
            "output.value": answer,
            "metadata": json.dumps({"fixture": "rag", "retrieval_hit": hit}),
        },
        start_time=ns(cursor),
        end_time=ns(cursor + timedelta(seconds=total)),
        root=True,
    ) as root:
        with generator.span(
            "embed-query",
            "EMBEDDING",
            attributes={
                "embedding.model_name": "text-embedding-3-small",
                "embedding.embeddings.0.embedding.text": question,
            },
            start_time=ns(cursor),
            end_time=ns(cursor + timedelta(seconds=embed_seconds)),
        ):
            pass
        cursor += timedelta(seconds=embed_seconds)

        with generator.span(
            "retrieve-documents",
            "RETRIEVER",
            attributes={
                "input.value": question,
                **_document_attributes(documents, "retrieval.documents"),
            },
            start_time=ns(cursor),
            end_time=ns(cursor + timedelta(seconds=retrieve_seconds)),
        ) as retriever:
            pass
        cursor += timedelta(seconds=retrieve_seconds)

        if reranked:
            keep = max(1, args.top_k // 2)
            kept = _reranked(generator, documents, keep)
            with generator.span(
                "rerank-documents",
                "RERANKER",
                attributes={
                    "reranker.query": question,
                    "reranker.model_name": "cohere-rerank-v3.5",
                    "reranker.top_k": keep,
                    **_document_attributes(documents, "reranker.input_documents"),
                    **_document_attributes(kept, "reranker.output_documents"),
                },
                start_time=ns(cursor),
                end_time=ns(cursor + timedelta(seconds=rerank_seconds)),
            ):
                pass
            cursor += timedelta(seconds=rerank_seconds)

        with generator.span(
            "synthesize-answer",
            "LLM",
            attributes=llm,
            start_time=ns(cursor),
            end_time=ns(cursor + timedelta(seconds=answer_seconds)),
        ):
            pass

    if generator.rng.random() < args.annotation_rate:
        correctness = (
            generator.rng.betavariate(6.0, 1.6) if hit else generator.rng.betavariate(1.5, 5.0)
        )
        annotations.add(
            root,
            "qa_correctness",
            score=correctness,
            label="correct" if correctness >= 0.5 else "incorrect",
            explanation=(
                "Answer is grounded in the retrieved passage."
                if hit
                else "Retrieved context did not contain the answer."
            ),
        )
        # Hallucination is far likelier once the grounding context is wrong.
        hallucinated = generator.rng.random() < (0.05 if hit else 0.45)
        annotations.add(
            root,
            "hallucination",
            label="hallucinated" if hallucinated else "factual",
            score=1.0 if hallucinated else 0.0,
        )
        # A reviewer leaving a note on a bad answer is the shape the notes UI is built for.
        if not hit and generator.rng.random() < 0.5:
            annotations.add_note(
                root,
                "Retrieval missed the relevant passage — check the chunking for this doc set.",
            )
        for position, (_, _, relevant) in enumerate(documents):
            annotations.add_document(
                retriever,
                position,
                "relevance",
                label="relevant" if relevant else "irrelevant",
                score=1.0 if relevant else 0.0,
            )
    return hit


def generate(args: argparse.Namespace) -> tuple[Generator, Annotations, Counter[str]]:
    """Return the generator, the annotation buffer, and a hit/miss tally."""
    generator = Generator.from_args(args)
    annotations = Annotations(
        endpoint=args.endpoint,
        dry_run=args.dry_run,
        enabled=args.annotation_rate > 0,
    )
    outcomes: Counter[str] = Counter()
    try:
        for index in range(args.traces):
            outcomes["hit" if _run_query(generator, args, annotations, index) else "miss"] += 1
        annotations.flush()
    except BaseException:
        generator.close()
        raise
    return generator, annotations, outcomes


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, annotations, outcomes = generate(args)
    generator.close()
    # Notes must wait until close() has flushed the spans they reference; see flush_notes.
    annotations.flush_notes()
    generator.print_summary()
    print(f"retrieval_hits={outcomes['hit']}")
    print(f"retrieval_misses={outcomes['miss']}")
    print(f"annotations={annotations.count}")
    print(f"document_annotations={annotations.document_count}")
    print(f"notes={annotations.note_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
