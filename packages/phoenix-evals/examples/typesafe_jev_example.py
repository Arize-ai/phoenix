"""
Run the built-in hallucination evaluator side by side on TypeSafe's Jev and an
OpenAI chat model, then compare labels and latency.

Jev is a decision-only model: it classifies without generating text, so it is
much cheaper and faster than a chat model for single-label evals. The trade-off
is that its results carry a label and score but no explanation.

Requires TYPESAFE_API_KEY and OPENAI_API_KEY to be set.

    cd packages/phoenix-evals
    ../../.venv/bin/python examples/typesafe_jev_example.py
"""

import time
from typing import Any, Callable, Dict, List, Tuple

from phoenix.evals import LLM
from phoenix.evals.llm import Decision
from phoenix.evals.metrics.hallucination import HallucinationEvaluator

jev = Decision(model="jev-latest")
gpt = LLM(provider="openai", model="gpt-4o-mini")

jev_evaluator = HallucinationEvaluator(llm=jev)
gpt_evaluator = HallucinationEvaluator(llm=gpt)

# The hallucination evaluator reads `input` (everything the assistant had
# available, treated as the source of truth) and `output` (the response).
phoenix_context = ("Retrieved document: Arize Phoenix is an open-source"
 "platform for tracing and evaluating AI applications.");
eiffel_context = "Retrieved document: The Eiffel Tower was completed in 1889 for the World's Fair."

examples: List[Dict[str, str]] = [
    {
        "input": f"{phoenix_context}\n\nUser: Is Arize Phoenix open source?",
        "output": "Yes, Arize Phoenix is open source.",
        "expected": "grounded",
    },
    {
        "input": f"{phoenix_context}\n\nUser: Is Arize Phoenix open source?",
        "output": "No, Arize Phoenix is a closed-source commercial product.",
        "expected": "hallucinated",
    },
    {
        "input": f"{eiffel_context}\n\nUser: What year was the Eiffel Tower completed?",
        "output": "It was completed in 1889.",
        "expected": "grounded",
    },
    {
        "input": f"{eiffel_context}\n\nUser: What year was the Eiffel Tower completed?",
        "output": "It was completed in 1925 to celebrate the end of World War I.",
        "expected": "hallucinated",
    },
]


def timed(fn: Callable[[], Any]) -> Tuple[Any, float]:
    start = time.perf_counter()
    value = fn()
    return value, (time.perf_counter() - start) * 1000.0


def print_table(rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    columns = list(rows[0].keys())
    widths = {col: max(len(col), *(len(str(row[col])) for row in rows)) for col in columns}
    header = " | ".join(col.ljust(widths[col]) for col in columns)
    print(header)
    print("-" * len(header))
    for row in rows:
        print(" | ".join(str(row[col]).ljust(widths[col]) for col in columns))


def summarize(name: str, latencies_ms: List[float], correct: int) -> Dict[str, Any]:
    total = sum(latencies_ms)
    return {
        "model": name,
        "calls": len(latencies_ms),
        "correct": f"{correct}/{len(latencies_ms)}",
        "mean ms": round(total / len(latencies_ms)),
        "min ms": round(min(latencies_ms)),
        "max ms": round(max(latencies_ms)),
        "total ms": round(total),
    }


def main() -> None:
    rows: List[Dict[str, Any]] = []
    jev_latencies: List[float] = []
    gpt_latencies: List[float] = []
    jev_correct = 0
    gpt_correct = 0

    for example in examples:
        expected = example["expected"]
        eval_input = {"input": example["input"], "output": example["output"]}

        (jev_scores, jev_ms) = timed(lambda: jev_evaluator.evaluate(eval_input))
        (gpt_scores, gpt_ms) = timed(lambda: gpt_evaluator.evaluate(eval_input))
        jev_score = jev_scores[0]
        gpt_score = gpt_scores[0]

        jev_latencies.append(jev_ms)
        gpt_latencies.append(gpt_ms)
        if jev_score.label == expected:
            jev_correct += 1
        if gpt_score.label == expected:
            gpt_correct += 1

        # Decision models report the full label distribution as metadata.
        probabilities = jev_score.metadata.get("probabilities") or {}
        rows.append(
            {
                "output": example["output"][:40],
                "expected": expected,
                "jev": jev_score.label,
                "jev P(label)": round(probabilities.get(jev_score.label, float("nan")), 3),
                "gpt-4o-mini": gpt_score.label,
                "jev ms": round(jev_ms),
                "gpt ms": round(gpt_ms),
            }
        )

    print("\nHallucination evaluator: labels\n")
    print_table(rows)

    print("\nLatency summary\n")
    print_table(
        [
            summarize("jev-latest", jev_latencies, jev_correct),
            summarize("gpt-4o-mini", gpt_latencies, gpt_correct),
        ]
    )


if __name__ == "__main__":
    main()
