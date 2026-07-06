from __future__ import annotations

from dataclasses import dataclass, field

from evals.pxi.experiments.context_pruning.cost_model import anthropic_cost_usd

ANTHROPIC_MIN_CACHEABLE_PREFIX_TOKENS = 4_096


@dataclass(frozen=True)
class SimulatedTurn:
    input_tokens: int
    output_tokens: int
    cacheable_prefix_tokens: int
    prefix_key: str = "full"
    summarizer_usage: dict[str, int] = field(default_factory=dict)
    refetch_input_tokens: int = 0
    refetch_output_tokens: int = 0


@dataclass(frozen=True)
class SimulatedUsage:
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int
    line_items: dict[str, dict[str, int]] = field(default_factory=dict)

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
        summarizer_usage = {
            "input_tokens": int(turn.summarizer_usage.get("input_tokens", 0) or 0),
            "output_tokens": int(turn.summarizer_usage.get("output_tokens", 0) or 0),
            "cache_read_tokens": int(turn.summarizer_usage.get("cache_read_tokens", 0) or 0),
            "cache_write_tokens": int(turn.summarizer_usage.get("cache_write_tokens", 0) or 0),
        }
        refetch_usage = {
            "input_tokens": max(0, turn.refetch_input_tokens),
            "output_tokens": max(0, turn.refetch_output_tokens),
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
        }
        agent_usage = {
            "input_tokens": turn.input_tokens,
            "output_tokens": turn.output_tokens,
            "cache_read_tokens": cache_read_tokens,
            "cache_write_tokens": cache_write_tokens,
        }
        usages.append(
            SimulatedUsage(
                input_tokens=(
                    agent_usage["input_tokens"]
                    + summarizer_usage["input_tokens"]
                    + refetch_usage["input_tokens"]
                ),
                output_tokens=(
                    agent_usage["output_tokens"]
                    + summarizer_usage["output_tokens"]
                    + refetch_usage["output_tokens"]
                ),
                cache_read_tokens=(
                    agent_usage["cache_read_tokens"] + summarizer_usage["cache_read_tokens"]
                ),
                cache_write_tokens=(
                    agent_usage["cache_write_tokens"] + summarizer_usage["cache_write_tokens"]
                ),
                line_items={
                    "agent": agent_usage,
                    "summarizer": summarizer_usage,
                    "refetch": refetch_usage,
                },
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


def empirical_openai_cached_tokens(input_tokens: int, *, hit_rate: float) -> int:
    if hit_rate < 0 or hit_rate > 1:
        raise ValueError("hit_rate must be between 0 and 1")
    if input_tokens < 1_024:
        return 0
    return int(input_tokens * hit_rate)
