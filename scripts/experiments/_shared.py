from __future__ import annotations

import argparse
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Question:
    question: str
    answer: str
    topic: str
    difficulty: str


QUESTIONS = (
    Question(
        "Which HTTP status code indicates that a resource was not found?",
        "404 Not Found.",
        "http",
        "easy",
    ),
    Question(
        "Why should production trace exporters batch spans?",
        "Batching reduces per-span network overhead and limits application latency.",
        "observability",
        "medium",
    ),
    Question(
        "What is the difference between precision and recall?",
        "Precision measures correct positive predictions; recall measures captured positives.",
        "evaluation",
        "medium",
    ),
    Question(
        "When is a database index unlikely to improve a query?",
        "When the query returns most rows or cannot use the indexed expression.",
        "databases",
        "hard",
    ),
    Question(
        "What property makes an experiment baseline useful?",
        "It provides a stable reference against which later experiment results are compared.",
        "experiments",
        "easy",
    ),
)


def add_common_arguments(parser: argparse.ArgumentParser, *, default_examples: int) -> None:
    parser.add_argument("--endpoint", default="http://localhost:6006")
    parser.add_argument("--examples", type=positive_int, default=default_examples)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dataset-name", help="Dataset name (default: generated unique name).")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize the seed plan without writing to Phoenix.",
    )


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def probability(value: str) -> float:
    parsed = float(value)
    if not 0 <= parsed <= 1:
        raise argparse.ArgumentTypeError("must be between 0 and 1")
    return parsed


def examples(count: int, rng: random.Random) -> list[dict[str, object]]:
    generated = []
    for index in range(count):
        source = QUESTIONS[index % len(QUESTIONS)]
        generated.append(
            {
                "question": source.question,
                "answer": source.answer,
                "metadata": {
                    "case_id": index + 1,
                    "topic": source.topic,
                    "difficulty": source.difficulty,
                    "cohort": rng.choice(("production", "staging", "canary")),
                },
            }
        )
    return generated


def clamp_score(score: float) -> float:
    return max(0.0, min(1.0, score))
