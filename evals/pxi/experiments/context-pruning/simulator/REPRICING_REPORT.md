# Context Pruning Cache Simulator Report

Date: 2026-07-04

## Implemented

- Anthropic prompt-cache simulation with 4096-token minimum cacheable prefix.
- Refresh-on-use TTL handling for warm-cache and gappy-session scenarios.
- Prefix-key invalidation for pruned/compacted histories.
- Traceable per-turn line items:
  - `agent`: main agent input/output/cache read/cache write tokens.
  - `summarizer`: P2 compaction call usage, including its own cache metadata.
  - `refetch`: measured or estimated redundant re-fetch input/output tokens.
- OpenAI empirical cached-token helper parameterized by observed hit rate, with the
  1024-token minimum represented explicitly.

## Hand-Computed Checks

The unit tests cover:

- Warm Anthropic prefix write on turn 1 and read on turn 2.
- TTL expiry causing a new cache write.
- Prefix-key changes invalidating reuse.
- Summarizer and re-fetch usage being charged into the policy total.
- OpenAI cached-token estimates using a caller-supplied hit rate.

## Complexity Trap Repricing

Tooling added: `evals.pxi.experiments.context_pruning.complexity_repricing`.

The CLI accepts a downloaded per-turn CSV, JSON, or JSONL export with strategy,
trajectory/instance id, input tokens, output tokens, and optional prefix/summarizer
token columns:

```bash
uv run python -m evals.pxi.experiments.context_pruning.complexity_repricing \
  /path/to/complexity-trap-turns.jsonl \
  --ttl-seconds 300 \
  --output evals/pxi/experiments/context-pruning/simulator/complexity_trap_repriced.json
```

Current status: headline repricing numbers are pending the external token export
from Lindenbauer et al. (arXiv:2508.21433). The arXiv page states that code and
data are released for reproducibility, but this repository intentionally does not
vendor a live third-party dataset URL or downloaded data blob.

Disclosure to preserve in the final write-up: that secondary arm re-prices observed
SWE-agent trajectories that were generated without cache-aware policies in the loop.
