from __future__ import annotations

from pathlib import Path

from evals.pxi.experiments.context_pruning.cache_simulator import (
    SimulatedTurn,
    simulate_anthropic_prompt_cache,
    total_anthropic_cost,
    turns_to_break_even,
)
from evals.pxi.experiments.context_pruning.run_matrix import build_cells, command_for_cell


def test_build_cells_creates_one_cell_per_policy() -> None:
    cells = build_cells(
        dataset="context_pruning_pilot",
        split="dev",
        policies=("p0", "p1"),
        repetitions=5,
        concurrency=1,
        name_prefix="ctx",
    )

    assert [cell.experiment_name for cell in cells] == [
        "ctx-context_pruning_pilot-p0",
        "ctx-context_pruning_pilot-p1",
    ]
    assert cells[0].repetitions == 5


def test_command_for_cell_omits_policy_for_p0_and_includes_repetitions() -> None:
    p0, p1 = build_cells(
        dataset="context_pruning_pilot",
        split="dev",
        policies=("p0", "p1"),
        repetitions=5,
        concurrency=2,
        name_prefix="ctx",
    )

    p0_command = command_for_cell(p0, report_dir=Path("/tmp/reports"))
    p1_command = command_for_cell(p1)

    assert "--policy" not in p0_command
    assert p0_command[p0_command.index("--repetitions") + 1] == "5"
    assert p0_command[p0_command.index("--concurrency") + 1] == "2"
    assert p0_command[-2:] == ["--report-dir", "/tmp/reports"]
    assert p1_command[p1_command.index("--policy") + 1] == "p1"


def test_simulate_anthropic_prompt_cache_reads_warm_prefix() -> None:
    turn = SimulatedTurn(input_tokens=10_000, output_tokens=100, cacheable_prefix_tokens=9_000)

    usages = simulate_anthropic_prompt_cache([turn, turn])

    assert usages[0].cache_write_tokens == 9_000
    assert usages[0].cache_read_tokens == 0
    assert usages[1].cache_write_tokens == 0
    assert usages[1].cache_read_tokens == 9_000


def test_simulate_anthropic_prompt_cache_expires_after_ttl() -> None:
    turn = SimulatedTurn(input_tokens=10_000, output_tokens=100, cacheable_prefix_tokens=9_000)

    usages = simulate_anthropic_prompt_cache(
        [turn, turn],
        inter_turn_gaps_seconds=[0, 301],
        ttl_seconds=300,
    )

    assert usages[1].cache_read_tokens == 0
    assert usages[1].cache_write_tokens == 9_000


def test_simulate_anthropic_prompt_cache_invalidates_on_prefix_key_change() -> None:
    turns = [
        SimulatedTurn(
            input_tokens=10_000,
            output_tokens=100,
            cacheable_prefix_tokens=9_000,
            prefix_key="full",
        ),
        SimulatedTurn(
            input_tokens=7_000,
            output_tokens=100,
            cacheable_prefix_tokens=6_000,
            prefix_key="pruned",
        ),
    ]

    usages = simulate_anthropic_prompt_cache(turns)

    assert usages[1].cache_read_tokens == 0
    assert usages[1].cache_write_tokens == 6_000


def test_turns_to_break_even_finds_cheaper_policy() -> None:
    baseline = SimulatedTurn(
        input_tokens=100_000, output_tokens=500, cacheable_prefix_tokens=95_000
    )
    policy = SimulatedTurn(input_tokens=30_000, output_tokens=500, cacheable_prefix_tokens=25_000)

    break_even = turns_to_break_even(baseline, policy, max_turns=10)

    assert break_even == 1
    assert total_anthropic_cost(simulate_anthropic_prompt_cache([policy])) < total_anthropic_cost(
        simulate_anthropic_prompt_cache([baseline])
    )
