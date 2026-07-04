from __future__ import annotations

from dataclasses import dataclass

from evals.pxi.experiments.context_pruning.cost_model import anthropic_cost_usd

ANTHROPIC_MIN_CACHEABLE_PREFIX_TOKENS = 4_096


@dataclass(frozen=True)
class SimulatedTurn:
    input_tokens: int
    output_tokens: int
    cacheable_prefix_tokens: int
    prefix_key: str = "full"


@dataclass(frozen=True)
class SimulatedUsage:
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int

    def as_usage(self) -> dict[str, int]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "cache_write_tokens": self.cache_write_tokens,
        }


def simulate_anthropic_prompt_cache(
    turns: list[SimulatedTurn],
    *,
    inter_turn_gaps_seconds: list[float] | None = None,
    ttl_seconds: float = 300,
) -> list[SimulatedUsage]:
    if inter_turn_gaps_seconds is None:
        inter_turn_gaps_seconds = [0 for _ in turns]
    if len(inter_turn_gaps_seconds) != len(turns):
        raise ValueError("inter_turn_gaps_seconds must have the same length as turns")

    now = 0.0
    cached_prefixes: dict[str, tuple[int, float]] = {}
    usages: list[SimulatedUsage] = []
    for turn, gap_seconds in zip(turns, inter_turn_gaps_seconds):
        now += gap_seconds
        cached_tokens, expires_at = cached_prefixes.get(turn.prefix_key, (0, -1.0))
        if cached_tokens and now <= expires_at:
            cache_read_tokens = min(cached_tokens, turn.input_tokens)
            cache_write_tokens = 0
            cached_prefixes[turn.prefix_key] = (cached_tokens, now + ttl_seconds)
        elif turn.cacheable_prefix_tokens >= ANTHROPIC_MIN_CACHEABLE_PREFIX_TOKENS:
            cache_read_tokens = 0
            cache_write_tokens = min(turn.cacheable_prefix_tokens, turn.input_tokens)
            cached_prefixes[turn.prefix_key] = (cache_write_tokens, now + ttl_seconds)
        else:
            cache_read_tokens = 0
            cache_write_tokens = 0
        usages.append(
            SimulatedUsage(
                input_tokens=turn.input_tokens,
                output_tokens=turn.output_tokens,
                cache_read_tokens=cache_read_tokens,
                cache_write_tokens=cache_write_tokens,
            )
        )
    return usages


def total_anthropic_cost(usages: list[SimulatedUsage]) -> float:
    return sum(anthropic_cost_usd(usage.as_usage()) for usage in usages)


def turns_to_break_even(
    baseline_turn: SimulatedTurn,
    policy_turn: SimulatedTurn,
    *,
    max_turns: int = 100,
    ttl_seconds: float = 300,
) -> int | None:
    for turn_count in range(1, max_turns + 1):
        baseline_usages = simulate_anthropic_prompt_cache(
            [baseline_turn for _ in range(turn_count)],
            ttl_seconds=ttl_seconds,
        )
        policy_usages = simulate_anthropic_prompt_cache(
            [policy_turn for _ in range(turn_count)],
            ttl_seconds=ttl_seconds,
        )
        if total_anthropic_cost(policy_usages) <= total_anthropic_cost(baseline_usages):
            return turn_count
    return None
