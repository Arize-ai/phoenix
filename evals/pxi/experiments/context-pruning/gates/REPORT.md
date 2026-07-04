# Context Pruning Admission Gates

| Gate | Dataset | Result | Pass rate | Criterion |
|---|---|---:|---:|---|
| type_a_zero | `context_pruning_gate_type_a_zero` | not_run | not run | >= 80% |
| type_b_zero | `context_pruning_gate_type_b_zero` | not_run | not run | <= 20% |
| type_b_5k | `context_pruning_gate_type_b_5k` | not_run | not run | >= 80% |

## Rationale

- `type_a_zero`: History-independent Type A tasks should pass without context.
- `type_b_zero`: History-dependent Type B tasks should fail without the recalled needle.
- `type_b_5k`: History-dependent Type B tasks should pass when the 5K prefix is present.
