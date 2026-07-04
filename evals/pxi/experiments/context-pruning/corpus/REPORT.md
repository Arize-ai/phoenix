# Context Pruning Corpus Report

Seed: `20260703`

The repository artifact uses compact `input.context_pruning_prefix` specs.
The PXI harness expands those specs into deterministic primed histories at runtime.

## Datasets

| Dataset | Examples |
|---|---:|
| context_pruning_cache_smoke | 2 |
| context_pruning_pilot | 14 |
| context_pruning_type_a | 200 |
| context_pruning_type_b | 180 |
| context_pruning_gate_type_a_zero | 40 |
| context_pruning_gate_type_b_zero | 36 |
| context_pruning_gate_type_b_5k | 36 |

## Prefix Depth Check

| Target tokens | Realized estimated tokens | Delta pct | Messages |
|---:|---:|---:|---:|
| 5000 | 5000 | 0.0 | 11 |
| 25000 | 25000 | 0.0 | 51 |
| 50000 | 50000 | 0.0 | 99 |
| 100000 | 100000 | 0.0 | 197 |
| 150000 | 150000 | 0.0 | 293 |

Calibration status: fallback synthetic blocks are primary until Playwright-generated
PXI calibration sessions are recorded. All blocks are generated from the pinned seed
and contain no real user data.
