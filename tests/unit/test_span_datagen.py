from __future__ import annotations

import importlib
import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

shared = importlib.import_module("scripts.generate_spans._shared")
costs = importlib.import_module("scripts.generate_spans.generate_spans_for_cost_calculations")
experiment_data = importlib.import_module("scripts.experiments._shared")
psql = importlib.import_module("scripts.generate_data_via_plpgsql._psql")
MODELS = shared.MODELS
Generator = shared.Generator
poisson = shared.poisson
token_usage = shared.token_usage
trace_endpoint = shared.trace_endpoint
DEFAULT_MANIFEST = costs.DEFAULT_MANIFEST
load_models = costs.load_models


@pytest.mark.parametrize(
    ("value", "expected"),
    (
        ("http://localhost:6006", "http://localhost:6006/v1/traces"),
        ("http://localhost:6006/", "http://localhost:6006/v1/traces"),
        ("http://collector:4318/v1/traces", "http://collector:4318/v1/traces"),
    ),
)
def test_trace_endpoint(value: str, expected: str) -> None:
    assert trace_endpoint(value) == expected


def test_token_usage_is_seeded_and_internally_consistent() -> None:
    first = token_usage(random.Random(7), MODELS[0])
    second = token_usage(random.Random(7), MODELS[0])

    assert first == second
    assert first.prompt > 0
    assert first.completion > 0
    assert first.total == first.prompt + first.completion
    assert first.completion <= first.prompt * 2


def test_poisson_is_seeded_and_rejects_negative_rates() -> None:
    first = [poisson(random.Random(seed), 3.5) for seed in range(10)]
    second = [poisson(random.Random(seed), 3.5) for seed in range(10)]

    assert first == second
    assert all(value >= 0 for value in first)
    with pytest.raises(ValueError, match="non-negative"):
        poisson(random.Random(1), -0.1)


def test_cost_models_come_from_the_checked_in_manifest() -> None:
    models = load_models(Path(DEFAULT_MANIFEST))

    assert len(models) > 10
    assert any(model.provider == "openai" for model in models)
    assert any(model.provider == "anthropic" for model in models)
    assert len({model.name for model in models}) == len(models)


def test_dry_run_generator_counts_roots_without_exporting() -> None:
    generator = Generator(
        endpoint="http://localhost:6006",
        project_name="test",
        seed=3,
        dry_run=True,
    )
    with generator.span("root", "CHAIN", root=True):
        with generator.span("child", "LLM"):
            pass
    generator.close()

    assert generator.trace_count == 1
    assert generator.span_count == 2


def test_experiment_examples_are_seeded_and_domain_realistic() -> None:
    first = experiment_data.examples(7, random.Random(5))
    second = experiment_data.examples(7, random.Random(5))

    assert first == second
    assert {row["metadata"]["difficulty"] for row in first} == {"easy", "medium", "hard"}
    assert all(row["question"] and row["answer"] for row in first)


def test_postgres_trace_count_is_passed_as_a_psql_variable(tmp_path: Path) -> None:
    command = psql.command(
        psql.DatabaseConfig(
            name="postgres",
            user="postgres",
            host="localhost",
            port=5432,
            password="phoenix",
        ),
        tmp_path / "generate.sql",
        variables={"num_traces": 17},
    )
    variable_index = command.index("num_traces=17")
    assert ("--set", "num_traces=17") == tuple(command[variable_index - 1 : variable_index + 1])
    assert "ON_ERROR_STOP=1" in command
